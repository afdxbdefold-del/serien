import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { revalidatePath, revalidateTag } from 'next/cache';
import { requireCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * German streaming provider IDs (TMDB Watch Providers).
 * The IDs must match what TMDB returns under `results.DE.flatrate[].provider_id`.
 */
const PROVIDER_MAP: Record<number, string> = {
  8: 'Netflix',
  9: 'Prime Video',
  337: 'Disney+',
  1899: 'HBO Max',
  350: 'Apple TV+',
  421: 'Joyn',
  531: 'Paramount+',
  283: 'Crunchyroll',
  30: 'WOW',
  178: 'MagentaTV',
  584: 'Discovery+',
  298: 'RTL+',
};

const WINDOW_DAYS = 30;
const MAX_PAGES_PER_PROVIDER = 5; // Up to 100 series per discover query
const TMDB_REQUEST_DELAY_MS = 80; // ~12 req/s, well under TMDB limits

interface TmdbSeriesSummary {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string | null;
  vote_average: number | null;
}

interface TmdbEpisode {
  air_date: string | null;
  episode_number: number | null;
  season_number: number | null;
  name: string | null;
}

interface TmdbSeriesDetail extends TmdbSeriesSummary {
  last_episode_to_air: TmdbEpisode | null;
  next_episode_to_air: TmdbEpisode | null;
}

interface ReleaseRow {
  tmdbId: number;
  provider: string;
  date: Date; // real episode air date or first_air_date, midnight UTC
  name: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: Date | null;
  voteAverage: number | null;
  releaseType: 'new_series' | 'new_episode';
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeName: string | null;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOnlyUTC(input: string | Date): Date | null {
  if (!input) return null;
  const d = typeof input === 'string' ? new Date(`${input}T00:00:00.000Z`) : input;
  if (isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T | null> {
  const usp = new URLSearchParams({
    api_key: TMDB_API_KEY!,
    language: 'de-DE',
    watch_region: 'DE',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const url = `${TMDB_BASE_URL}${path}?${usp.toString()}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      console.warn(`[CRON] TMDB ${res.status} ${path}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[CRON] TMDB fetch failed ${path}:`, e);
    return null;
  }
}

async function discoverSeriesWithEpisodesIn(
  providerId: number,
  startIso: string,
  endIso: string,
  mode: 'air_date' | 'first_air_date',
): Promise<TmdbSeriesSummary[]> {
  const out: TmdbSeriesSummary[] = [];
  for (let page = 1; page <= MAX_PAGES_PER_PROVIDER; page++) {
    const data = await tmdbFetch<{ page: number; results: TmdbSeriesSummary[]; total_pages: number }>(
      '/discover/tv',
      {
        with_watch_providers: providerId,
        [`${mode}.gte`]: startIso,
        [`${mode}.lte`]: endIso,
        sort_by: mode === 'first_air_date' ? 'first_air_date.desc' : 'popularity.desc',
        include_adult: 'false',
        page,
      },
    );
    if (!data || !data.results || data.results.length === 0) break;
    out.push(...data.results);
    await new Promise((r) => setTimeout(r, TMDB_REQUEST_DELAY_MS));
    if (page >= (data.total_pages || 0)) break;
  }
  return out;
}

async function getSeriesDetail(tmdbId: number): Promise<TmdbSeriesDetail | null> {
  return tmdbFetch<TmdbSeriesDetail>(`/tv/${tmdbId}`);
}

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;
  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: 'TMDB_API_KEY missing' }, { status: 500 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startWindow = new Date(today);
  startWindow.setUTCDate(startWindow.getUTCDate() - WINDOW_DAYS);

  const startIso = isoDay(startWindow);
  const endIso = isoDay(today);

  console.log(`[CRON] Releases ingest window ${startIso} → ${endIso}`);

  // Step 1: discover candidate series per provider, both for new premieres and ongoing episodes.
  const candidatesByProvider = new Map<string, Map<number, TmdbSeriesSummary>>();
  for (const [pidStr, providerName] of Object.entries(PROVIDER_MAP)) {
    const pid = Number(pidStr);
    const bucket = new Map<number, TmdbSeriesSummary>();

    const premieres = await discoverSeriesWithEpisodesIn(pid, startIso, endIso, 'first_air_date');
    for (const s of premieres) bucket.set(s.id, s);

    const ongoing = await discoverSeriesWithEpisodesIn(pid, startIso, endIso, 'air_date');
    for (const s of ongoing) if (!bucket.has(s.id)) bucket.set(s.id, s);

    if (bucket.size > 0) {
      candidatesByProvider.set(providerName, bucket);
      console.log(`[CRON]  ${providerName}: ${bucket.size} candidate series`);
    }
  }

  // Step 2: per series, fetch detail to find the relevant episode air date in window.
  const allDetail = new Map<number, TmdbSeriesDetail>();
  const uniqueIds = new Set<number>();
  for (const bucket of candidatesByProvider.values()) for (const id of bucket.keys()) uniqueIds.add(id);
  console.log(`[CRON]  total unique series to detail: ${uniqueIds.size}`);

  for (const id of uniqueIds) {
    const detail = await getSeriesDetail(id);
    if (detail) allDetail.set(id, detail);
    await new Promise((r) => setTimeout(r, TMDB_REQUEST_DELAY_MS));
  }

  const detailSuccessRate = uniqueIds.size === 0 ? 0 : allDetail.size / uniqueIds.size;
  if (uniqueIds.size === 0 || detailSuccessRate < 0.5) {
    console.error(
      `[CRON] aborting release refresh: TMDB detail coverage ${allDetail.size}/${uniqueIds.size}`,
    );
    return NextResponse.json(
      {
        error: 'TMDB returned insufficient release data; existing rows were preserved',
        candidates: uniqueIds.size,
        details: allDetail.size,
      },
      { status: 502 },
    );
  }

  // Step 3: build release rows with REAL air dates within window.
  const rows: ReleaseRow[] = [];
  for (const [providerName, bucket] of candidatesByProvider) {
    for (const summary of bucket.values()) {
      const detail = allDetail.get(summary.id) ?? summary;
      const firstAir = dayOnlyUTC(summary.first_air_date || (detail as TmdbSeriesDetail).first_air_date || '');

      // Pick the most relevant air date inside the window:
      //   1. If next_episode_to_air falls in [start, today] → that's a fresh release (e.g. weekly drop)
      //   2. Else last_episode_to_air if it's in window
      //   3. Else first_air_date if in window (premiere within last 30d)
      let airDate: Date | null = null;
      let releaseType: 'new_series' | 'new_episode' = 'new_episode';
      let seasonNumber: number | null = null;
      let episodeNumber: number | null = null;
      let episodeName: string | null = null;

      const det = detail as TmdbSeriesDetail;
      const next = det.next_episode_to_air;
      const last = det.last_episode_to_air;
      const inWindow = (d: Date | null) => !!d && d >= startWindow && d <= today;

      const nextDate = dayOnlyUTC(next?.air_date || '');
      const lastDate = dayOnlyUTC(last?.air_date || '');

      if (inWindow(nextDate)) {
        airDate = nextDate;
        seasonNumber = next!.season_number ?? null;
        episodeNumber = next!.episode_number ?? null;
        episodeName = next!.name ?? null;
      } else if (inWindow(lastDate)) {
        airDate = lastDate;
        seasonNumber = last!.season_number ?? null;
        episodeNumber = last!.episode_number ?? null;
        episodeName = last!.name ?? null;
      } else if (inWindow(firstAir)) {
        airDate = firstAir;
        releaseType = 'new_series';
      }

      if (!airDate) continue;

      // Mark as new_series if airDate equals firstAirDate AND it's a premiere episode (S1E1)
      if (firstAir && airDate.getTime() === firstAir.getTime() && (seasonNumber ?? 1) === 1 && (episodeNumber ?? 1) === 1) {
        releaseType = 'new_series';
      }

      rows.push({
        tmdbId: summary.id,
        provider: providerName,
        date: airDate,
        name: summary.name || (det as TmdbSeriesDetail).name,
        overview: summary.overview || null,
        posterPath: summary.poster_path || null,
        backdropPath: summary.backdrop_path || null,
        firstAirDate: firstAir,
        voteAverage: summary.vote_average ?? null,
        releaseType,
        seasonNumber,
        episodeNumber,
        episodeName,
      });
    }
  }

  console.log(`[CRON] computed ${rows.length} release rows`);

  if (rows.length === 0) {
    console.error('[CRON] aborting release refresh: no valid rows computed');
    return NextResponse.json(
      { error: 'No valid release rows computed; existing rows were preserved' },
      { status: 502 },
    );
  }

  const olderCutoff = new Date(startWindow);
  const existingWindowRows = await prisma.streaming_releases.count({
    where: { date: { gte: olderCutoff } },
  });
  if (existingWindowRows >= 20 && rows.length < existingWindowRows * 0.25) {
    console.error(
      `[CRON] aborting release refresh: suspicious row drop ${existingWindowRows} -> ${rows.length}`,
    );
    return NextResponse.json(
      {
        error: 'Suspicious release row drop; existing rows were preserved',
        existingRows: existingWindowRows,
        candidateRows: rows.length,
      },
      { status: 502 },
    );
  }

  // Step 4: atomically replace the window. A partial TMDB response or failed
  // insert must never leave the public release calendar empty.
  const records = rows.map((r) => ({
    id: `${r.tmdbId}-${r.provider}-${isoDay(r.date)}`,
    tmdbId: r.tmdbId,
    provider: r.provider,
    date: r.date,
    name: r.name,
    overview: r.overview,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    firstAirDate: r.firstAirDate,
    voteAverage: r.voteAverage,
    releaseType: r.releaseType,
    seasonNumber: r.seasonNumber,
    episodeNumber: r.episodeNumber,
    episodeName: r.episodeName,
    fetchedAt: new Date(),
  }));

  // Also drop entries way older than the window (housekeeping)
  const cleanupCutoff = new Date(today);
  cleanupCutoff.setUTCDate(cleanupCutoff.getUTCDate() - WINDOW_DAYS - 14);

  const chunkSize = 200;
  const writes = [
    prisma.streaming_releases.deleteMany({ where: { date: { gte: olderCutoff } } }),
    ...Array.from({ length: Math.ceil(records.length / chunkSize) }, (_, index) =>
      prisma.streaming_releases.createMany({
        data: records.slice(index * chunkSize, (index + 1) * chunkSize),
        skipDuplicates: true,
      }),
    ),
    prisma.streaming_releases.deleteMany({ where: { date: { lt: cleanupCutoff } } }),
  ];
  await prisma.$transaction(writes);

  // Bust ISR caches for the page (today / week / month variants share the same data tag)
  try {
    revalidateTag('new-releases');
    revalidatePath('/neue-serien');
  } catch (e) {
    console.warn('[CRON] revalidate failed:', e);
  }

  return NextResponse.json({
    success: true,
    rows: rows.length,
    window: { start: startIso, end: endIso },
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
