/**
 * Resolver for streamer hub pages (Netflix, Disney+, Prime, WOW, HBO, …).
 *
 * Historically each hub page queried `series.networks` which only contains
 * TMDB ORIGIN networks (FOX, AMC, Disney …) — Distributors and DACH
 * streamers (MagentaTV, RTL+, Joyn, ARD/ZDF Mediathek) barely appeared.
 *
 * We combine two sources:
 *   1. `series.networks` (TMDB origin)
 *   2. `streaming_releases.provider` (populated nightly by /api/cron/tmdb-sync
 *      from TMDB Watch Providers, region DE)
 *
 * Result: a deduplicated set of `tmdbId`s that represents the union of
 * "produced by network" + "currently streamable on the provider in DE".
 * Each hub then runs its existing series/articles queries against this set.
 *
 * Usage:
 *   import { resolveStreamerHubTmdbIds } from '@/lib/streamer-hub-resolver';
 *   const ids = await resolveStreamerHubTmdbIds({
 *     networks: ['MagentaTV', 'Telekom'],
 *     providers: ['MagentaTV', 'Magenta TV', 'Telekom'],
 *   });
 *   // → use `tmdbId: { in: ids }` in all subsequent prisma queries.
 */

import prisma from './prisma';

export interface StreamerHubFilter {
  networks: string[];
  providers: string[];
}

export async function resolveStreamerHubTmdbIds(
  filter: StreamerHubFilter
): Promise<number[]> {
  const [byNetwork, byProvider] = await Promise.all([
    filter.networks.length > 0
      ? prisma.series.findMany({
          where: { networks: { hasSome: filter.networks } },
          select: { tmdbId: true },
        })
      : Promise.resolve([] as Array<{ tmdbId: number }>),
    filter.providers.length > 0
      ? prisma.streaming_releases.findMany({
          where: { provider: { in: filter.providers } },
          select: { tmdbId: true },
        })
      : Promise.resolve([] as Array<{ tmdbId: number }>),
  ]);
  const ids = new Set<number>();
  for (const row of byNetwork) ids.add(row.tmdbId);
  for (const row of byProvider) ids.add(row.tmdbId);
  return [...ids];
}
