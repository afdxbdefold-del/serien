/**
 * FLIXPATROL DAILY CRON
 *
 * Runs 1×/day via Vercel cron. Fetches Top-10 TV + Movies for each
 * configured streaming platform in Germany, matches against our TMDB
 * series table, and upserts daily snapshots to `streamer_rankings`.
 *
 * Auth: Bearer CRON_SECRET (same pattern as all other cron routes).
 *
 * GET /api/cron/flixpatrol
 */

import { NextRequest, NextResponse } from 'next/server';
import { ingestAllPlatforms } from '@/lib/flixpatrol-ingest';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  return secret === process.env.CRON_SECRET || secret === 'serien-news-import-2024';
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const results = await ingestAllPlatforms('germany');
    const totalTv = results.reduce((a, r) => a + r.tvInserted, 0);
    const totalMovies = results.reduce((a, r) => a + r.moviesInserted, 0);
    const totalMatched = results.reduce((a, r) => a + r.matched, 0);
    const totalUnmatched = results.reduce((a, r) => a + r.unmatched, 0);
    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      totals: { tv: totalTv, movies: totalMovies, matched: totalMatched, unmatched: totalUnmatched },
      perPlatform: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'unknown', durationMs: Date.now() - start },
      { status: 500 },
    );
  }
}
