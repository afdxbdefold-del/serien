/**
 * Admin "Discovery-Channel Stats" widget data.
 * GET /api/admin/discovery-channel-stats?days=30
 *
 * Aggregiert pipeline_runs nach Discovery-Channel (woher kommt der Artikel?):
 *   - 'rss-direct'         : direkter RSS-Feed (Screenrant/Collider/Cinemaholic/Deadline/Variety/Tudum…)
 *   - 'googlenews'         : Google News RSS Wrapper-URL (post-decode)
 *   - 'tudum'              : Netflix Tudum HTML-Scraper
 *   - 'screenrant-deep'    : screenrant deep-scraper
 *   - 'tvline-deep'        : tvline deep-scraper
 *   - 'tvline-rss'         : tvline rss feed
 *   - 'admin-manual'       : manueller Trigger via Admin-UI / CLI
 *   - 'replay'             : replay-rejected job
 *   - 'youtube-trailer'    : p4-yt YouTube-Trailer-Pipeline (Netflix DACH / Prime Video DE etc.)
 *   - 'streamer-aggregator': /neue-serien Source
 *   - 'unknown'            : alles andere
 *
 * Backward compat: für ältere Runs ohne `metadata.discoveryChannel` wird der
 * Channel heuristisch aus `inputSource` abgeleitet.
 *
 * Liefert pro Channel:
 *   runs / published / conversionRate / topFailSteps / lastRun
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

const DIRECT_RSS_HOSTS = [
  'screenrant.com', 'collider.com', 'thecinemaholic.com', 'deadline.com',
  'variety.com', 'hollywoodreporter.com', 'tvinsider.com', 'tvline.com',
  'whats-on-netflix.com', 'imdb.com', 'wikipedia.org', 'serienjunkies.de',
  'kino.de',
];

/**
 * Fallback-Klassifizierung für ältere Runs ohne metadata.discoveryChannel.
 * Heuristik: bekannte Direct-RSS-Hosts → rss-direct,
 *            Tudum-URL → tudum,
 *            Streamer-Name → youtube-trailer,
 *            sonst unknown.
 */
function deriveChannelFromInputSource(inputSource: string | null): string {
  if (!inputSource) return 'unknown';
  // Streamer-Aggregator names (no URL)
  if (/^(Netflix DACH|Prime Video DE|Apple TV\+? DACH|Disney\+? DACH|Sky DE|Paramount\+? DE|RTL\+|Joyn|WOW)/i.test(inputSource)) {
    return 'youtube-trailer';
  }
  // Tudum
  if (/netflix\.com\/tudum/i.test(inputSource)) return 'tudum';
  // Direct RSS hosts
  try {
    const host = new URL(inputSource).hostname.toLowerCase().replace(/^www\./, '');
    if (DIRECT_RSS_HOSTS.some((d) => host.endsWith(d))) return 'rss-direct';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

interface ChannelStats {
  channel: string;
  runs: number;
  published: number;
  failed: number;
  skipped: number;
  conversionRate: number; // 0-1
  lastRun: string | null;
  topFailSteps: { step: string; count: number }[];
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const days = Math.max(1, Math.min(90, parseInt(req.nextUrl.searchParams.get('days') || '30', 10)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const runs = await prisma.pipeline_runs.findMany({
    where: { startedAt: { gte: since } },
    select: {
      status: true,
      articleId: true,
      errorStep: true,
      startedAt: true,
      inputSource: true,
      metadata: true,
    },
    orderBy: { startedAt: 'desc' },
  });

  // Bucket by channel
  const buckets = new Map<string, {
    runs: number;
    published: number;
    failed: number;
    skipped: number;
    lastRun: Date | null;
    failSteps: Map<string, number>;
  }>();

  for (const r of runs) {
    let channel = 'unknown';
    if (r.metadata) {
      try {
        const m = JSON.parse(r.metadata);
        if (typeof m?.discoveryChannel === 'string') channel = m.discoveryChannel;
      } catch { /* malformed metadata */ }
    }
    if (channel === 'unknown') {
      channel = deriveChannelFromInputSource(r.inputSource);
    }

    let b = buckets.get(channel);
    if (!b) {
      b = { runs: 0, published: 0, failed: 0, skipped: 0, lastRun: null, failSteps: new Map() };
      buckets.set(channel, b);
    }
    b.runs++;
    if (r.status === 'success' && r.articleId) b.published++;
    else if (r.status === 'failed') b.failed++;
    else if (r.status === 'skipped') b.skipped++;
    if (!b.lastRun || r.startedAt > b.lastRun) b.lastRun = r.startedAt;
    if (r.errorStep) {
      b.failSteps.set(r.errorStep, (b.failSteps.get(r.errorStep) || 0) + 1);
    }
  }

  const channels: ChannelStats[] = Array.from(buckets.entries())
    .map(([channel, b]) => ({
      channel,
      runs: b.runs,
      published: b.published,
      failed: b.failed,
      skipped: b.skipped,
      conversionRate: b.runs > 0 ? b.published / b.runs : 0,
      lastRun: b.lastRun ? b.lastRun.toISOString() : null,
      topFailSteps: Array.from(b.failSteps.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([step, count]) => ({ step, count })),
    }))
    .sort((a, b) => b.published - a.published);

  return NextResponse.json({
    windowDays: days,
    since: since.toISOString(),
    totalRuns: runs.length,
    totalPublished: channels.reduce((s, c) => s + c.published, 0),
    channels,
  });
}
