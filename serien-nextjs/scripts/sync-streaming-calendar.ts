/**
 * STREAMING CALENDAR SYNC
 * 
 * Fetches upcoming episodes for streaming originals from TMDB
 * Only includes: Netflix, Prime Video, Disney+, Apple TV+, Paramount+, WOW/HBO
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Streaming services that release worldwide simultaneously
const STREAMING_NETWORKS = [
  'Netflix',
  'Amazon Prime Video',
  'Prime Video',
  'Disney+',
  'Disney Plus',
  'Apple TV+',
  'Paramount+',
  'HBO Max',
  'Max',
  'WOW',
  'Sky',
  'Peacock',
  'Hulu', // Some originals are worldwide
  'Crunchyroll',
  'Amazon'
];

interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  air_date: string;
  episode_number: number;
  season_number: number;
  still_path: string | null;
}

interface TMDBSeries {
  id: number;
  name: string;
  next_episode_to_air: TMDBEpisode | null;
  networks: { name: string }[];
  status: string;
}

/**
 * Check if series is from a streaming platform
 */
function isStreamingOriginal(networks: string[]): string | null {
  for (const network of networks) {
    for (const streaming of STREAMING_NETWORKS) {
      if (network.toLowerCase().includes(streaming.toLowerCase())) {
        return network;
      }
    }
  }
  return null;
}

/**
 * Fetch series details from TMDB
 */
async function fetchSeriesDetails(tmdbId: number): Promise<TMDBSeries | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=de-DE`
    );
    
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Fetch upcoming episodes for a series (next 30 days)
 */
async function fetchUpcomingEpisodes(tmdbId: number): Promise<TMDBEpisode[]> {
  const episodes: TMDBEpisode[] = [];
  
  try {
    // Get series details for next episode
    const series = await fetchSeriesDetails(tmdbId);
    if (!series?.next_episode_to_air) return episodes;
    
    const nextEp = series.next_episode_to_air;
    const airDate = new Date(nextEp.air_date);
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Only include if within next 30 days
    if (airDate >= now && airDate <= thirtyDaysFromNow) {
      episodes.push(nextEp);
    }
    
    // Try to get more episodes from the same season
    const seasonResponse = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}/season/${nextEp.season_number}?api_key=${TMDB_API_KEY}&language=de-DE`
    );
    
    if (seasonResponse.ok) {
      const seasonData = await seasonResponse.json();
      for (const ep of seasonData.episodes || []) {
        if (ep.air_date && ep.episode_number > nextEp.episode_number) {
          const epDate = new Date(ep.air_date);
          if (epDate >= now && epDate <= thirtyDaysFromNow) {
            episodes.push(ep);
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching episodes for ${tmdbId}:`, error);
  }
  
  return episodes;
}

/**
 * Main sync function
 */
async function syncStreamingCalendar() {
  console.log('\n' + '='.repeat(60));
  console.log('📅 STREAMING KALENDER SYNC');
  console.log('='.repeat(60));
  
  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY nicht gefunden!');
    process.exit(1);
  }
  
  // Get all series from our database
  const allSeries = await prisma.series.findMany({
    where: {
      networks: { isEmpty: false }
    },
    select: {
      tmdbId: true,
      name: true,
      slug: true,
      networks: true,
      status: true
    }
  });
  
  console.log(`📺 ${allSeries.length} Serien mit Networks gefunden\n`);
  
  // Filter for streaming originals
  const streamingSeries = allSeries.filter(s => {
    const network = isStreamingOriginal(s.networks);
    return network !== null;
  });
  
  console.log(`🎬 ${streamingSeries.length} Streaming-Originals\n`);
  
  let added = 0;
  let updated = 0;
  let skipped = 0;
  
  for (let i = 0; i < streamingSeries.length; i++) {
    const series = streamingSeries[i];
    const network = isStreamingOriginal(series.networks);
    const progress = `[${i + 1}/${streamingSeries.length}]`;
    
    process.stdout.write(`${progress} ${series.name?.substring(0, 35)}...`);
    
    // Fetch upcoming episodes
    const episodes = await fetchUpcomingEpisodes(series.tmdbId);
    
    if (episodes.length === 0) {
      console.log(' keine Episoden');
      skipped++;
      continue;
    }
    
    // Save to database
    for (const ep of episodes) {
      try {
        await prisma.upcoming_episodes.upsert({
          where: {
            seriesId_seasonNumber_episodeNumber: {
              seriesId: series.tmdbId,
              seasonNumber: ep.season_number,
              episodeNumber: ep.episode_number
            }
          },
          create: {
            seriesId: series.tmdbId,
            seriesName: series.name || '',
            seriesSlug: series.slug,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            episodeName: ep.name,
            airDate: new Date(ep.air_date),
            overview: ep.overview,
            stillPath: ep.still_path,
            network: network
          },
          update: {
            episodeName: ep.name,
            airDate: new Date(ep.air_date),
            overview: ep.overview,
            stillPath: ep.still_path,
            network: network,
            updatedAt: new Date()
          }
        });
        added++;
      } catch (e: any) {
        if (!e.message.includes('Unique constraint')) {
          console.error(`Error: ${e.message}`);
        }
        updated++;
      }
    }
    
    console.log(` ✅ ${episodes.length} Episoden`);
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 250));
  }
  
  // Clean up old episodes (past dates)
  const deleted = await prisma.upcoming_episodes.deleteMany({
    where: {
      airDate: { lt: new Date() }
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 ERGEBNIS');
  console.log('='.repeat(60));
  console.log(`Episoden hinzugefügt/aktualisiert: ${added}`);
  console.log(`Übersprungen (keine Episoden):     ${skipped}`);
  console.log(`Alte Episoden gelöscht:            ${deleted.count}`);
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
}

syncStreamingCalendar().catch(console.error);
