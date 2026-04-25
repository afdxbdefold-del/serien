/**
 * Crawler stats for the admin dashboard.
 * GET /api/admin/crawler-stats?window=24  → hits for Google-only bots
 *
 * Scope (user decision): Only Google crawlers are tracked in this dashboard.
 *   - Google         = Googlebot + Googlebot-Smartphone hitting non-news paths
 *   - Google News    = Googlebot* hits on news-specific paths (sitemap, /news/*, /feed/gn)
 *                      PLUS legacy Googlebot-News UA (now effectively obsolete)
 *   - Google Discover = no separate user-agent; shares Googlebot-Smartphone
 *
 * Background: Google consolidated its crawler UAs in 2024 — the "Googlebot-News"
 * UA is barely used anymore. The generic Googlebot now crawls news-sitemap.xml
 * and /news/* paths to feed Google News & Discover. We therefore classify by
 * path, not by UA, to reflect actual Google News crawling activity.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

const GOOGLE_BOTS = ['Googlebot', 'Googlebot-Smartphone', 'Googlebot-News'];
const LEGACY_NEWS_UA = 'Googlebot-News';

// Path prefixes that are unambiguously Google News territory.
// Any Googlebot* hit on these = Google News activity.
const NEWS_PATH_PATTERNS: Prisma.crawler_hitsWhereInput[] = [
  { path: '/news-sitemap.xml' },
  { path: { startsWith: '/news/' } },
  { path: '/feed/gn' },
];

// "Is news path" filter for inclusion (OR over patterns).
const NEWS_WHERE: Prisma.crawler_hitsWhereInput = { OR: NEWS_PATH_PATTERNS };

// "NOT news path" filter for the search bucket.
const NOT_NEWS_WHERE: Prisma.crawler_hitsWhereInput = {
  NOT: { OR: NEWS_PATH_PATTERNS },
};

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const windowHours = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get('window') || '24', 10), 1),
    720,
  );
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const baseWhere: Prisma.crawler_hitsWhereInput = {
    createdAt: { gte: since },
    bot: { in: GOOGLE_BOTS },
  };

  const [
    searchAgg,
    newsAgg,
    legacyNewsUaCount,
    totalCount,
    recent,
    newsHits,
  ] = await Promise.all([
    // Google Search: any Googlebot* hit on a non-news path
    prisma.crawler_hits.aggregate({
      where: { ...baseWhere, ...NOT_NEWS_WHERE },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    // Google News (consolidated): any Googlebot* hit on a news path
    prisma.crawler_hits.aggregate({
      where: { ...baseWhere, ...NEWS_WHERE },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    // Diagnostics: how many of the news hits came from the legacy UA
    prisma.crawler_hits.count({
      where: { ...baseWhere, bot: LEGACY_NEWS_UA },
    }),
    prisma.crawler_hits.count({ where: baseWhere }),
    prisma.crawler_hits.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { bot: true, path: true, createdAt: true },
    }),
    // Detailed news hits (for hourly chart + interval calc)
    prisma.crawler_hits.findMany({
      where: { ...baseWhere, ...NEWS_WHERE },
      select: { bot: true, createdAt: true, path: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const categories = [
    {
      id: 'google',
      label: 'Google',
      description: 'Googlebot + Googlebot-Smartphone (Search + Discover, ohne News-Pfade)',
      hits: searchAgg._count._all,
      firstAt: searchAgg._min.createdAt?.toISOString() ?? null,
      lastAt: searchAgg._max.createdAt?.toISOString() ?? null,
    },
    {
      id: 'google-news',
      label: 'Google News',
      description:
        'Hits auf News-Pfade (/news-sitemap.xml, /news/*, /feed/gn). Seit Googles UA-Konsolidierung kommen diese fast ausschließlich von generischem Googlebot.',
      hits: newsAgg._count._all,
      firstAt: newsAgg._min.createdAt?.toISOString() ?? null,
      lastAt: newsAgg._max.createdAt?.toISOString() ?? null,
      legacyUaHits: legacyNewsUaCount,
    },
    {
      id: 'google-discover',
      label: 'Google Discover',
      description: 'Kein separater User-Agent – Discover crawlt über Googlebot-Smartphone',
      hits: searchAgg._count._all, // shares Googlebot-Smartphone
      firstAt: searchAgg._min.createdAt?.toISOString() ?? null,
      lastAt: searchAgg._max.createdAt?.toISOString() ?? null,
      shared: true,
    },
  ];

  // News spotlight: hourly buckets + average interval over the news hits.
  const hourBuckets: Record<string, number> = {};
  for (const h of newsHits) {
    const bucket = h.createdAt.toISOString().slice(0, 13) + ':00';
    hourBuckets[bucket] = (hourBuckets[bucket] || 0) + 1;
  }

  let avgIntervalMinutes: number | null = null;
  if (newsHits.length >= 2) {
    const times = newsHits.map((h) => h.createdAt.getTime()).sort((a, b) => b - a);
    const diffs: number[] = [];
    for (let i = 0; i < times.length - 1; i++) diffs.push(times[i] - times[i + 1]);
    avgIntervalMinutes = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length / 60_000);
  }

  // Top news paths in the window (helps explain where Google News is looking).
  const newsPathBreakdown: Record<string, number> = {};
  for (const h of newsHits) {
    newsPathBreakdown[h.path] = (newsPathBreakdown[h.path] || 0) + 1;
  }
  const topNewsPaths = Object.entries(newsPathBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([path, hits]) => ({ path, hits }));

  return NextResponse.json({
    windowHours,
    generatedAt: new Date().toISOString(),
    totalHits: totalCount,
    categories,
    googleNews: {
      totalHits: newsHits.length,
      legacyUaHits: legacyNewsUaCount,
      lastHitAt: newsHits[0]?.createdAt?.toISOString() ?? null,
      avgIntervalMinutes,
      topPaths: topNewsPaths,
      hourlyBuckets: Object.entries(hourBuckets)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-48)
        .map(([hour, count]) => ({ hour, count })),
    },
    recent: recent.map((r) => ({
      bot: r.bot,
      path: r.path,
      at: r.createdAt.toISOString(),
    })),
  });
}
