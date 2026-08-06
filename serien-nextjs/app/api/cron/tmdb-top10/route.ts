/**
 * TMDB TOP-10 DAILY CRON
 *
 * Ersetzt seit Feb 2026 den FlixPatrol-Cron (der wegen Cloudflare
 * Managed Challenge nur noch 403 zurückbekommt). Läuft 1×/Tag als
 * Coolify Scheduled Task, zieht die populärsten TV-Serien pro Streamer
 * aus TMDB und schreibt sie in `streamer_rankings`.
 *
 * Auth: Bearer CRON_SECRET (dasselbe Muster wie /api/cron/news).
 *
 * GET /api/cron/tmdb-top10
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ingestAllTmdbPlatforms } from '@/lib/tmdb-top10-ingest';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  return secret === process.env.CRON_SECRET;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  try {
    const results = await ingestAllTmdbPlatforms('germany');
    const totalTv = results.reduce((a, r) => a + r.tvInserted, 0);
    const totalMatched = results.reduce((a, r) => a + r.matched, 0);
    const totalUnmatched = results.reduce((a, r) => a + r.unmatched, 0);

    // ISR-/Edge-Cache purgen, damit die frischen Rankings SOFORT sichtbar
    // sind und nicht erst nach der 30-min-TTL. Zusätzlich alle statischen
    // Streamer-Seiten (/netflix-serien, /disney-plus-serien, /apple-tv-serien,
    // /hbo-serien, /paramount-plus-serien, /prime-video-serien) revalidieren.
    try {
      revalidatePath('/top-10', 'page');
      revalidatePath('/', 'page');
      revalidatePath('/hbo-serien', 'page');
    } catch (e: any) {
      console.warn('[tmdb-top10 cron] revalidatePath failed:', e?.message);
    }

    return NextResponse.json({
      ok: true,
      durationMs: Date.now() - start,
      totals: { tv: totalTv, matched: totalMatched, unmatched: totalUnmatched },
      perPlatform: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'unknown', durationMs: Date.now() - start },
      { status: 500 },
    );
  }
}
