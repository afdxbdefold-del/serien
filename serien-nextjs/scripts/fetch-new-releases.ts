/**
 * Fetch New Releases from TMDB
 * Fetches "On The Air" and "Airing Today" series with German streaming providers
 */

import prisma from '../lib/prisma';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

// German streaming provider IDs from TMDB
const GERMAN_PROVIDERS: Record<number, string> = {
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
  35: 'Rakuten TV',
  20: 'maxdome',
  192: 'ZDF Mediathek',
  190: 'ARD Mediathek',
  1796: 'CHILI',
  569: 'freenet Video',
};

interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  genre_ids: number[];
}

interface NewRelease {
  tmdbId: number;
  name: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: Date;
  voteAverage: number;
  providers: string[];
  releaseType: 'new_series' | 'new_episode';
}

async function fetchTMDBPage(endpoint: string, page: number = 1): Promise<TMDBSeries[]> {
  const url = `${TMDB_BASE}${endpoint}?api_key=${TMDB_API_KEY}&language=de-DE&page=${page}&watch_region=DE`;
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`TMDB API error: ${response.status}`);
    return [];
  }
  
  const data = await response.json();
  return data.results || [];
}

async function getProviders(tmdbId: number): Promise<string[]> {
  const url = `${TMDB_BASE}/tv/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const data = await response.json();
    const deProviders = data.results?.DE;
    
    if (!deProviders) return [];
    
    const providers: string[] = [];
    
    // Flatrate (Subscription) providers
    if (deProviders.flatrate) {
      for (const p of deProviders.flatrate) {
        if (GERMAN_PROVIDERS[p.provider_id]) {
          providers.push(GERMAN_PROVIDERS[p.provider_id]);
        }
      }
    }
    
    // Free providers
    if (deProviders.free) {
      for (const p of deProviders.free) {
        if (GERMAN_PROVIDERS[p.provider_id]) {
          providers.push(GERMAN_PROVIDERS[p.provider_id]);
        }
      }
    }
    
    return [...new Set(providers)]; // Remove duplicates
  } catch (error) {
    return [];
  }
}

async function fetchNewReleases(): Promise<Map<string, NewRelease[]>> {
  console.log('🔄 Fetching new releases from TMDB...');
  
  const releasesByProvider = new Map<string, NewRelease[]>();
  
  // Initialize provider buckets
  for (const provider of Object.values(GERMAN_PROVIDERS)) {
    releasesByProvider.set(provider, []);
  }
  
  // Fetch "On The Air" (currently airing series)
  const onTheAir = await fetchTMDBPage('/tv/on_the_air');
  console.log(`   Found ${onTheAir.length} series on the air`);
  
  // Fetch "Airing Today" (episodes airing today)
  const airingToday = await fetchTMDBPage('/tv/airing_today');
  console.log(`   Found ${airingToday.length} series airing today`);
  
  // Combine and deduplicate
  const allSeries = [...onTheAir, ...airingToday];
  const seenIds = new Set<number>();
  const uniqueSeries = allSeries.filter(s => {
    if (seenIds.has(s.id)) return false;
    seenIds.add(s.id);
    return true;
  });
  
  console.log(`   Processing ${uniqueSeries.length} unique series...`);
  
  // Process each series
  for (const series of uniqueSeries) {
    const providers = await getProviders(series.id);
    
    if (providers.length === 0) continue;
    
    const release: NewRelease = {
      tmdbId: series.id,
      name: series.name,
      overview: series.overview,
      posterPath: series.poster_path,
      backdropPath: series.backdrop_path,
      firstAirDate: series.first_air_date ? new Date(series.first_air_date) : new Date(),
      voteAverage: series.vote_average,
      providers,
      releaseType: 'new_episode',
    };
    
    // Add to each provider bucket
    for (const provider of providers) {
      const bucket = releasesByProvider.get(provider);
      if (bucket) {
        bucket.push(release);
      }
    }
  }
  
  // Sort each bucket by vote average (best first)
  for (const [provider, releases] of releasesByProvider) {
    releases.sort((a, b) => b.voteAverage - a.voteAverage);
    if (releases.length > 0) {
      console.log(`   ${provider}: ${releases.length} titles`);
    }
  }
  
  return releasesByProvider;
}

async function saveToDatabase(releasesByProvider: Map<string, NewRelease[]>) {
  console.log('\n💾 Saving to database...');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Clear old entries (older than 7 days)
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  await prisma.streaming_releases.deleteMany({
    where: { fetchedAt: { lt: weekAgo } }
  });
  
  // Save new entries
  for (const [provider, releases] of releasesByProvider) {
    for (const release of releases) {
      await prisma.streaming_releases.upsert({
        where: {
          tmdbId_provider_date: {
            tmdbId: release.tmdbId,
            provider,
            date: today,
          }
        },
        update: {
          name: release.name,
          overview: release.overview,
          posterPath: release.posterPath,
          backdropPath: release.backdropPath,
          voteAverage: release.voteAverage,
          releaseType: release.releaseType,
          fetchedAt: new Date(),
        },
        create: {
          tmdbId: release.tmdbId,
          provider,
          date: today,
          name: release.name,
          overview: release.overview,
          posterPath: release.posterPath,
          backdropPath: release.backdropPath,
          firstAirDate: release.firstAirDate,
          voteAverage: release.voteAverage,
          releaseType: release.releaseType,
          fetchedAt: new Date(),
        },
      });
    }
  }
  
  console.log('✅ Saved to database');
}

async function main() {
  console.log('🚀 Starting New Releases Fetch\n');
  
  const releasesByProvider = await fetchNewReleases();
  await saveToDatabase(releasesByProvider);
  
  // Summary
  let total = 0;
  for (const [provider, releases] of releasesByProvider) {
    if (releases.length > 0) {
      total += releases.length;
    }
  }
  
  console.log(`\n✅ Done! Total: ${total} releases across all providers`);
  process.exit(0);
}

main().catch(console.error);
