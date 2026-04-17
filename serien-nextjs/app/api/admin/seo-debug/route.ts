import { NextRequest, NextResponse } from 'next/server';
import { load as cheerioLoad } from 'cheerio';

// Googlebot User-Agents (Mobile + Desktop)
const GOOGLEBOT_MOBILE_UA = 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const GOOGLEBOT_DESKTOP_UA = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/131.0.6778.69 Safari/537.36';

interface SeoCheckResult {
  url: string;
  timestamp: string;
  httpStatus: number;
  ttfb: number;
  renderTime: number;
  raw: {
    title: string;
    metaDescription: string;
    h1: string;
    wordCount: number;
    textContent: string;
  };
  rendered: {
    title: string;
    metaDescription: string;
    h1: string;
    wordCount: number;
    textContent: string;
  } | null;
  seoChecks: {
    h1Present: boolean;
    titlePresent: boolean;
    metaDescriptionPresent: boolean;
    contentInRawHtml: boolean;
    canonicalCorrect: boolean;
    canonical: string | null;
    robotsMeta: string | null;
    noindexDetected: boolean;
    jsonLdPresent: boolean;
    jsonLdTypes: string[];
    lazyLoadedContent: boolean;
    ogImage: string | null;
    ogTitle: string | null;
  };
  contentDiff: {
    rawWords: number;
    renderedWords: number;
    diffPercent: number;
    contentOnlyViaJs: boolean;
  };
  errors: string[];
  warnings: string[];
  score: number;
  screenshots: {
    raw: string | null;
    rendered: string | null;
  };
}

function extractSeoData(html: string) {
  const $ = cheerioLoad(html);

  // Remove script/style/nav/footer for text extraction
  const $content = $.root().clone();
  $content.find('script, style, noscript, nav, footer, header').remove();

  const textContent = $content.text().replace(/\s+/g, ' ').trim();
  const words = textContent.split(/\s+/).filter(w => w.length > 1);

  // JSON-LD
  const jsonLdScripts: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const content = $(el).html();
    if (content) jsonLdScripts.push(content);
  });
  const jsonLdTypes: string[] = [];
  for (const script of jsonLdScripts) {
    try {
      const data = JSON.parse(script);
      if (data['@type']) jsonLdTypes.push(data['@type']);
    } catch {}
  }

  // Robots meta
  const robotsMeta = $('meta[name="robots"]').attr('content') || null;
  const googlebotMeta = $('meta[name="googlebot"]').attr('content') || null;

  // Noindex check
  const noindex = (robotsMeta || '').toLowerCase().includes('noindex') ||
    (googlebotMeta || '').toLowerCase().includes('noindex');

  // Canonical
  const canonical = $('link[rel="canonical"]').attr('href') || null;

  // OG
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const ogTitle = $('meta[property="og:title"]').attr('content') || null;

  // Lazy load detection
  const lazyImages = $('img[loading="lazy"]').length;
  const totalImages = $('img').length;

  return {
    title: $('title').text().trim(),
    metaDescription: $('meta[name="description"]').attr('content')?.trim() || '',
    h1: $('h1').first().text().trim(),
    wordCount: words.length,
    textContent: textContent.substring(0, 5000),
    canonical,
    robotsMeta: robotsMeta || googlebotMeta,
    noindex,
    jsonLdPresent: jsonLdScripts.length > 0,
    jsonLdTypes,
    ogImage,
    ogTitle,
    lazyLoadedContent: lazyImages > 0 && lazyImages === totalImages,
  };
}

