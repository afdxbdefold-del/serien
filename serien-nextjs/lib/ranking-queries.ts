/**
 * RANKING QUERY HELPERS
 *
 * Read-only interface to `streamer_rankings` for UI / API consumers. Hides
 * the data source from callers — they just ask for "current HBO Top 10".
 */

import prisma from './prisma';
import type { FlixpatrolPlatform } from './flixpatrol-scraper';

export interface RankedSeries {
  rank: number;
  title: string;
  tmdbId: number | null;
  slug: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  previousRank: number | null; // rank 7 days ago, if known
}

/** Most recent date for which we have data (handles cron lag gracefully). */
async function latestDate(
  platform: string,
  country: string,
  type: 'tv' | 'movie',
): Promise<Date | null> {
  const r = await prisma.streamer_rankings.findFirst({
    where: { platform, country, type },
    orderBy: { date: 'desc' },
    select: { date: true },
  });
  return r?.date ?? null;
}

export async function getCurrentTop10(
  platform: FlixpatrolPlatform,
  country: string = 'germany',
  type: 'tv' | 'movie' = 'tv',
): Promise<RankedSeries[]> {
  const today = await latestDate(platform, country, type);
  if (!today) return [];

  const rows = await prisma.streamer_rankings.findMany({
    where: { platform, country, type, date: today },
    orderBy: { rank: 'asc' },
  });

  // Pull 7-day-ago snapshot in a single query to compute deltas
  const weekAgo = new Date(today);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  const priorRows = await prisma.streamer_rankings.findMany({
    where: { platform, country, type, date: weekAgo },
    select: { rank: true, title: true, tmdbId: true },
  });
  const priorByTmdb = new Map(priorRows.filter((p) => p.tmdbId).map((p) => [p.tmdbId!, p.rank]));
  const priorByTitle = new Map(priorRows.map((p) => [p.title.toLowerCase(), p.rank]));

  // Enrich with TMDB poster/backdrop from our series table so the UI can
  // render images without a secondary round-trip
  const tmdbIds = rows.map((r) => r.tmdbId).filter((id): id is number => id != null);
  const series =
    tmdbIds.length > 0
      ? await prisma.series.findMany({
          where: { tmdbId: { in: tmdbIds } },
          select: { tmdbId: true, slug: true, posterPath: true, backdropPath: true, posterLocalUrl: true },
        })
      : [];
  const seriesByTmdb = new Map(series.map((s) => [s.tmdbId, s]));

  return rows.map((r) => {
    const meta = r.tmdbId ? seriesByTmdb.get(r.tmdbId) : undefined;
    const prev =
      (r.tmdbId ? priorByTmdb.get(r.tmdbId) : undefined) ??
      priorByTitle.get(r.title.toLowerCase()) ??
      null;
    return {
      rank: r.rank,
      title: r.title,
      tmdbId: r.tmdbId,
      slug: meta?.slug ?? null,
      // Prefer a fully-onboarded series poster; fall back to the opportunistic
      // TMDB poster captured at ingest time (handles shows that aren't in our
      // local series table yet).
      posterPath: meta?.posterLocalUrl || meta?.posterPath || r.posterPath || null,
      backdropPath: meta?.backdropPath ?? r.backdropPath ?? null,
      previousRank: prev,
    };
  });
}
