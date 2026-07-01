import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Neon-Cost-Sprint: `force-dynamic` entfernt (override von revalidate).
export const revalidate = 21600;

const BASE = 'https://serien.de';

export async function GET(_req: NextRequest) {
  // Only persons with substantial bio (>100 chars) match the noindex policy.
  const persons = await prisma.persons.findMany({
    where: { biography: { not: null } },
    select: { slug: true, updatedAt: true, biography: true },
    orderBy: { updatedAt: 'desc' },
  });

  const urls = persons
    .filter((p) => p.slug && p.biography && p.biography.length > 100)
    .map((p) => {
      const lm = (p.updatedAt || new Date()).toISOString();
      return `  <url>
    <loc>${BASE}/person/${p.slug}</loc>
    <lastmod>${lm}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
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
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
