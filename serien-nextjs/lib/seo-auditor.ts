/**
 * SEO Auditor Engine v2
 * 
 * Hybrid audit: DB-driven checks + HTTP-level validation + Sitemap analysis
 * Checks: duplicates, conflicts, missing fields, broken links, news requirements,
 *         status codes, canonical tags, JSON-LD, OG tags, robots meta, response times
 */

import prisma from './prisma';
import { createHash, randomUUID } from 'crypto';

// ──────────── Types ────────────

export interface SeoIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

export const ISSUE_LABELS: Record<string, string> = {
  // DB-level
  hub_article_conflict: 'Hub/Artikel Slug-Konflikt',
  duplicate_title: 'Doppelter Titel',
  duplicate_meta_description: 'Doppelte Meta-Description',
  duplicate_content: 'Doppelter Inhalt',
  missing_meta_description: 'Fehlende Meta-Description',
  missing_publish_date: 'Fehlendes Veröffentlichungsdatum',
  missing_author: 'Fehlender Autor',
  missing_hero_image: 'Fehlendes Hero-Bild',
  missing_source: 'Fehlende Quellenangabe',
  missing_excerpt: 'Fehlender Teaser/Excerpt',
  thin_content: 'Dünner Inhalt (< 300 Wörter)',
  broken_internal_link: 'Kaputter interner Link',
  orphan_article: 'Verwaister Artikel (keine Serie)',
  stale_article: 'Veralteter Artikel (> 90 Tage)',
  // HTTP-level
  http_error: 'HTTP-Fehler',
  wrong_canonical: 'Falsche Canonical-URL',
  missing_canonical_tag: 'Fehlender Canonical-Tag',
  missing_robots_meta: 'Fehlender Robots-Meta-Tag',
  noindex_detected: 'Noindex erkannt',
  missing_h1: 'Fehlende H1-Überschrift',
  multiple_h1: 'Mehrere H1-Überschriften',
  missing_jsonld: 'Fehlendes JSON-LD Schema',
  invalid_jsonld_type: 'Falscher JSON-LD Typ',
  missing_og_tags: 'Fehlende Open-Graph-Tags',
  slow_response: 'Langsame Ladezeit (> 3s)',
  // Sitemap
  sitemap_missing_url: 'URL fehlt in Sitemap',
  sitemap_orphan: 'Sitemap-URL ohne DB-Eintrag',
  sitemap_unreachable: 'Sitemap nicht erreichbar',
  // News-specific (HTTP)
  news_missing_date: 'Kein sichtbares Datum',
  news_missing_author: 'Kein sichtbarer Autor',
  news_missing_source: 'Kein Quellenblock',
  news_missing_tmdb: 'Keine TMDB-Bildquelle',
  // Feed/Listing
  feed_indexable: 'Feed/Listing-Seite indexierbar',
};

// ──────────── Helpers ────────────

