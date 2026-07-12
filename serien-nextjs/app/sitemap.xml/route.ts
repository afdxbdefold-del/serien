import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { logCrawlerHit } from '@/lib/crawler-logger';

/**
 * Sitemap index — points to topic-split sub-sitemaps.
 * Replaces the old single 6k-URL sitemap with semantic groups so Google
 * can prioritise indexing per content type.
 */

// Neon-Cost-Sprint: `force-dynamic` entfernt — hat `revalidate` override.
// Jetzt: ISR, DB wird alle 6 h einmal befragt statt bei jedem Crawler-Ping.
export const revalidate = 21600;

const BASE = 'https://serien.de';

async function lastmod(query: () => Promise<{ updatedAt: Date | null } | null>): Promise<string> {
  try {
    const row = await query();
    const t = row?.updatedAt ? row.updatedAt.toISOString() : new Date().toISOString();
    return t;
  } catch {
    return new Date().toISOString();
  }
}

export async function GET(request: NextRequest) {
  try {
    const h = request.headers;
    await logCrawlerHit({
      userAgent: h.get('user-agent'),
      path: '/sitemap.xml',
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    });
  } catch {}

  // Real lastmod per sub-sitemap = latest updatedAt within that group.
  // sitemap-persons.xml Feb 2026 entfernt — Person-Seiten sind noindex,nofollow
  // (kein organischer Traffic-Wert), keine Crawl-Anreize mehr geben.
  const [articleLm, seriesLm, charLm] = await Promise.all([
    lastmod(() => prisma.articles.findFirst({ where: { status: 'published' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })),
    lastmod(() => prisma.series.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })),
    lastmod(() => prisma.characters.findFirst({ where: { publishStatus: 'published' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } })),
  ]);

  const subsites: Array<{ loc: string; lastmod: string }> = [
    { loc: `${BASE}/sitemap-news.xml`, lastmod: articleLm },
    { loc: `${BASE}/sitemap-series.xml`, lastmod: seriesLm },
    { loc: `${BASE}/sitemap-characters.xml`, lastmod: charLm },
    { loc: `${BASE}/sitemap-static.xml`, lastmod: articleLm },
    { loc: `${BASE}/news-sitemap.xml`, lastmod: articleLm },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${subsites.map((s) => `  <sitemap>
    <loc>${s.loc}</loc>
    <lastmod>${s.lastmod}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  });
}
