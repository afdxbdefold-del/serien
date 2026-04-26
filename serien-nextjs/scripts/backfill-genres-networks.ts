/**
 * Backfill series.genres + series.networks from TMDB.
 *
 * Sources:
 *   1. /tv/{id}                       → genres (names) + networks (originals)
 *   2. /tv/{id}/watch/providers       → DE flatrate/free streamers (used by Serienfinder)
 *
 * Stores:
 *   series.genres         = array of German genre names
 *   series.networks       = combined: TMDB networks (broadcasters) + DE streaming providers
 *
 * Usage:  npx tsx scripts/backfill-genres-networks.ts [--limit=500] [--only-empty]
 */

import prisma from '../lib/prisma';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || Infinity;
const onlyEmpty = args.includes('--only-empty') || true; // default true

// Map of common DE streaming providers we want surfaced in /serienfinder.
// We keep ALL providers TMDB returns (flatrate + free), but the UI's
// GERMAN_STREAMERS list filters them to known names.
async function tmdbFetch<T>(path: string): Promise<T | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const r = await fetch(`${TMDB_BASE}${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}&language=de-DE`, {
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

interface TmdbDetail {
  genres?: { id: number; name: string }[];
  networks?: { id: number; name: string }[];
}
interface TmdbProviders {
  results?: { DE?: { flatrate?: { provider_name: string }[]; free?: { provider_name: string }[]; ads?: { provider_name: string }[] } };
}

async function main() {
  if (!TMDB_API_KEY) throw new Error('TMDB_API_KEY missing');

  const where = onlyEmpty
    ? {
        OR: [{ genres: { isEmpty: true } }, { networks: { isEmpty: true } }],
      }
    : {};

  const candidates = await prisma.series.findMany({
    where,
    select: { tmdbId: true, name: true, title: true, genres: true, networks: true },
    orderBy: { popularity: 'desc' },
    take: Number.isFinite(limit) ? limit : undefined,
  });

  console.log(`Found ${candidates.length} series to refresh`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < candidates.length; i++) {
    const s = candidates[i];
    try {
      const detail = await tmdbFetch<TmdbDetail>(`/tv/${s.tmdbId}`);
      const providers = await tmdbFetch<TmdbProviders>(`/tv/${s.tmdbId}/watch/providers`);

      const genreNames =
        Array.isArray(detail?.genres) ? detail!.genres.map((g) => g.name).filter(Boolean) : [];

      const tmdbNetworks =
        Array.isArray(detail?.networks) ? detail!.networks.map((n) => n.name).filter(Boolean) : [];

      const de = providers?.results?.DE;
      const streamProviders = [
        ...(de?.flatrate ?? []),
        ...(de?.free ?? []),
        ...(de?.ads ?? []),
      ].map((p) => p.provider_name).filter(Boolean);

      // Merge + dedupe
      const merged = Array.from(new Set([...tmdbNetworks, ...streamProviders]));

      // Keep existing if both lookups failed for this row
      const newGenres = genreNames.length > 0 ? genreNames : s.genres;
      const newNetworks = merged.length > 0 ? merged : s.networks;

      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: { genres: newGenres, networks: newNetworks },
      });

      ok++;
      if ((i + 1) % 50 === 0 || i < 5) {
        console.log(`[${i + 1}/${candidates.length}] ${s.title || s.name}: genres=${newGenres.length}, networks=${newNetworks.length}`);
      }
    } catch (e: any) {
      fail++;
      console.warn(`[${i + 1}/${candidates.length}] ${s.title || s.name}: ${e.message}`);
    }

    // Gentle rate-limit
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(`\nDone. ok=${ok}, failed=${fail}, total=${candidates.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
