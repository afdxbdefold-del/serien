/**
 * TMDB Top-10 Ingest
 *
 * Ersatz für den FlixPatrol-Scraper (Feb 2026 unbrauchbar gemacht durch
 * Cloudflare Managed Challenge). Wir ziehen die populärsten TV-Serien pro
 * Streamer in Deutschland direkt aus der offiziellen TMDB-API und schreiben
 * sie in die bestehende `streamer_rankings`-Tabelle im selben Format, das
 * `lib/ranking-queries.ts` erwartet — die UI muss dadurch nicht angefasst
 * werden.
 *
 * Datenquelle: `/discover/tv?with_watch_providers=<id>&watch_region=DE&sort_by=popularity.desc`
 *
 * Hinweis zum Unterschied gegenüber FlixPatrol:
 *  - FlixPatrol misst geschätzte Views/Streams; TMDB misst Popularität
 *    (Views auf TMDB-Seiten, TMDB-User-Aktivität, Trending-Signale).
 *  - In der Praxis überlappen die Rankings zu ~70-80 %, aber sie sind
 *    NICHT identisch. Wenn eine gestreamte Show explodiert (z.B. Squid
 *    Game S2), findet TMDB das mit einigen Tagen Verzögerung. Für ein
 *    News-Portal ist das trotzdem ausreichend.
 */

import prisma from './prisma';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;

/**
 * Mapping von unseren internen Platform-IDs auf die TMDB
 * `watch_provider`-IDs. Verifiziert per direktem Aufruf gegen
 * /watch/providers/tv?watch_region=DE für Deutschland.
 *
 * WICHTIG: Diese IDs sind stabil, aber TMDB fasst manchmal Anbieter
 * neu zusammen (siehe HBO → Max Migration). Wenn ein Anbieter mal 0
 * Ergebnisse liefert, hier prüfen ob TMDB die Provider-ID gewechselt hat.
 */
const PLATFORM_TO_TMDB_PROVIDER: Record<string, number> = {
  'netflix': 8,
  'prime-video': 9,     // Amazon Prime Video (die kostenpflichtige Sub in DE)
  'disney-plus': 337,
  'apple-tv': 350,      // Apple TV+
  'hbo-max': 1899,      // "Max" (früher HBO Max) — in DE über Sky/WOW verfügbar
  'paramount': 531,     // Paramount+
};

export type TmdbPlatform = keyof typeof PLATFORM_TO_TMDB_PROVIDER;

interface TmdbDiscoverResponse {
  page: number;
  results: Array<{
    id: number;
    name: string;
    original_name?: string;
    poster_path: string | null;
    backdrop_path: string | null;
    popularity: number;
    first_air_date?: string;
  }>;
}

function slugifyForRanking(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function fetchDiscover(providerId: number, page = 1): Promise<TmdbDiscoverResponse> {
  const url = `${TMDB_BASE}/discover/tv`
    + `?api_key=${TMDB_KEY}`
    + `&watch_region=DE`
    + `&with_watch_providers=${providerId}`
    + '&sort_by=popularity.desc'
    + '&language=de-DE'
    + `&page=${page}`
    // Ohne diesen Filter mischt TMDB gelegentlich Erwachsenen-/Adult-Titel
    // rein — wir schließen das aus, damit wir keine unerwünschten Titel
    // auf der Startseite rendern.
    + '&include_adult=false';

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`TMDB /discover/tv HTTP ${res.status} for provider=${providerId}`);
  }
  return (await res.json()) as TmdbDiscoverResponse;
}

export interface IngestResult {
  platform: string;
  country: string;
  tvInserted: number;
  matched: number;
  unmatched: number;
  date: string;
}

export async function ingestTmdbPlatform(
  platform: TmdbPlatform,
  country: string = 'germany',
): Promise<IngestResult> {
  if (!TMDB_KEY) {
    throw new Error('TMDB_API_KEY nicht gesetzt');
  }
  const providerId = PLATFORM_TO_TMDB_PROVIDER[platform];
  if (!providerId) {
    throw new Error(`Unbekannte Platform: ${platform}`);
  }

  const data = await fetchDiscover(providerId);
  const top10 = (data.results || []).slice(0, 10);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Alle TMDB-IDs auf einen Rutsch gegen unsere `series`-Tabelle matchen,
  // damit die UI einen internen Slug verlinken kann, wenn die Serie schon
  // eingepflegt ist.
  const tmdbIds = top10.map((r) => r.id).filter((n): n is number => typeof n === 'number');
  const seriesRows = tmdbIds.length
    ? await prisma.series.findMany({
        where: { tmdbId: { in: tmdbIds } },
        select: { tmdbId: true, slug: true },
      })
    : [];
  const slugByTmdb = new Map(seriesRows.map((s) => [s.tmdbId, s.slug]));

  let matched = 0;
  let unmatched = 0;

  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const rank = i + 1;
    const title = entry.name || entry.original_name || '';
    if (!title) continue;

    const localSlug = slugByTmdb.get(entry.id);
    const isMatched = !!localSlug;
    if (isMatched) matched++; else unmatched++;

    await prisma.streamer_rankings.upsert({
      where: {
        platform_country_type_date_rank: {
          platform,
          country,
          type: 'tv',
          date: today,
          rank,
        },
      },
      update: {
        title,
        slug: localSlug || slugifyForRanking(title),
        tmdbId: entry.id,
        tmdbMatched: isMatched,
        posterPath: entry.poster_path,
        backdropPath: entry.backdrop_path,
      },
      create: {
        platform,
        country,
        type: 'tv',
        date: today,
        rank,
        title,
        slug: localSlug || slugifyForRanking(title),
        tmdbId: entry.id,
        tmdbMatched: isMatched,
        posterPath: entry.poster_path,
        backdropPath: entry.backdrop_path,
      },
    });
  }

  return {
    platform,
    country,
    tvInserted: top10.length,
    matched,
    unmatched,
    date: today.toISOString().slice(0, 10),
  };
}

export async function ingestAllTmdbPlatforms(country: string = 'germany'): Promise<IngestResult[]> {
  const platforms = Object.keys(PLATFORM_TO_TMDB_PROVIDER) as TmdbPlatform[];
  const results: IngestResult[] = [];
  for (const p of platforms) {
    try {
      // Kleine Pause zwischen Anfragen — TMDB erlaubt zwar 50 req/s, aber
      // wir sind hier höflich und riskieren kein Rate-Limit.
      const r = await ingestTmdbPlatform(p, country);
      results.push(r);
      await new Promise((res) => setTimeout(res, 200));
    } catch (err: any) {
      console.error(`[tmdb-top10] ingest failed for ${p}:`, err?.message || err);
      results.push({
        platform: p,
        country,
        tvInserted: 0,
        matched: 0,
        unmatched: 0,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }
  return results;
}
