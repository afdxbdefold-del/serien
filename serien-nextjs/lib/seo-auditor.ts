/**
 * SEO Auditor Engine
 * 
 * Database-driven SEO audit for serien.de
 * Checks: duplicates, conflicts, missing fields, broken links, news requirements
 */

import prisma from './prisma';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';

// ──────────── Types ────────────

export interface SeoIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

export const ISSUE_LABELS: Record<string, string> = {
  hub_article_conflict: 'Hub/Artikel Slug-Konflikt',
  duplicate_title: 'Doppelter Titel',
  duplicate_meta_description: 'Doppelte Meta-Description',
  duplicate_content: 'Doppelter Inhalt',
  missing_canonical: 'Fehlende Canonical-URL',
  missing_meta_description: 'Fehlende Meta-Description',
  missing_publish_date: 'Fehlendes Veröffentlichungsdatum',
  missing_author: 'Fehlender Autor',
  missing_hero_image: 'Fehlendes Hero-Bild',
  missing_source: 'Fehlende Quellenangabe',
  missing_excerpt: 'Fehlender Teaser/Excerpt',
  thin_content: 'Dünner Inhalt (< 300 Wörter)',
  broken_internal_link: 'Kaputter interner Link',
  orphan_article: 'Verwaister Artikel (keine Serie)',
  duplicate_slug: 'Doppelter Slug',
  missing_image_attribution: 'Fehlende Bildquelle',
  stale_article: 'Veralteter Artikel (> 90 Tage ohne Update)',
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

// ──────────── Main Audit ────────────

export async function runFullAudit(trigger: string = 'manual'): Promise<string> {
  const runId = randomUUID();

  await prisma.seo_crawl_runs.create({
    data: { id: runId, status: 'running', trigger },
  });

  try {
    // ── Step 1: Fetch all data ──
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

    // ── Step 2: Build duplicate detection maps ──
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

    // Build set of all valid internal paths
    const validPaths = new Set<string>();
    validPaths.add('/');
    validPaths.add('/trending');
    validPaths.add('/about');
    validPaths.add('/impressum');
    validPaths.add('/datenschutz');
    validPaths.add('/autoren');
    validPaths.add('/neue-serien');
    validPaths.add('/kalender');
    validPaths.add('/nutzungsbedingungen');
    validPaths.add('/redaktionelle-richtlinien');
    validPaths.add('/serienfinder');
    for (const a of articles) validPaths.add(`/${a.slug}`);
    for (const s of allSeries) {
      validPaths.add(`/serie/${s.slug}`);
    }
    // Streamer pages
    const streamerPages = [
      'netflix-serien', 'disney-plus-serien', 'prime-video-serien',
      'apple-tv-serien', 'paramount-plus-serien', 'wow-serien',
      'rtl-plus-serien', 'joyn-serien', 'magenta-tv-serien',
      'crunchyroll-serien', 'ard-mediathek-serien', 'zdf-mediathek-serien',
      'hbo-serien', 'discovery-plus-serien', 'maxdome-serien',
      'freenet-video-serien', 'rakuten-tv-serien', 'chili-serien',
    ];
    for (const s of streamerPages) validPaths.add(`/${s}`);
    // Also add /serie as a valid prefix
    validPaths.add('/serie');
    validPaths.add('/neue-videos');
    validPaths.add('/onboarding');
    validPaths.add('/einstellungen');

    // ── Step 3: Audit each article ──
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

      // ── Hub vs Article conflict ──
      if (seriesSlugs.has(article.slug)) {
        issues.push({
          type: 'hub_article_conflict',
          severity: 'warning',
          message: `Slug "/${article.slug}" kollidiert mit Serie /serie/${article.slug}`,
          details: '308 Redirect aktiv. Google sollte korrekt umgeleitet werden.',
        });
      }

      // ── Duplicate title ──
      const titleKey = article.title.toLowerCase().trim();
      const titleDupes = titleMap.get(titleKey) || [];
      if (titleDupes.length > 1) {
        issues.push({
          type: 'duplicate_title',
          severity: 'warning',
          message: `Titel "${article.title}" wird ${titleDupes.length}x verwendet`,
          details: titleDupes.filter(s => s !== article.slug).join(', '),
        });
      }

      // ── Duplicate meta description ──
      const descKey = (desc || '').toLowerCase().trim();
      if (descKey.length > 20) {
        const descDupes = descMap.get(descKey) || [];
        if (descDupes.length > 1) {
          issues.push({
            type: 'duplicate_meta_description',
            severity: 'warning',
            message: `Meta-Description wird ${descDupes.length}x verwendet`,
            details: descDupes.filter(s => s !== article.slug).join(', '),
          });
        }
      }

      // ── Duplicate content ──
      if (contentHash) {
        const contentDupes = hashMap.get(contentHash) || [];
        if (contentDupes.length > 1) {
          issues.push({
            type: 'duplicate_content',
            severity: 'critical',
            message: `Inhalt ist identisch mit ${contentDupes.length - 1} anderen Artikeln`,
            details: contentDupes.filter(s => s !== article.slug).join(', '),
          });
        }
      }

      // ── Missing meta description ──
      if (!desc || desc.length < 50) {
        issues.push({
          type: 'missing_meta_description',
          severity: 'warning',
          message: desc ? 'Meta-Description zu kurz (< 50 Zeichen)' : 'Keine Meta-Description',
        });
      }

      // ── Missing publish date ──
      if (!article.publishedAt) {
        issues.push({
          type: 'missing_publish_date',
          severity: 'warning',
          message: 'Kein Veröffentlichungsdatum gesetzt',
        });
      }

      // ── Missing author ──
      if (!article.users?.name) {
        issues.push({
          type: 'missing_author',
          severity: 'warning',
          message: 'Kein Autor zugewiesen',
        });
      }

      // ── Missing hero image ──
      if (!article.heroImageUrl && !article.heroLocalUrl && !article.heroImagePath) {
        issues.push({
          type: 'missing_hero_image',
          severity: 'warning',
          message: 'Kein Hero-Bild vorhanden',
        });
      }

      // ── Missing excerpt ──
      if (!article.excerpt || article.excerpt.length < 20) {
        issues.push({
          type: 'missing_excerpt',
          severity: 'info',
          message: 'Kein oder zu kurzer Teaser/Excerpt',
        });
      }

      // ── Thin content ──
      if (wordCount < 300) {
        issues.push({
          type: 'thin_content',
          severity: 'warning',
          message: `Nur ${wordCount} Wörter (Minimum: 300)`,
        });
      }

      // ── Missing source ──
      if (!article.sourceUrl) {
        issues.push({
          type: 'missing_source',
          severity: 'info',
          message: 'Keine Quellenangabe (sourceUrl)',
        });
      }

      // ── Orphan article (no series linked) ──
      if (!article.primarySeriesId) {
        issues.push({
          type: 'orphan_article',
          severity: 'info',
          message: 'Nicht mit einer Serie verknüpft',
        });
      }

      // ── Broken internal links ──
      for (const linkPath of links) {
        // Skip dynamic paths like /genre/*, /autor/*, /figur/*, /person/*
        const dynamicPrefixes = ['/genre/', '/autor/', '/figur/', '/person/', '/figuren/', '/personen/', '/streamer/', '/admin/', '/api/', '/auth/', '/einstellungen/'];
        const isDynamic = dynamicPrefixes.some(p => linkPath.startsWith(p));
        if (isDynamic) continue;

        if (!validPaths.has(linkPath) && !linkPath.startsWith('/serie/')) {
          // Check if it's a valid article slug
          const slug = linkPath.replace(/^\//, '');
          if (!articleSlugs.has(slug) && !seriesSlugs.has(slug)) {
            issues.push({
              type: 'broken_internal_link',
              severity: 'warning',
              message: `Kaputter Link: ${linkPath}`,
              details: `Ziel existiert weder als Artikel noch als Serie`,
            });
          }
        }
      }

      // ── Stale article ──
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      if (article.updatedAt && new Date(article.updatedAt) < ninetyDaysAgo) {
        issues.push({
          type: 'stale_article',
          severity: 'info',
          message: 'Seit über 90 Tagen nicht aktualisiert',
        });
      }

      // Count severities
      for (const issue of issues) {
        if (issue.severity === 'critical') criticalCount++;
        else if (issue.severity === 'warning') warningCount++;
        else infoCount++;
      }

      pageResults.push({
        id: randomUUID(),
        crawlRunId: runId,
        url,
        pageType: 'article',
        title: article.title,
        metaDescription: desc,
        canonical,
        contentHash,
        internalLinks: links.length,
        issues,
      });
    }

    // ── Step 4: Audit series pages ──
    for (const s of allSeries) {
      const issues: SeoIssue[] = [];
      const url = `${baseUrl}/serie/${s.slug}`;

      // Check if series slug also matches an article slug
      if (articleSlugs.has(s.slug)) {
        issues.push({
          type: 'hub_article_conflict',
          severity: 'warning',
          message: `Serie /serie/${s.slug} kollidiert mit Artikel /${s.slug}`,
          details: '308 Redirect sollte aktiv sein.',
        });
      }

      if (!s.title || s.title.length < 2) {
        issues.push({
          type: 'missing_meta_description',
          severity: 'warning',
          message: 'Serie ohne aussagekräftigen Titel',
        });
      }

      for (const issue of issues) {
        if (issue.severity === 'critical') criticalCount++;
        else if (issue.severity === 'warning') warningCount++;
        else infoCount++;
      }

      if (issues.length > 0) {
        pageResults.push({
          id: randomUUID(),
          crawlRunId: runId,
          url,
          pageType: 'series',
          title: s.title,
          metaDescription: null,
          canonical: url,
          contentHash: null,
          internalLinks: 0,
          issues,
        });
      }
    }

    // ── Step 5: Calculate health score ──
    // Percentage-based: how many pages are clean vs have issues
    const totalPages = articles.length + allSeries.length;
    const pagesWithCritical = new Set(pageResults.filter(p => p.issues.some(i => i.severity === 'critical')).map(p => p.url)).size;
    const pagesWithWarning = new Set(pageResults.filter(p => p.issues.some(i => i.severity === 'warning' && !p.issues.some(j => j.severity === 'critical'))).map(p => p.url)).size;
    const cleanPages = totalPages - pagesWithCritical - pagesWithWarning;
    
    // Weighted: clean=100%, warning=60%, critical=20%
    const healthScore = Math.max(0, Math.min(100, Math.round(
      ((cleanPages * 100) + (pagesWithWarning * 60) + (pagesWithCritical * 20)) / totalPages
    )));

    // ── Step 6: Store results ──
    // Batch insert page results
    const pagesWithIssues = pageResults.filter(p => p.issues.length > 0);

    if (pagesWithIssues.length > 0) {
      await prisma.seo_page_results.createMany({
        data: pagesWithIssues.map(p => ({
          id: p.id,
          crawlRunId: p.crawlRunId,
          url: p.url,
          pageType: p.pageType,
          title: p.title,
          metaDescription: p.metaDescription,
          canonical: p.canonical,
          contentHash: p.contentHash,
          internalLinks: p.internalLinks,
          issues: p.issues as any,
        })),
      });
    }

    await prisma.seo_crawl_runs.update({
      where: { id: runId },
      data: {
        status: 'completed',
        totalPages,
        issuesFound: criticalCount + warningCount + infoCount,
        criticalCount,
        warningCount,
        infoCount,
        healthScore,
        completedAt: new Date(),
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

  // Build issue summary
  const issuesByType: Record<string, number> = {};
  const criticalUrls: string[] = [];

  for (const page of run.pages) {
    const issues = page.issues as SeoIssue[];
    for (const issue of issues) {
      issuesByType[issue.type] = (issuesByType[issue.type] || 0) + 1;
      if (issue.severity === 'critical') {
        criticalUrls.push(page.url);
      }
    }
  }

  const prompt = `Du bist SEO-Experte für die deutsche News-Website serien.de.

Hier sind die Ergebnisse des letzten SEO-Audits:

Health Score: ${run.healthScore}/100
Geprüfte Seiten: ${run.totalPages}
Kritische Fehler: ${run.criticalCount}
Warnungen: ${run.warningCount}
Hinweise: ${run.infoCount}

Issue-Verteilung:
${Object.entries(issuesByType).map(([type, count]) => `- ${ISSUE_LABELS[type] || type}: ${count}`).join('\n')}

${criticalUrls.length > 0 ? `Kritische URLs (Beispiele):\n${criticalUrls.slice(0, 10).join('\n')}` : ''}

Erstelle eine kurze, handlungsorientierte Zusammenfassung (3-5 Sätze) auf Deutsch. Nenne die Top-3-Prioritäten zur Verbesserung des SEO-Scores.`;

  try {
    const { getLLMFetchConfig } = await import('./llm-config');
    const config = getLLMFetchConfig();

    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

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
