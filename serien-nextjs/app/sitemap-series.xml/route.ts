import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 1800;

const BASE = 'https://serien.de';

export async function GET(_req: NextRequest) {
  // Only include series that have either:
  //  • at least one published article on the site, OR
  //  • measurable popularity (TMDB popularity ≥ 5) — keeps niche shows
  //    discoverable while excluding 1.4k cast-import-only "Karteileichen".
  const series = await prisma.series.findMany({
    where: {
      OR: [
        { articles: { some: { status: 'published' } } },
        { popularity: { gte: 5 } },
      ],
    },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const urls = series
    .filter((s) => s.slug && !s.slug.startsWith('-'))
    .map((s) => {
      const lm = (s.updatedAt || new Date()).toISOString();
      return `  <url>
    <loc>${BASE}/serie/${s.slug}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${BASE}/serie/${s.slug}/wann-geht-es-weiter</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    },
  });
}
