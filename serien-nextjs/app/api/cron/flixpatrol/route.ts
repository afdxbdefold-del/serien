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
import { revalidatePath } from 'next/cache';
import { ingestAllPlatforms } from '@/lib/flixpatrol-ingest';
import { requireCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;

  const start = Date.now();
  try {
    const results = await ingestAllPlatforms('germany');
    const totalTv = results.reduce((a, r) => a + r.tvInserted, 0);
    const totalMovies = results.reduce((a, r) => a + r.moviesInserted, 0);
    const totalMatched = results.reduce((a, r) => a + r.matched, 0);
    const totalUnmatched = results.reduce((a, r) => a + r.unmatched, 0);

    // Purge ISR / edge cache for pages driven by streamer_rankings so the
    // fresh Top-10 data is visible immediately, not after the 30 min TTL.
    try {
      revalidatePath('/top-10', 'page');
      revalidatePath('/', 'page'); // home-page Top-10 carousel
    } catch (e: any) {
      console.warn('[flixpatrol cron] revalidatePath failed:', e?.message);
    }

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