function md5(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractInternalLinks(html: string): string[] {
  const links: string[] = [];
  const regex = /href=["'](\/[^"'#?]*)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const path = match[1].replace(/\/$/, '') || '/';
    links.push(path);
  }
  return [...new Set(links)];
}

/** Fetch a page and extract SEO signals from raw HTML */
async function fetchPageSeoData(url: string): Promise<{
  statusCode: number;
  canonical: string | null;
  robotsMeta: string | null;
  h1: string | null;
  h1Count: number;
  jsonLd: any[] | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  responseTimeMs: number;
  // News-specific signals
  hasVisibleDate: boolean;
  hasVisibleAuthor: boolean;
  hasSourceBlock: boolean;
  hasTmdbAttribution: boolean;
} | null> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SerienDE-SEO-Auditor/1.0' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const html = await res.text();

    // Extract canonical
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
    const canonical = canonicalMatch?.[1] || null;

    // Extract robots meta
    const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)["']/i);
    const robotsMeta = robotsMatch?.[1] || null;

    // Extract H1s
    const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    const h1 = h1Matches.length > 0
      ? h1Matches[0].replace(/<[^>]*>/g, '').trim()
      : null;

    // Extract JSON-LD
    const jsonLdMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    let jsonLd: any[] | null = null;
    if (jsonLdMatches.length > 0) {
      jsonLd = [];
      for (const m of jsonLdMatches) {
        try {
          const content = m.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          jsonLd.push(JSON.parse(content));
        } catch { /* malformed JSON-LD */ }
      }
    }

    // Extract OG tags
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

    // News-specific: visible date (look for <time> element or common date patterns)
    const hasVisibleDate = /<time[^>]*datetime/i.test(html)
      || /\d{1,2}\.\s?\w+\s?\d{4}/i.test(html)
      || /article:published_time/i.test(html);

    // News-specific: visible author (look for author markup or "Von ..." pattern)
    const hasVisibleAuthor = /rel=["']author["']/i.test(html)
      || /class=["'][^"']*author[^"']*["']/i.test(html)
      || /Von\s+[A-ZÄÖÜ][a-zäöüß]+/i.test(html);

    // News-specific: source/Quelle block
    const hasSourceBlock = /Quelle/i.test(html)
      || /class=["'][^"']*source[^"']*["']/i.test(html)
      || /rel=["']nofollow["'][^>]*>.*?(Quelle|Source)/i.test(html);

    // News-specific: TMDB attribution under images
    const hasTmdbAttribution = /TMDB/i.test(html)
      || /themoviedb/i.test(html)
      || /Bildquelle.*?TMDB/i.test(html);

    return {
      statusCode: res.status,
      canonical, robotsMeta, h1, h1Count: h1Matches.length, jsonLd,
      ogTitle: ogTitleMatch?.[1] || null,
      ogDescription: ogDescMatch?.[1] || null,
      ogImage: ogImageMatch?.[1] || null,
      responseTimeMs,
      hasVisibleDate, hasVisibleAuthor, hasSourceBlock, hasTmdbAttribution,
    };
  } catch (error: any) {
    return {
      statusCode: 0, canonical: null, robotsMeta: null, h1: null, h1Count: 0,
      jsonLd: null, ogTitle: null, ogDescription: null, ogImage: null,
      responseTimeMs: Date.now() - start,
      hasVisibleDate: false, hasVisibleAuthor: false,
      hasSourceBlock: false, hasTmdbAttribution: false,
    };
  }
}

/** Parse sitemap.xml and return all URLs */
async function parseSitemap(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { 'User-Agent': 'SerienDE-SEO-Auditor/1.0' },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const urls: string[] = [];
    const regex = /<loc>([^<]+)<\/loc>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  } catch {
    return [];
  }
}

// ──────────── DB Audit (fast) ────────────

export async function runFullAudit(trigger: string = 'manual'): Promise<string> {
  const runId = randomUUID();

  await prisma.seo_crawl_runs.create({
    data: { id: runId, status: 'running', trigger },
  });

  try {
    const [articles, allSeries] = await Promise.all([
      prisma.articles.findMany({
        where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
        select: {
          id: true, slug: true, title: true, excerpt: true,
          metaDescription: true, contentHtml: true,
          publishedAt: true, updatedAt: true, authorId: true,
          sourceUrl: true, imageAttribution: true,
          primarySeriesId: true, heroImageUrl: true,
          heroLocalUrl: true, heroImagePath: true,
          users: { select: { name: true } },
        },
      }),
      prisma.series.findMany({
        select: { slug: true, tmdbId: true, title: true },
      }),
    ]);

    const seriesSlugs = new Set(allSeries.map(s => s.slug));
    const articleSlugs = new Set(articles.map(a => a.slug));
    const baseUrl = 'https://serien.de';

    // Build duplicate detection maps
    const titleMap = new Map<string, string[]>();
    const descMap = new Map<string, string[]>();
    const hashMap = new Map<string, string[]>();

    for (const article of articles) {
      const titleKey = article.title.toLowerCase().trim();
      if (!titleMap.has(titleKey)) titleMap.set(titleKey, []);
      titleMap.get(titleKey)!.push(article.slug);

      const desc = (article.metaDescription || article.excerpt || '').toLowerCase().trim();
      if (desc.length > 20) {
        if (!descMap.has(desc)) descMap.set(desc, []);
        descMap.get(desc)!.push(article.slug);
      }

      if (article.contentHtml) {
        const stripped = stripHtml(article.contentHtml).substring(0, 1000);
        const hash = md5(stripped);
        if (!hashMap.has(hash)) hashMap.set(hash, []);
        hashMap.get(hash)!.push(article.slug);
      }
    }

    // Build valid internal paths
    const validPaths = new Set<string>();
    validPaths.add('/');
    for (const p of ['trending', 'about', 'impressum', 'datenschutz', 'autoren',
      'neue-serien', 'kalender', 'nutzungsbedingungen', 'redaktionelle-richtlinien',
      'serienfinder', 'serie', 'neue-videos', 'onboarding', 'einstellungen',
      'netflix-serien', 'disney-plus-serien', 'prime-video-serien',
      'apple-tv-serien', 'paramount-plus-serien', 'wow-serien',
      'rtl-plus-serien', 'joyn-serien', 'magenta-tv-serien',
      'crunchyroll-serien', 'ard-mediathek-serien', 'zdf-mediathek-serien',
      'hbo-serien', 'discovery-plus-serien', 'maxdome-serien',
      'freenet-video-serien', 'rakuten-tv-serien', 'chili-serien',
    ]) validPaths.add(`/${p}`);
    for (const a of articles) validPaths.add(`/${a.slug}`);
    for (const s of allSeries) validPaths.add(`/serie/${s.slug}`);

    // Audit each article
    const pageResults: {
      id: string; crawlRunId: string; url: string; pageType: string;
      title: string | null; metaDescription: string | null;
      canonical: string | null; contentHash: string | null;
      internalLinks: number; issues: SeoIssue[];
    }[] = [];

    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    for (const article of articles) {
      const issues: SeoIssue[] = [];
      const url = `${baseUrl}/${article.slug}`;
      const canonical = `${baseUrl}/${article.slug}`;
      const desc = article.metaDescription || article.excerpt || null;
      const plainText = article.contentHtml ? stripHtml(article.contentHtml) : '';
      const wordCount = countWords(plainText);
      const contentHash = plainText ? md5(plainText.substring(0, 1000)) : null;
      const links = article.contentHtml ? extractInternalLinks(article.contentHtml) : [];

      // Hub vs Article conflict
      if (seriesSlugs.has(article.slug)) {
        issues.push({ type: 'hub_article_conflict', severity: 'warning',
          message: `Slug "/${article.slug}" kollidiert mit /serie/${article.slug}`,
          details: '308 Redirect aktiv.' });
      }
      // Duplicate title
      const titleKey = article.title.toLowerCase().trim();
      const titleDupes = titleMap.get(titleKey) || [];
      if (titleDupes.length > 1) {
        issues.push({ type: 'duplicate_title', severity: 'warning',
          message: `Titel "${article.title}" wird ${titleDupes.length}x verwendet`,
          details: titleDupes.filter(s => s !== article.slug).join(', ') });
      }
      // Duplicate meta description
      const descKey = (desc || '').toLowerCase().trim();
      if (descKey.length > 20) {
        const descDupes = descMap.get(descKey) || [];
        if (descDupes.length > 1) {
          issues.push({ type: 'duplicate_meta_description', severity: 'warning',
            message: `Meta-Description wird ${descDupes.length}x verwendet`,
            details: descDupes.filter(s => s !== article.slug).join(', ') });
        }
      }
      // Duplicate content
      if (contentHash) {
        const contentDupes = hashMap.get(contentHash) || [];
        if (contentDupes.length > 1) {
          issues.push({ type: 'duplicate_content', severity: 'critical',
            message: `Inhalt identisch mit ${contentDupes.length - 1} anderen Artikeln`,
            details: contentDupes.filter(s => s !== article.slug).join(', ') });
        }
      }
      // Missing meta description
      if (!desc || desc.length < 50) {
        issues.push({ type: 'missing_meta_description', severity: 'warning',
          message: desc ? 'Meta-Description zu kurz (< 50 Zeichen)' : 'Keine Meta-Description' });
      }
      // Missing publish date
      if (!article.publishedAt) {
        issues.push({ type: 'missing_publish_date', severity: 'warning',
          message: 'Kein Veröffentlichungsdatum' });
      }
      // Missing author
      if (!article.users?.name) {
        issues.push({ type: 'missing_author', severity: 'warning', message: 'Kein Autor zugewiesen' });
      }
      // Missing hero image
      if (!article.heroImageUrl && !article.heroLocalUrl && !article.heroImagePath) {
        issues.push({ type: 'missing_hero_image', severity: 'warning', message: 'Kein Hero-Bild' });
      }
      // Missing excerpt
      if (!article.excerpt || article.excerpt.length < 20) {
        issues.push({ type: 'missing_excerpt', severity: 'info', message: 'Kein/zu kurzer Teaser' });
      }
      // Thin content
      if (wordCount < 300) {
        issues.push({ type: 'thin_content', severity: 'warning',
          message: `Nur ${wordCount} Wörter (Min: 300)` });
      }
      // Missing source
      if (!article.sourceUrl) {
        issues.push({ type: 'missing_source', severity: 'info', message: 'Keine Quellenangabe' });
      }
      // Orphan
      if (!article.primarySeriesId) {
        issues.push({ type: 'orphan_article', severity: 'info', message: 'Nicht mit Serie verknüpft' });
      }
      // Broken internal links
      const dynamicPrefixes = ['/genre/', '/autor/', '/figur/', '/person/', '/figuren/', '/personen/', '/streamer/', '/admin/', '/api/', '/auth/', '/einstellungen/'];
      for (const linkPath of links) {
        if (dynamicPrefixes.some(p => linkPath.startsWith(p))) continue;
        if (!validPaths.has(linkPath) && !linkPath.startsWith('/serie/')) {
          const slug = linkPath.replace(/^\//, '');
          if (!articleSlugs.has(slug) && !seriesSlugs.has(slug)) {
            issues.push({ type: 'broken_internal_link', severity: 'warning',
              message: `Kaputter Link: ${linkPath}`, details: 'Ziel nicht gefunden' });
          }
        }
      }
      // Stale
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      if (article.updatedAt && new Date(article.updatedAt) < ninetyDaysAgo) {
        issues.push({ type: 'stale_article', severity: 'info', message: 'Seit > 90 Tagen nicht aktualisiert' });
      }

      for (const issue of issues) {
        if (issue.severity === 'critical') criticalCount++;
        else if (issue.severity === 'warning') warningCount++;
        else infoCount++;
      }

      pageResults.push({
        id: randomUUID(), crawlRunId: runId, url, pageType: 'article',
        title: article.title, metaDescription: desc, canonical, contentHash,
        internalLinks: links.length, issues,
      });
    }

    // Audit series
    for (const s of allSeries) {
      const issues: SeoIssue[] = [];
      if (articleSlugs.has(s.slug)) {
        issues.push({ type: 'hub_article_conflict', severity: 'warning',
          message: `Serie /serie/${s.slug} kollidiert mit Artikel /${s.slug}` });
      }
      if (!s.title || s.title.length < 2) {
        issues.push({ type: 'missing_meta_description', severity: 'warning',
          message: 'Serie ohne Titel' });
      }
      for (const issue of issues) {
        if (issue.severity === 'critical') criticalCount++;
        else if (issue.severity === 'warning') warningCount++;
        else infoCount++;
      }
      if (issues.length > 0) {
        pageResults.push({
          id: randomUUID(), crawlRunId: runId,
          url: `${baseUrl}/serie/${s.slug}`, pageType: 'series',
          title: s.title, metaDescription: null,
          canonical: `${baseUrl}/serie/${s.slug}`,
          contentHash: null, internalLinks: 0, issues,
        });
      }
    }

    // Health score
    const totalPages = articles.length + allSeries.length;
    const pagesWithCritical = new Set(pageResults.filter(p => p.issues.some(i => i.severity === 'critical')).map(p => p.url)).size;
    const pagesWithWarning = new Set(pageResults.filter(p => p.issues.some(i => i.severity === 'warning') && !p.issues.some(i => i.severity === 'critical')).map(p => p.url)).size;
    const cleanPages = totalPages - pagesWithCritical - pagesWithWarning;
    const healthScore = Math.max(0, Math.min(100, Math.round(
      ((cleanPages * 100) + (pagesWithWarning * 60) + (pagesWithCritical * 20)) / totalPages
    )));

    // Store
    const pagesWithIssues = pageResults.filter(p => p.issues.length > 0);
    if (pagesWithIssues.length > 0) {
      await prisma.seo_page_results.createMany({
        data: pagesWithIssues.map(p => ({
          id: p.id, crawlRunId: p.crawlRunId, url: p.url,
          pageType: p.pageType, title: p.title,
          metaDescription: p.metaDescription, canonical: p.canonical,
          contentHash: p.contentHash, internalLinks: p.internalLinks,
          issues: p.issues as any,
        })),
      });
    }

    await prisma.seo_crawl_runs.update({
      where: { id: runId },
      data: {
        status: 'completed', totalPages,
        issuesFound: criticalCount + warningCount + infoCount,
        criticalCount, warningCount, infoCount,
        healthScore, completedAt: new Date(),
      },
    });

    return runId;
  } catch (error: any) {
    console.error('SEO Audit failed:', error);
    await prisma.seo_crawl_runs.update({
      where: { id: runId },
      data: { status: 'failed', completedAt: new Date() },
    });
    throw error;
  }
}

// ──────────── HTTP Audit ────────────

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 500;

async function batchFetch<T>(items: string[], fn: (url: string) => Promise<T>): Promise<Map<string, T>> {
  const results = new Map<string, T>();
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(async url => {
      const result = await fn(url);
      return { url, result };
    }));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.set(r.value.url, r.value.result);
      }
    }
    if (i + BATCH_SIZE < items.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
  return results;
}

export async function runHttpAudit(runId: string, sampleSize: number = 50): Promise<void> {
  const baseUrl = 'https://serien.de';

  // Mark as running
  await prisma.seo_crawl_runs.update({
    where: { id: runId },
    data: { status: 'running' },
  });

  try {
    // 1. Sitemap validation
    console.log('[HTTP Audit] Fetching sitemap...');
    const sitemapUrls = await parseSitemap(baseUrl);

    // Get all DB URLs
    const [articles, allSeries] = await Promise.all([
      prisma.articles.findMany({
        where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
        select: { slug: true },
      }),
      prisma.series.findMany({ select: { slug: true } }),
    ]);

    const dbArticleUrls = new Set(articles.map(a => `${baseUrl}/${a.slug}`));
    const dbSeriesUrls = new Set(allSeries.map(s => `${baseUrl}/serie/${s.slug}`));
    const allDbUrls = new Set([...dbArticleUrls, ...dbSeriesUrls]);
    const sitemapUrlSet = new Set(sitemapUrls);

    // Sitemap issues
    const sitemapIssues: { url: string; issues: SeoIssue[] }[] = [];

    if (sitemapUrls.length === 0) {
      sitemapIssues.push({
        url: `${baseUrl}/sitemap.xml`,
        issues: [{ type: 'sitemap_unreachable', severity: 'critical',
          message: 'Sitemap nicht erreichbar oder leer' }],
      });
    } else {
      // URLs in DB but not in sitemap (sample)
      let missingCount = 0;
      for (const dbUrl of allDbUrls) {
        if (!sitemapUrlSet.has(dbUrl)) {
          missingCount++;
          if (missingCount <= 20) {
            sitemapIssues.push({
              url: dbUrl,
              issues: [{ type: 'sitemap_missing_url', severity: 'warning',
                message: 'Veröffentlichte URL fehlt in sitemap.xml' }],
            });
          }
        }
      }
      if (missingCount > 20) {
        sitemapIssues.push({
          url: `${baseUrl}/sitemap.xml`,
          issues: [{ type: 'sitemap_missing_url', severity: 'warning',
            message: `${missingCount} URLs fehlen insgesamt in der Sitemap` }],
        });
      }

      // Sitemap orphans (URLs in sitemap but not in DB)
      let orphanCount = 0;
      for (const sUrl of sitemapUrls) {
        if (!allDbUrls.has(sUrl) && !sUrl.endsWith('/') && !sUrl.includes('/trending') && !sUrl.includes('/impressum')) {
          orphanCount++;
          if (orphanCount <= 10) {
            sitemapIssues.push({
              url: sUrl,
              issues: [{ type: 'sitemap_orphan', severity: 'info',
                message: 'URL in Sitemap aber nicht als Artikel/Serie in DB' }],
            });
          }
        }
      }
    }

    // 2. HTTP crawl sample
    console.log(`[HTTP Audit] Crawling ${sampleSize} pages...`);

    // Build sample: mix of articles, series, and special pages
    const specialPages = [
      `${baseUrl}`,
      `${baseUrl}/trending`,
      `${baseUrl}/impressum`,
      `${baseUrl}/datenschutz`,
      `${baseUrl}/nutzungsbedingungen`,
      `${baseUrl}/redaktionelle-richtlinien`,
    ];

    const articleSample = articles
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(sampleSize * 0.6))
      .map(a => `${baseUrl}/${a.slug}`);

    const seriesSample = allSeries
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(sampleSize * 0.3))
      .map(s => `${baseUrl}/serie/${s.slug}`);

    const urlsToCheck = [...new Set([...specialPages, ...articleSample, ...seriesSample])].slice(0, sampleSize);

    const httpResults = await batchFetch(urlsToCheck, fetchPageSeoData);

    // 3. Analyze HTTP results
    const httpIssueResults: {
      id: string; crawlRunId: string; url: string; pageType: string;
      statusCode: number | null; title: string | null; metaDescription: string | null;
      h1: string | null; canonical: string | null; robotsMeta: string | null;
      responseTimeMs: number | null; hasJsonLd: boolean | null; issues: SeoIssue[];
    }[] = [];

    let httpCritical = 0;
    let httpWarning = 0;
    let httpInfo = 0;

    for (const [url, data] of httpResults) {
      if (!data) continue;
      const issues: SeoIssue[] = [];
      const isArticle = !url.includes('/serie/') && url !== baseUrl && !specialPages.includes(url);
      const pageType = url.includes('/serie/') ? 'series'
        : specialPages.includes(url) ? 'static'
        : 'article';

      // Status code
      if (data.statusCode === 0) {
        issues.push({ type: 'http_error', severity: 'critical',
          message: 'Seite nicht erreichbar (Timeout)', details: `URL: ${url}` });
      } else if (data.statusCode >= 400) {
        issues.push({ type: 'http_error', severity: 'critical',
          message: `HTTP ${data.statusCode}`, details: `Seite gibt Fehler zurück` });
      } else if (data.statusCode >= 300 && data.statusCode < 400) {
        issues.push({ type: 'http_error', severity: 'info',
          message: `Redirect ${data.statusCode}`, details: 'Weiterleitung erkannt' });
      }

      // Canonical
      if (!data.canonical) {
        issues.push({ type: 'missing_canonical_tag', severity: 'warning',
          message: 'Kein <link rel="canonical"> im HTML' });
      } else if (data.canonical !== url && !data.canonical.endsWith(url.replace(baseUrl, ''))) {
        issues.push({ type: 'wrong_canonical', severity: 'critical',
          message: `Canonical zeigt auf ${data.canonical}`,
          details: `Erwartet: ${url}` });
      }

      // Robots meta
      if (data.robotsMeta) {
        if (data.robotsMeta.includes('noindex')) {
          issues.push({ type: 'noindex_detected', severity: 'warning',
            message: `robots meta: "${data.robotsMeta}"`,
            details: 'Seite wird von Google nicht indexiert' });
        }
      }

      // H1
      if (!data.h1) {
        issues.push({ type: 'missing_h1', severity: 'warning',
          message: 'Keine H1-Überschrift gefunden' });
      }
      if (data.h1Count > 1) {
        issues.push({ type: 'multiple_h1', severity: 'info',
          message: `${data.h1Count} H1-Überschriften auf der Seite` });
      }

      // JSON-LD
      if (isArticle) {
        if (!data.jsonLd || data.jsonLd.length === 0) {
          issues.push({ type: 'missing_jsonld', severity: 'warning',
            message: 'Kein JSON-LD Schema-Markup gefunden' });
        } else {
          const types = data.jsonLd.map(j => j['@type']).flat().filter(Boolean);
          if (!types.includes('NewsArticle') && !types.includes('Article')) {
            issues.push({ type: 'invalid_jsonld_type', severity: 'warning',
              message: `JSON-LD Typen: ${types.join(', ')}`,
              details: 'Erwartet: NewsArticle oder Article' });
          }
        }
      }

      // OG tags
      if (!data.ogTitle || !data.ogImage) {
        const missing = [];
        if (!data.ogTitle) missing.push('og:title');
        if (!data.ogImage) missing.push('og:image');
        if (!data.ogDescription) missing.push('og:description');
        issues.push({ type: 'missing_og_tags', severity: 'warning',
          message: `Fehlende OG-Tags: ${missing.join(', ')}` });
      }

      // Response time
      if (data.responseTimeMs > 3000) {
        issues.push({ type: 'slow_response', severity: 'warning',
          message: `Ladezeit: ${(data.responseTimeMs / 1000).toFixed(1)}s`,
          details: 'Über 3 Sekunden (Ziel: < 2s)' });
      }

      // News-specific checks (only for articles)
      if (isArticle) {
        if (!data.hasVisibleDate) {
          issues.push({ type: 'news_missing_date', severity: 'warning',
            message: 'Kein sichtbares Veröffentlichungsdatum im HTML',
            details: 'Google News & Discover erfordern sichtbares Datum' });
        }
        if (!data.hasVisibleAuthor) {
          issues.push({ type: 'news_missing_author', severity: 'warning',
            message: 'Kein sichtbarer Autor im HTML',
            details: 'E-E-A-T: Autorschaft muss erkennbar sein' });
        }
        if (!data.hasSourceBlock) {
          issues.push({ type: 'news_missing_source', severity: 'info',
            message: 'Kein Quellenblock erkannt',
            details: 'Quellenangaben stärken die Glaubwürdigkeit' });
        }
        if (!data.hasTmdbAttribution) {
          issues.push({ type: 'news_missing_tmdb', severity: 'info',
            message: 'Keine TMDB-Bildquelle erkannt',
            details: 'Bildquellenangabe empfohlen bei TMDB-Bildern' });
        }
      }

      // Feed/Listing page check: these should typically not be indexable
      const feedPaths = ['/trending', '/netflix-serien', '/disney-plus-serien', '/prime-video-serien',
        '/apple-tv-serien', '/paramount-plus-serien', '/wow-serien', '/neue-serien'];
      const isFeedPage = feedPaths.some(fp => url.endsWith(fp));
      if (isFeedPage && data.robotsMeta && !data.robotsMeta.includes('noindex')) {
        // Feed pages being indexable is actually fine for these category pages
        // Only flag if they have thin content or duplicate canonical issues
      }

      for (const issue of issues) {
        if (issue.severity === 'critical') httpCritical++;
        else if (issue.severity === 'warning') httpWarning++;
        else httpInfo++;
      }

      httpIssueResults.push({
        id: randomUUID(), crawlRunId: runId, url, pageType,
        statusCode: data.statusCode || null,
        title: null, metaDescription: null,
        h1: data.h1, canonical: data.canonical,
        robotsMeta: data.robotsMeta,
        responseTimeMs: data.responseTimeMs,
        hasJsonLd: data.jsonLd !== null && data.jsonLd.length > 0,
        issues,
      });
    }

    // 4. Merge with existing page results
    // For HTTP results: update existing pages or create new entries
    for (const httpPage of httpIssueResults) {
      if (httpPage.issues.length === 0) continue;

      const existing = await prisma.seo_page_results.findFirst({
        where: { crawlRunId: runId, url: httpPage.url },
      });

      if (existing) {
        const existingIssues = existing.issues as SeoIssue[];
        const merged = [...existingIssues, ...httpPage.issues];
        await prisma.seo_page_results.update({
          where: { id: existing.id },
          data: {
            issues: merged as any,
            statusCode: httpPage.statusCode,
            h1: httpPage.h1,
            canonical: httpPage.canonical,
            robotsMeta: httpPage.robotsMeta,
            responseTimeMs: httpPage.responseTimeMs,
            hasJsonLd: httpPage.hasJsonLd,
          },
        });
      } else {
        await prisma.seo_page_results.create({
          data: {
            id: httpPage.id, crawlRunId: runId, url: httpPage.url,
            pageType: httpPage.pageType, statusCode: httpPage.statusCode,
            h1: httpPage.h1, canonical: httpPage.canonical,
            robotsMeta: httpPage.robotsMeta, responseTimeMs: httpPage.responseTimeMs,
            hasJsonLd: httpPage.hasJsonLd, issues: httpPage.issues as any,
          },
        });
      }
    }

    // Store sitemap issues
    for (const si of sitemapIssues) {
      if (si.issues.length === 0) continue;
      await prisma.seo_page_results.create({
        data: {
          id: randomUUID(), crawlRunId: runId, url: si.url,
          pageType: 'sitemap', issues: si.issues as any,
        },
      });
      for (const issue of si.issues) {
        if (issue.severity === 'critical') httpCritical++;
        else if (issue.severity === 'warning') httpWarning++;
        else httpInfo++;
      }
    }

    // 5. Update run stats with HTTP results
    const existingRun = await prisma.seo_crawl_runs.findUnique({ where: { id: runId } });
    if (existingRun) {
      const newCritical = existingRun.criticalCount + httpCritical;
      const newWarning = existingRun.warningCount + httpWarning;
      const newInfo = existingRun.infoCount + httpInfo;

      // Recalculate health score with HTTP data
      const allPages = await prisma.seo_page_results.findMany({ where: { crawlRunId: runId } });
      const total = existingRun.totalPages;
      const withCritical = new Set(allPages.filter(p => (p.issues as SeoIssue[]).some(i => i.severity === 'critical')).map(p => p.url)).size;
      const withWarning = new Set(allPages.filter(p => (p.issues as SeoIssue[]).some(i => i.severity === 'warning') && !(p.issues as SeoIssue[]).some(i => i.severity === 'critical')).map(p => p.url)).size;
      const clean = total - withCritical - withWarning;
      const newScore = Math.max(0, Math.min(100, Math.round(
        ((clean * 100) + (withWarning * 60) + (withCritical * 20)) / total
      )));

      await prisma.seo_crawl_runs.update({
        where: { id: runId },
        data: {
          status: 'completed',
          criticalCount: newCritical,
          warningCount: newWarning,
          infoCount: newInfo,
          issuesFound: newCritical + newWarning + newInfo,
          healthScore: newScore,
          completedAt: new Date(),
        },
      });
    }

    console.log(`[HTTP Audit] Completed. ${httpIssueResults.length} pages crawled, ${sitemapIssues.length} sitemap issues.`);
  } catch (error: any) {
    console.error('[HTTP Audit] Error:', error);
    await prisma.seo_crawl_runs.update({
      where: { id: runId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }
}

// ──────────── AI Summary ────────────

export async function generateAiSummary(runId: string): Promise<string> {
  const run = await prisma.seo_crawl_runs.findUnique({
    where: { id: runId },
    include: {
      pages: {
        where: { issues: { not: { equals: [] as any } } },
        take: 50,
        orderBy: { url: 'asc' },
      },
    },
  });

  if (!run) throw new Error('Crawl run not found');

  const issuesByType: Record<string, number> = {};
  const criticalUrls: string[] = [];

  for (const page of run.pages) {
    const issues = page.issues as SeoIssue[];
    for (const issue of issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      if (issue.severity === 'critical') criticalUrls.push(page.url);
    }
  }

  const prompt = `Du bist SEO-Experte für die deutsche News-Website serien.de.

Hier sind die Ergebnisse des letzten SEO-Audits (DB + HTTP Crawl):

Health Score: ${run.healthScore}/100
Geprüfte Seiten: ${run.totalPages}
Kritische Fehler: ${run.criticalCount}
Warnungen: ${run.warningCount}
Hinweise: ${run.infoCount}

Issue-Verteilung:
${Object.entries(issuesByType).map(([type, count]) => `- ${ISSUE_LABELS[type] || type}: ${count}`).join('\n')}

${criticalUrls.length > 0 ? `Kritische URLs:\n${[...new Set(criticalUrls)].slice(0, 10).join('\n')}` : ''}

Erstelle eine handlungsorientierte Zusammenfassung (4-6 Sätze) auf Deutsch mit Top-3-Prioritäten.`;

  try {
    const { getLLMFetchConfig } = await import('./llm-config');
    const config = getLLMFetchConfig();

    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.3,
      }),
    });

    if (!response.ok) throw new Error(`LLM API error: ${response.status}`);
    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || 'Keine Zusammenfassung verfügbar.';

    await prisma.seo_crawl_runs.update({
      where: { id: runId },
      data: { aiSummary: summary },
    });
    return summary;
  } catch (error: any) {
    console.error('AI Summary generation failed:', error);
    return 'AI-Zusammenfassung konnte nicht generiert werden.';
  }
}


