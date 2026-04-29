import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { GENRES, STREAMERS, DECADES } from '@/app/serien/_lib';
import { STREAMERS as NEWS_STREAMERS, KINDS as NEWS_KINDS } from '@/app/news/_lib';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const BASE = 'https://serien.de';

interface StaticEntry {
  loc: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  /** Optional: derive lastmod from this DB query — falls back to "now" on error. */
  derive?: () => Promise<Date | null>;
}

const STATIC_PAGES: StaticEntry[] = [
  // Flagship hubs — derive lastmod from the latest article so they reflect real freshness.
  { loc: '/',                          changefreq: 'daily',   priority: 1.0,  derive: latestArticle },
  { loc: '/news',                      changefreq: 'hourly',  priority: 0.95, derive: latestArticle },
  { loc: '/top-10',                    changefreq: 'daily',   priority: 0.95, derive: latestSeries },
  { loc: '/serien',                    changefreq: 'daily',   priority: 0.92, derive: latestSeries },
  { loc: '/top-100-serien',            changefreq: 'daily',   priority: 0.9,  derive: latestSeries },
  { loc: '/top-100-netflix',           changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/top-100-amazon-prime',      changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/top-100-disney-plus',       changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/beste-crime-serien',        changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/beste-comedy-serien',       changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/beste-drama-serien',        changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/beste-mystery-serien',      changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/beste-sci-fi-serien',       changefreq: 'daily',   priority: 0.85, derive: latestSeries },
  { loc: '/serienfinder',              changefreq: 'daily',   priority: 0.8,  derive: latestSeries },
  { loc: '/neue-serien',               changefreq: 'daily',   priority: 0.8,  derive: latestRelease },
  { loc: '/personen',                  changefreq: 'weekly',  priority: 0.7,  derive: latestPerson },
  { loc: '/figuren',                   changefreq: 'weekly',  priority: 0.7,  derive: latestCharacter },
  { loc: '/autoren',                   changefreq: 'monthly', priority: 0.5,  derive: latestUser },
  { loc: '/about',                     changefreq: 'monthly', priority: 0.5 },
  { loc: '/redaktionelle-richtlinien', changefreq: 'yearly',  priority: 0.4 },
  { loc: '/nutzungsbedingungen',       changefreq: 'yearly',  priority: 0.3 },
  { loc: '/impressum',                 changefreq: 'yearly',  priority: 0.3 },
  { loc: '/datenschutz',               changefreq: 'yearly',  priority: 0.3 },
];

// Append /serien/{genre|streamer|jahrzehnt}/* sub-routes for SEO indexing.
GENRES.forEach((g) =>
  STATIC_PAGES.push({ loc: `/serien/genre/${g.slug}`, changefreq: 'daily', priority: 0.78, derive: latestSeries })
);
STREAMERS.forEach((s) =>
  STATIC_PAGES.push({ loc: `/serien/streamer/${s.slug}`, changefreq: 'daily', priority: 0.78, derive: latestSeries })
);
DECADES.forEach((d) =>
  STATIC_PAGES.push({ loc: `/serien/jahrzehnt/${d}er`, changefreq: 'weekly', priority: 0.7, derive: latestSeries })
);

// Append /news/{streamer|kind} sub-routes
NEWS_STREAMERS.forEach((s) =>
  STATIC_PAGES.push({ loc: `/news/${s.slug}`, changefreq: 'hourly', priority: 0.85, derive: latestArticle })
);
NEWS_KINDS.forEach((k) =>
  STATIC_PAGES.push({ loc: `/news/${k.slug}`, changefreq: 'daily', priority: 0.75, derive: latestArticle })
);

async function latestArticle(): Promise<Date | null> {
  const r = await prisma.articles.findFirst({ where: { status: 'published' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
  return r?.updatedAt ?? null;
}
async function latestSeries(): Promise<Date | null> {
  const r = await prisma.series.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
  return r?.updatedAt ?? null;
}
async function latestRelease(): Promise<Date | null> {
  const r = await prisma.streaming_releases.findFirst({ orderBy: { fetchedAt: 'desc' }, select: { fetchedAt: true } });
  return r?.fetchedAt ?? null;
}
async function latestCharacter(): Promise<Date | null> {
  const r = await prisma.characters.findFirst({ where: { publishStatus: 'published' }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
  return r?.updatedAt ?? null;
}
async function latestPerson(): Promise<Date | null> {
  const r = await prisma.persons.findFirst({ where: { biography: { not: null } }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
  return r?.updatedAt ?? null;
}
async function latestUser(): Promise<Date | null> {
  try {
    const r = await (prisma as any).users.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } });
    return r?.updatedAt ?? null;
  } catch {
    return null;
  }
}

export async function GET(_req: NextRequest) {
  const entries = await Promise.all(
    STATIC_PAGES.map(async (page) => {
      let lm: Date | null = null;
      if (page.derive) {
        try {
          lm = await page.derive();
        } catch {}
      }
      return {
        ...page,
        lastmod: (lm ?? new Date()).toISOString(),
      };
    }),
  );

  const urls = entries.map((e) => `  <url>
    <loc>${BASE}${e.loc === '/' ? '' : e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');

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
