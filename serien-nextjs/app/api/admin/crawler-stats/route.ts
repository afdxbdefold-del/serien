/**
 * Crawler stats for the admin dashboard.
 * GET /api/admin/crawler-stats?window=24  → hits for Google-only bots
 *
 * Scope (user decision): Only Google crawlers are tracked in this dashboard.
 *   - Google        = Googlebot + Googlebot-Smartphone (Search crawler, also feeds Discover)
 *   - Google News   = Googlebot-News
 *   - Google Discover = no separate user-agent; shares Googlebot-Smartphone
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

// Raw bot-IDs that belong to each logical "category" shown in the UI.
const GOOGLE_SEARCH_BOTS = ['Googlebot', 'Googlebot-Smartphone'];
const GOOGLE_NEWS_BOTS = ['Googlebot-News'];
const TRACKED_BOTS = [...GOOGLE_SEARCH_BOTS, ...GOOGLE_NEWS_BOTS];

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

  const [byBot, recent, totalCount] = await Promise.all([
    prisma.crawler_hits.groupBy({
      by: ['bot'],
      where: { createdAt: { gte: since }, bot: { in: TRACKED_BOTS } },
      _count: { _all: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    }),
    prisma.crawler_hits.findMany({
      where: { createdAt: { gte: since }, bot: { in: TRACKED_BOTS } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { bot: true, path: true, createdAt: true },
    }),
    prisma.crawler_hits.count({
      where: { createdAt: { gte: since }, bot: { in: TRACKED_BOTS } },
    }),
  ]);

  // Aggregate into three logical categories for the UI.
  type Agg = { hits: number; first: Date | null; last: Date | null };
  const agg = { google: { hits: 0, first: null, last: null } as Agg, googleNews: { hits: 0, first: null, last: null } as Agg };
  const minDate = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a < b ? a : b);
  const maxDate = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b);

  for (const b of byBot) {
    const target = GOOGLE_NEWS_BOTS.includes(b.bot) ? agg.googleNews : agg.google;
    target.hits += b._count._all;
    target.first = minDate(target.first, b._min.createdAt);
    target.last = maxDate(target.last, b._max.createdAt);
  }

  const categories = [
    {
      id: 'google',
      label: 'Google',
      description: 'Googlebot + Googlebot-Smartphone (Search + Discover)',
      hits: agg.google.hits,
      firstAt: agg.google.first?.toISOString() ?? null,
      lastAt: agg.google.last?.toISOString() ?? null,
    },
    {
      id: 'google-news',
      label: 'Google News',
      description: 'Googlebot-News (für Google News + News-Tab)',
      hits: agg.googleNews.hits,
      firstAt: agg.googleNews.first?.toISOString() ?? null,
      lastAt: agg.googleNews.last?.toISOString() ?? null,
    },
    {
      id: 'google-discover',
      label: 'Google Discover',
      description: 'Kein separater User-Agent – Discover crawlt über Googlebot-Smartphone',
      hits: agg.google.hits, // Same underlying crawler
      firstAt: agg.google.first?.toISOString() ?? null,
      lastAt: agg.google.last?.toISOString() ?? null,
      shared: true, // UI-Hinweis: Zahl ist identisch mit "Google"
    },
  ];

  // Googlebot-News spotlight (unchanged)
  const googleNewsHits = await prisma.crawler_hits.findMany({
    where: { bot: 'Googlebot-News', createdAt: { gte: since } },
    select: { createdAt: true, path: true },
    orderBy: { createdAt: 'desc' },
  });

  const hourBuckets: Record<string, number> = {};
  for (const h of googleNewsHits) {
    const bucket = h.createdAt.toISOString().slice(0, 13) + ':00';
    hourBuckets[bucket] = (hourBuckets[bucket] || 0) + 1;
  }

  let avgIntervalMinutes: number | null = null;
  if (googleNewsHits.length >= 2) {
    const times = googleNewsHits.map((h) => h.createdAt.getTime()).sort((a, b) => b - a);
    const diffs: number[] = [];
    for (let i = 0; i < times.length - 1; i++) diffs.push(times[i] - times[i + 1]);
    avgIntervalMinutes = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length / 60_000);
  }

  return NextResponse.json({
    windowHours,
    generatedAt: new Date().toISOString(),
    totalHits: totalCount,
    categories,
    googleNews: {
      totalHits: googleNewsHits.length,
      lastHitAt: googleNewsHits[0]?.createdAt?.toISOString() ?? null,
      avgIntervalMinutes,
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
