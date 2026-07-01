import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { logCrawlerHit } from '@/lib/crawler-logger';
import crypto from 'crypto';

export async function GET() {
  const baseUrl = 'https://serien.de';
  const h = await headers();

  // Log crawler hit (tiny overhead, only logs recognized bots)
  try {
    await logCrawlerHit({
      userAgent: h.get('user-agent'),
      path: '/news-sitemap.xml',
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });
  } catch {}

  // Get articles from last 48 hours only
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Google News: only real news articles, max 48h old.
  // Discover-pipeline articles are the only true "news"; search-only drafts,
  // ranking-listicles, and video-imports are excluded.
  const recentArticles = await prisma.articles.findMany({
    where: {
      status: 'published',
      publishedAt: { gte: fortyEightHoursAgo },
      publishMode: 'DISCOVER',
      isRankingArticle: { not: true },
      OR: [
        { category: { not: 'neue-videos' } },
        { category: null },
      ],
    },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
      updatedAt: true,
      tmdbId: true,
      tmdbType: true,
      ogImageUrl: true,
      heroLocalUrl: true,
    },
    orderBy: {
      publishedAt: 'desc',
    },
  });

  // Determine sitemap-wide last-modified = most recent publishedAt/updatedAt.
  // This is the actual signal Googlebot uses (HTTP Last-Modified + If-Modified-Since).
  let lastModified: Date = new Date(0);
  for (const a of recentArticles) {
    const t = a.updatedAt && a.publishedAt && a.updatedAt > a.publishedAt
      ? a.updatedAt
      : a.publishedAt || a.updatedAt;
    if (t && t > lastModified) lastModified = t;
  }
  if (lastModified.getTime() === 0) lastModified = new Date();

  // RFC 7231 / IMF-fixdate HTTP date format
  const lastModifiedHttp = lastModified.toUTCString();

  // Strong ETag derived from count + newest mtime (changes whenever content changes)
  const etag =
    '"' +
    crypto
      .createHash('sha1')
      .update(`${recentArticles.length}:${lastModified.getTime()}`)
      .digest('hex')
      .slice(0, 16) +
    '"';

  // Conditional request handling: return 304 if client already has the latest copy.
  const ifNoneMatch = h.get('if-none-match');
  const ifModifiedSince = h.get('if-modified-since');
  const etagMatches = ifNoneMatch && ifNoneMatch === etag;
  const sinceMatches = (() => {
    if (!ifModifiedSince) return false;
    const since = Date.parse(ifModifiedSince);
    if (Number.isNaN(since)) return false;
    // HTTP-dates have 1-second granularity; compare truncated to seconds.
    return Math.floor(lastModified.getTime() / 1000) <= Math.floor(since / 1000);
  })();

  if (etagMatches || sinceMatches) {
    return new Response(null, {
      status: 304,
      headers: {
        'Last-Modified': lastModifiedHttp,
        ETag: etag,
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }

  const newsItems = recentArticles.map((article) => {
    // Build image URL with same logic as article page
    const ogImagePath =
      article.ogImageUrl ||
      (article.tmdbId && article.tmdbType
        ? `/img/og/${article.tmdbType}/${article.tmdbId}`
        : article.heroLocalUrl);
    const imageUrl = ogImagePath?.startsWith('http')
      ? ogImagePath
      : ogImagePath
      ? `${baseUrl}${ogImagePath.startsWith('/') ? '' : '/'}${ogImagePath}`
      : null;

    const lastmod =
      article.updatedAt && article.publishedAt && article.updatedAt > article.publishedAt
        ? article.updatedAt
        : article.publishedAt || article.updatedAt || new Date();

    return {
      url: `${baseUrl}/${article.slug}`,
      title: article.title,
      publication_date: (article.publishedAt || new Date()).toISOString(),
      lastmod: lastmod.toISOString(),
      imageUrl,
    };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${newsItems
  .map(
    (item) => `  <url>
    <loc>${item.url}</loc>
    <lastmod>${item.lastmod}</lastmod>
    <news:news>
      <news:publication>
        <news:name>Serien.de</news:name>
        <news:language>de</news:language>
      </news:publication>
      <news:publication_date>${item.publication_date}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
    </news:news>${
      item.imageUrl
        ? `
    <image:image>
      <image:loc>${escapeXml(item.imageUrl)}</image:loc>
      <image:title>${escapeXml(item.title)}</image:title>
    </image:image>`
        : ''
    }
  </url>`,
  )
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Short CDN cache – we want Googlebot to see fresh lastmod quickly after publish.
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Last-Modified': lastModifiedHttp,
      ETag: etag,
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

// Neon-Cost-Sprint: `force-dynamic` + `revalidate=0` entfernt. Google News
// crawlt diesen Endpoint aggressiv (mehrmals pro Minute) — vorher war das
// ein DB-Hit pro Crawl. 5 min ISR liefert immer noch tagesaktuelle News.
export const revalidate = 300;