async function fetchRawHtml(url: string): Promise<{ html: string; status: number; ttfb: number }> {
  const start = Date.now();
  const response = await fetch(url, {
    headers: {
      'User-Agent': GOOGLEBOT_MOBILE_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  });
  const ttfb = Date.now() - start;
  const html = await response.text();
  return { html, status: response.status, ttfb };
}

async function fetchRenderedHtml(url: string): Promise<{ html: string; renderTime: number; screenshotRaw: string | null; screenshotRendered: string | null; blockedResources: string[]; loadedResources: number }> {
  try {
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    // Googlebot Mobile viewport (Nexus 5X)
    const context = await browser.newContext({
      userAgent: GOOGLEBOT_MOBILE_UA,
      viewport: { width: 412, height: 732 },
      deviceScaleFactor: 2.625,
      isMobile: true,
      hasTouch: true,
      locale: 'de-DE',
      // WICHTIG: Keine Ressourcen blockieren — Googlebot lädt alles
      javaScriptEnabled: true,
    });
    const page = await context.newPage();

    // Track loaded resources (Googlebot blocks nichts)
    const loadedResources: string[] = [];
    const blockedResources: string[] = [];
    page.on('response', (response) => {
      loadedResources.push(response.url());
    });
    page.on('requestfailed', (request) => {
      blockedResources.push(`${request.url()} (${request.failure()?.errorText || 'unknown'})`);
    });

    const start = Date.now();

    // Phase 1: Initial HTML load (wie Googlebots erster Crawl-Pass)
    await page.goto(url, { waitUntil: 'commit', timeout: 15000 });
    const screenshotRawBuf = await page.screenshot({ type: 'jpeg', quality: 40, fullPage: false });
    const screenshotRaw = `data:image/jpeg;base64,${screenshotRawBuf.toString('base64')}`;

    // Phase 2: Volles Rendering (wie Googlebots Web Rendering Service)
    // Googlebot wartet auf networkidle + gibt JS 5s zum Ausführen
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    // Extra warten für lazy JS-Frameworks
    await page.waitForTimeout(1000);
    const renderTime = Date.now() - start;

    const screenshotRenderedBuf = await page.screenshot({ type: 'jpeg', quality: 40, fullPage: false });
    const screenshotRendered = `data:image/jpeg;base64,${screenshotRenderedBuf.toString('base64')}`;

    const html = await page.content();

    await browser.close();

    return { html, renderTime, screenshotRaw, screenshotRendered, blockedResources, loadedResources: loadedResources.length };
  } catch (error: any) {
    console.error('Playwright rendering failed:', error.message);
    return { html: '', renderTime: 0, screenshotRaw: null, screenshotRendered: null, blockedResources: [], loadedResources: 0 };
  }
}

function calculateScore(result: Omit<SeoCheckResult, 'score'>): number {
  let score = 0;

  // Content im HTML: 40%
  if (result.raw.wordCount >= 500) score += 40;
  else if (result.raw.wordCount >= 200) score += 25;
  else if (result.raw.wordCount >= 50) score += 10;

  // Ladezeit: 20%
  if (result.ttfb < 500) score += 20;
  else if (result.ttfb < 1000) score += 15;
  else if (result.ttfb < 2000) score += 10;
  else if (result.ttfb < 3000) score += 5;

  // Struktur: 20%
  if (result.seoChecks.h1Present) score += 5;
  if (result.seoChecks.titlePresent) score += 5;
  if (result.seoChecks.metaDescriptionPresent) score += 3;
  if (result.seoChecks.jsonLdPresent) score += 4;
  if (result.seoChecks.canonicalCorrect) score += 3;

  // Rendering-Differenz: 20%
  if (result.contentDiff.diffPercent < 5) score += 20;
  else if (result.contentDiff.diffPercent < 15) score += 15;
  else if (result.contentDiff.diffPercent < 30) score += 10;
  else if (result.contentDiff.diffPercent < 50) score += 5;

  return Math.min(100, Math.max(0, score));
}

async function analyzeUrl(url: string): Promise<SeoCheckResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Fetch raw HTML
  const { html: rawHtml, status: httpStatus, ttfb } = await fetchRawHtml(url);
  const rawData = extractSeoData(rawHtml);

  // 2. Fetch rendered HTML via Playwright (Googlebot WRS simulation)
  const { html: renderedHtml, renderTime, screenshotRaw, screenshotRendered, blockedResources, loadedResources } = await fetchRenderedHtml(url);
  const renderedData = renderedHtml ? extractSeoData(renderedHtml) : null;

  // 3. SEO checks
  const contentInRawHtml = rawData.wordCount >= 100;
  if (!contentInRawHtml) errors.push('Raw HTML hat weniger als 100 Wörter — Content wird vermutlich per JS geladen');
  if (rawData.wordCount < 500) warnings.push(`Raw HTML: nur ${rawData.wordCount} Wörter (empfohlen: 500+)`);
  if (!rawData.h1) errors.push('Kein H1-Tag im Raw HTML gefunden');
  if (!rawData.title) errors.push('Title-Tag ist leer oder fehlt');
  if (!rawData.metaDescription) warnings.push('Meta Description fehlt');
  if (rawData.noindex) errors.push('NOINDEX erkannt — Seite wird nicht indexiert');
  if (!rawData.jsonLdPresent) warnings.push('Keine strukturierten Daten (JSON-LD) gefunden');
  if (renderTime > 3000) errors.push(`Renderzeit zu lang: ${renderTime}ms (max: 3000ms)`);
  if (rawData.lazyLoadedContent) warnings.push('Alle Bilder sind lazy-loaded — erstes Bild sollte eager sein');
  if (blockedResources.length > 0) warnings.push(`${blockedResources.length} Ressource(n) fehlgeschlagen: ${blockedResources.slice(0, 3).join(', ')}`);
  if (loadedResources > 0) {
    // Info only
  }

  // Canonical check
  const canonicalCorrect = rawData.canonical ? rawData.canonical === url || rawData.canonical === url.replace(/\/$/, '') : false;
  if (rawData.canonical && !canonicalCorrect) warnings.push(`Canonical (${rawData.canonical}) stimmt nicht mit URL überein`);
  if (!rawData.canonical) warnings.push('Kein Canonical-Tag gesetzt');

  // Content diff
  const renderedWords = renderedData?.wordCount || 0;
  const diffPercent = rawData.wordCount > 0
    ? Math.round(Math.abs(renderedWords - rawData.wordCount) / Math.max(renderedWords, rawData.wordCount) * 100)
    : renderedWords > 0 ? 100 : 0;
  const contentOnlyViaJs = rawData.wordCount < 100 && renderedWords >= 100;
  if (contentOnlyViaJs) errors.push('Content kommt NUR per JavaScript — Googlebot sieht möglicherweise leere Seite');

  const seoChecks = {
    h1Present: !!rawData.h1,
    titlePresent: !!rawData.title,
    metaDescriptionPresent: !!rawData.metaDescription,
    contentInRawHtml,
    canonicalCorrect,
    canonical: rawData.canonical,
    robotsMeta: rawData.robotsMeta,
    noindexDetected: rawData.noindex,
    jsonLdPresent: rawData.jsonLdPresent,
    jsonLdTypes: rawData.jsonLdTypes,
    lazyLoadedContent: rawData.lazyLoadedContent,
    ogImage: rawData.ogImage,
    ogTitle: rawData.ogTitle,
  };

  const contentDiff = {
    rawWords: rawData.wordCount,
    renderedWords,
    diffPercent,
    contentOnlyViaJs,
  };

  const partial: Omit<SeoCheckResult, 'score'> = {
    url,
    timestamp: new Date().toISOString(),
    httpStatus,
    ttfb,
    renderTime,
    raw: {
      title: rawData.title,
      metaDescription: rawData.metaDescription,
      h1: rawData.h1,
      wordCount: rawData.wordCount,
      textContent: rawData.textContent,
    },
    rendered: renderedData ? {
      title: renderedData.title,
      metaDescription: renderedData.metaDescription,
      h1: renderedData.h1,
      wordCount: renderedData.wordCount,
      textContent: renderedData.textContent,
    } : null,
    seoChecks,
    contentDiff,
    errors,
    warnings,
    screenshots: {
      raw: screenshotRaw,
      rendered: screenshotRendered,
    },
  };

  return { ...partial, score: calculateScore(partial) };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls } = body as { urls: string[] };

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'urls array required' }, { status: 400 });
    }

    if (urls.length > 20) {
      return NextResponse.json({ error: 'Max 20 URLs pro Request' }, { status: 400 });
    }

    // Single URL: full analysis with screenshots
    if (urls.length === 1) {
      const result = await analyzeUrl(urls[0]);
      return NextResponse.json({ results: [result] });
    }

    // Bulk: sequential without screenshots for speed
    const results: SeoCheckResult[] = [];
    for (const url of urls) {
      try {
        const { html, status, ttfb } = await fetchRawHtml(url);
        const rawData = extractSeoData(html);

        const errors: string[] = [];
        const warnings: string[] = [];
        if (rawData.wordCount < 100) errors.push('Zu wenig Content im HTML');
        if (!rawData.h1) errors.push('Kein H1');
        if (!rawData.title) errors.push('Kein Title');
        if (rawData.noindex) errors.push('NOINDEX');

        const seoChecks = {
          h1Present: !!rawData.h1,
          titlePresent: !!rawData.title,
          metaDescriptionPresent: !!rawData.metaDescription,
          contentInRawHtml: rawData.wordCount >= 100,
          canonicalCorrect: !!rawData.canonical,
          canonical: rawData.canonical,
          robotsMeta: rawData.robotsMeta,
          noindexDetected: rawData.noindex,
          jsonLdPresent: rawData.jsonLdPresent,
          jsonLdTypes: rawData.jsonLdTypes,
          lazyLoadedContent: rawData.lazyLoadedContent,
          ogImage: rawData.ogImage,
          ogTitle: rawData.ogTitle,
        };

        const partial = {
          url,
          timestamp: new Date().toISOString(),
          httpStatus: status,
          ttfb,
          renderTime: 0,
          raw: { title: rawData.title, metaDescription: rawData.metaDescription, h1: rawData.h1, wordCount: rawData.wordCount, textContent: '' },
          rendered: null,
          seoChecks,
          contentDiff: { rawWords: rawData.wordCount, renderedWords: 0, diffPercent: 0, contentOnlyViaJs: false },
          errors,
          warnings,
          screenshots: { raw: null, rendered: null },
        };

        results.push({ ...partial, score: calculateScore(partial) });
      } catch (error: any) {
        results.push({
          url,
          timestamp: new Date().toISOString(),
          httpStatus: 0,
          ttfb: 0,
          renderTime: 0,
          raw: { title: '', metaDescription: '', h1: '', wordCount: 0, textContent: '' },
          rendered: null,
          seoChecks: { h1Present: false, titlePresent: false, metaDescriptionPresent: false, contentInRawHtml: false, canonicalCorrect: false, canonical: null, robotsMeta: null, noindexDetected: false, jsonLdPresent: false, jsonLdTypes: [], lazyLoadedContent: false, ogImage: null, ogTitle: null },
          contentDiff: { rawWords: 0, renderedWords: 0, diffPercent: 0, contentOnlyViaJs: false },
          errors: [`Fetch fehlgeschlagen: ${error.message}`],
          warnings: [],
          score: 0,
          screenshots: { raw: null, rendered: null },
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
