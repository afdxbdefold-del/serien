/**
 * Crawler stats for the admin dashboard.
 * GET /api/admin/crawler-stats?window=24  → hits grouped by bot, time buckets
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

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
    720, // max 30 days
  );
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const [byBot, recent, totalCount] = await Promise.all([
    prisma.crawler_hits.groupBy({
      by: ['bot'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    }),
    prisma.crawler_hits.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { bot: true, path: true, createdAt: true },
    }),
    prisma.crawler_hits.count({ where: { createdAt: { gte: since } } }),
  ]);

  // Per-bot rate per hour and path breakdown (just for Googlebot-News)
  const googleNewsHits = await prisma.crawler_hits.findMany({
    where: {
      bot: 'Googlebot-News',
      createdAt: { gte: since },
    },
    select: { createdAt: true, path: true },
    orderBy: { createdAt: 'desc' },
  });

  // Bucket by hour for Googlebot-News
  const hourBuckets: Record<string, number> = {};
  for (const h of googleNewsHits) {
    const bucket = h.createdAt.toISOString().slice(0, 13) + ':00'; // YYYY-MM-DDTHH:00
    hourBuckets[bucket] = (hourBuckets[bucket] || 0) + 1;
  }

  // Average interval between Googlebot-News hits (if ≥2 hits)
  let avgIntervalMinutes: number | null = null;
  if (googleNewsHits.length >= 2) {
    const times = googleNewsHits.map((h) => h.createdAt.getTime()).sort((a, b) => b - a);
    const diffs: number[] = [];
    for (let i = 0; i < times.length - 1; i++) {
      diffs.push(times[i] - times[i + 1]);
    }
    avgIntervalMinutes = Math.round(
      diffs.reduce((a, b) => a + b, 0) / diffs.length / 60_000,
    );
  }

  return NextResponse.json({
    windowHours,
    generatedAt: new Date().toISOString(),
    totalHits: totalCount,
    byBot: byBot
      .map((b) => ({
        bot: b.bot,
        hits: b._count._all,
        firstAt: b._min.createdAt?.toISOString() ?? null,
        lastAt: b._max.createdAt?.toISOString() ?? null,
      }))
      .sort((a, b) => b.hits - a.hits),
    googleNews: {
      totalHits: googleNewsHits.length,
      lastHitAt: googleNewsHits[0]?.createdAt?.toISOString() ?? null,
      avgIntervalMinutes,
      hourlyBuckets: Object.entries(hourBuckets)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-48) // last 48 hourly buckets
        .map(([hour, count]) => ({ hour, count })),
    },
    recent: recent.map((r) => ({
      bot: r.bot,
      path: r.path,
      at: r.createdAt.toISOString(),
    })),
  });
}
