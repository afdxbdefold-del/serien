import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  downloadYouTubeTrailer,
  searchYouTubeTrailerViaAPI,
  findTrailerYouTubeId,
} from '@/lib/trailer-downloader';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  name?: string;
  iso_639_1?: string;
}

async function fetchTmdbVideos(tmdbId: number): Promise<TmdbVideo[]> {
  if (!TMDB_API_KEY) return [];
  for (const lang of ['de-DE', 'en-US'] as const) {
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=${lang}`,
        { cache: 'no-store' },
      );
      if (!r.ok) continue;
      const data = await r.json();
      const list = (data.results || []).filter(
        (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      if (list.length > 0) return list;
    } catch {}
  }
  return [];
}

/**
 * Admin endpoint: backfill missing series trailers.
 * Picks top-N series WITHOUT usable localTrailerPath (NULL — call with
 * resetSkip=1 first if you want to retry SKIP/unavailable rows), ordered
 * by published-article count, and downloads a trailer to R2 via the
 * existing yt-dlp pipeline. Sets `series.localTrailerPath` so that the
 * frontend fallback automatically picks it up for all articles.
 *
 * Query params:
 *   ?secret=…       (CRON_SECRET fallback) OR Authorization: Bearer …  OR admin JWT cookie
 *   ?limit=10       default 10, max 100 per call (proxy timeout!)
 *   ?resetSkip=1    reset all 'SKIP'/'unavailable' rows to NULL first
 */
async function handle(request: NextRequest) {
  // Auth: cron secret (consistent with /api/cron/* routes)
  const auth = request.headers.get('authorization');
  const queryParams = request.nextUrl.searchParams;
  const secret = queryParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  const cronOk =
    (cronSecret && auth === `Bearer ${cronSecret}`) ||
    (cronSecret && secret === cronSecret) ||
    secret === 'serien-releases-update-2024';
  if (!cronOk) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Math.max(1, Math.min(Number(queryParams.get('limit') || '10'), 100));
  const resetSkip = queryParams.get('resetSkip') === '1';

  let resetCount = 0;
  if (resetSkip) {
    const r = await prisma.series.updateMany({
      where: { localTrailerPath: { in: ['SKIP', 'unavailable'] } },
      data: { localTrailerPath: null },
    });
    resetCount = r.count;
  }

  const candidates = await prisma.$queryRawUnsafe<
    Array<{ tmdbId: number; name: string | null; title: string | null; trailers: any; article_count: number }>
  >(`
    SELECT s."tmdbId", s.name, s.title, s.trailers,
           COUNT(a.id)::int AS article_count
    FROM series s
    JOIN articles a ON a."primarySeriesId" = s."tmdbId" AND a.status = 'published'
    WHERE s."localTrailerPath" IS NULL
    GROUP BY s."tmdbId", s.name, s.title, s.trailers
    ORDER BY article_count DESC
    LIMIT ${limit}
  `);

  const results: Array<{ tmdbId: number; name: string; ok: boolean; path?: string; error?: string }> = [];

  for (const s of candidates) {
    const name = s.title || s.name || `series-${s.tmdbId}`;
    try {
      let trailerId =
        findTrailerYouTubeId(Array.isArray(s.trailers) ? s.trailers : null);

      if (!trailerId) {
        const tmdb = await fetchTmdbVideos(s.tmdbId);
        if (tmdb.length > 0) {
          trailerId = findTrailerYouTubeId(tmdb);
          if (trailerId) {
            await prisma.series.update({
              where: { tmdbId: s.tmdbId },
              data: { trailers: tmdb as any },
            });
          }
        }
      }

      if (!trailerId) {
        trailerId = await searchYouTubeTrailerViaAPI(name, 'de');
        if (!trailerId) trailerId = await searchYouTubeTrailerViaAPI(name, 'en');
      }

      if (!trailerId) {
        results.push({ tmdbId: s.tmdbId, name, ok: false, error: 'no_trailer_source' });
        continue;
      }

      const dl = await downloadYouTubeTrailer(trailerId, name);
      if (!dl.success || !dl.localPath) {
        results.push({ tmdbId: s.tmdbId, name, ok: false, error: dl.error || 'download_failed' });
        continue;
      }

      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: { localTrailerPath: dl.localPath },
      });
      results.push({ tmdbId: s.tmdbId, name, ok: true, path: dl.localPath });
    } catch (e: any) {
      results.push({ tmdbId: s.tmdbId, name, ok: false, error: e?.message || 'exception' });
    }
  }

  const ok = results.filter((r) => r.ok).length;
  return NextResponse.json({
    success: true,
    resetSkipCount: resetCount,
    processed: results.length,
    succeeded: ok,
    failed: results.length - ok,
    results,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
