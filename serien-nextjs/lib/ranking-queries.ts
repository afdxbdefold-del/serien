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
      // Poster-Auflösung mit klarer Präzedenz und Rewrite:
      //   1. posterLocalUrl aus series-Tabelle (R2-Storage-Path
      //      wie "serien-nextjs/images/poster/tv/1234.webp") →
      //      wird zur vollständigen R2-Public-URL prefixed.
      //   2. Fallback: posterPath (TMDB-Konvention "/xxx.jpg") →
      //      wird UI-seitig durch posterUrl() zu image.tmdb.org.
      //   3. Fallback: ingest-time posterPath aus dem ranking-Row.
      // Der frühere Bug: posterLocalUrl wurde als generisches
      // posterPath weitergereicht und dann fälschlich mit
      // image.tmdb.org prefixed → 404 für The Rookie, Breaking Bad.
      posterPath: resolvePoster(meta?.posterLocalUrl, meta?.posterPath, r.posterPath),
      backdropPath: meta?.backdropPath ?? r.backdropPath ?? null,
      previousRank: prev,
    };
  });
}

/**
 * Wählt die beste Poster-URL/Path aus mehreren möglichen Quellen und
 * normalisiert R2-Storage-Paths (z.B. "serien-nextjs/images/poster/…")
 * zu vollständigen Public-URLs. TMDB-Pfade (mit führendem "/") und
 * bereits absolute URLs bleiben unverändert und werden von der Client-
 * Component in TMDB-CDN-URLs umgewandelt.
 */
function resolvePoster(
  posterLocalUrl?: string | null,
  posterPathFromSeries?: string | null,
  posterPathFromRanking?: string | null,
): string | null {
  const r2Base = process.env.NEXT_PUBLIC_R2_URL || process.env.R2_PUBLIC_URL || '';
  if (posterLocalUrl) {
    if (posterLocalUrl.startsWith('http')) return posterLocalUrl;
    // R2-Storage-Path → volle Public-URL
    if (r2Base) return `${r2Base.replace(/\/$/, '')}/${posterLocalUrl.replace(/^\//, '')}`;
    // Ohne R2-Base wäre der Path sinnlos — sauber auf nächsten Fallback
    // fallen statt eine kaputte URL rauszureichen.
  }
  if (posterPathFromSeries) {
    if (posterPathFromSeries.startsWith('http')) return posterPathFromSeries;
    // Ein Storage-Path ohne führenden "/" ist auch ein R2-Path (nicht TMDB).
    if (!posterPathFromSeries.startsWith('/') && r2Base) {
      return `${r2Base.replace(/\/$/, '')}/${posterPathFromSeries}`;
    }
    return posterPathFromSeries; // TMDB-Konvention "/xxx.jpg"
  }
  if (posterPathFromRanking) return posterPathFromRanking;
  return null;
}
