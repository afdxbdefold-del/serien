import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 600;

const BASE = 'https://serien.de';

export async function GET(_req: NextRequest) {
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { slug: true, updatedAt: true, publishedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  // Series slugs are excluded so we never emit a duplicate URL across
  // sub-sitemaps; series live under /serie/{slug}.
  const seriesSlugs = new Set(
    (await prisma.series.findMany({ select: { slug: true } })).map((s) => s.slug),
  );

  const urls = articles
    .filter((a) => a.slug && !seriesSlugs.has(a.slug))
    .map((a) => {
      const lm = (a.updatedAt || a.publishedAt || new Date()).toISOString();
      return `  <url>
    <loc>${BASE}/${a.slug}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>weekly</changefreq>
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
      'Cache-Control': 'public, max-age=600, s-maxage=600',
      // Override Next.js auto Vary so Googlebot caches normally.
      Vary: 'Accept-Encoding',
    },
  });
}