// ──────────── Run Comparison ────────────

export interface RunComparison {
  previousRun: { id: string; healthScore: number; startedAt: string; criticalCount: number; warningCount: number; infoCount: number } | null;
  scoreDelta: number;
  newIssues: { type: string; count: number }[];
  fixedIssues: { type: string; count: number }[];
  unchangedIssues: { type: string; count: number }[];
}

export async function compareRuns(currentRunId: string): Promise<RunComparison> {
  const currentRun = await prisma.seo_crawl_runs.findUnique({ where: { id: currentRunId } });
  if (!currentRun) throw new Error('Run not found');

  // Find previous completed run
  const previousRun = await prisma.seo_crawl_runs.findFirst({
    where: { status: 'completed', startedAt: { lt: currentRun.startedAt } },
    orderBy: { startedAt: 'desc' },
    select: { id: true, healthScore: true, startedAt: true, criticalCount: true, warningCount: true, infoCount: true },
  });

  if (!previousRun) {
    return { previousRun: null, scoreDelta: 0, newIssues: [], fixedIssues: [], unchangedIssues: [] };
  }

  // Get issue breakdown for both runs
  const [currentPages, prevPages] = await Promise.all([
    prisma.seo_page_results.findMany({ where: { crawlRunId: currentRunId } }),
    prisma.seo_page_results.findMany({ where: { crawlRunId: previousRun.id } }),
  ]);

  const currentIssues = new Map<string, number>();
  const prevIssues = new Map<string, number>();

  for (const p of currentPages) {
    for (const i of (p.issues as SeoIssue[])) {
      currentIssues.set(i.type, (currentIssues.get(i.type) || 0) + 1);
    }
  }
  for (const p of prevPages) {
    for (const i of (p.issues as SeoIssue[])) {
      prevIssues.set(i.type, (prevIssues.get(i.type) || 0) + 1);
    }
  }

  const allTypes = new Set([...currentIssues.keys(), ...prevIssues.keys()]);
  const newIssues: { type: string; count: number }[] = [];
  const fixedIssues: { type: string; count: number }[] = [];
  const unchangedIssues: { type: string; count: number }[] = [];

  for (const type of allTypes) {
    const curr = currentIssues.get(type) || 0;
    const prev = prevIssues.get(type) || 0;
    if (curr > prev) newIssues.push({ type, count: curr - prev });
    else if (curr < prev) fixedIssues.push({ type, count: prev - curr });
    else if (curr > 0) unchangedIssues.push({ type, count: curr });
  }

  return {
    previousRun: { ...previousRun, startedAt: previousRun.startedAt.toISOString() },
    scoreDelta: currentRun.healthScore - previousRun.healthScore,
    newIssues: newIssues.sort((a, b) => b.count - a.count),
    fixedIssues: fixedIssues.sort((a, b) => b.count - a.count),
    unchangedIssues,
  };
}

// ──────────── CSV Export ────────────

export async function generateCsvExport(runId: string): Promise<string> {
  const pages = await prisma.seo_page_results.findMany({
    where: { crawlRunId: runId },
    orderBy: { url: 'asc' },
  });

  const headers = ['URL', 'Typ', 'Status', 'Titel', 'H1', 'Canonical', 'Robots', 'Ladezeit (ms)', 'JSON-LD', 'Interne Links', 'Issues (Kritisch)', 'Issues (Warnung)', 'Issues (Hinweis)', 'Issue-Details'];

  const rows = pages.map(p => {
    const issues = p.issues as SeoIssue[];
    const critical = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');
    const details = issues.map(i => `[${i.severity}] ${ISSUE_LABELS[i.type] || i.type}: ${i.message}`).join(' | ');

    return [
      p.url,
      p.pageType,
      p.statusCode || '',
      csvEscape(p.title || ''),
      csvEscape(p.h1 || ''),
      p.canonical || '',
      p.robotsMeta || '',
      p.responseTimeMs || '',
      p.hasJsonLd ? 'Ja' : 'Nein',
      p.internalLinks,
      critical.length,
      warnings.length,
      infos.length,
      csvEscape(details),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}
