/**
 * TOP SERIES IMPORTER
 * 
 * Imports the top 1000 series from TMDB (popular + top rated)
 * and their cast members into the database
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Read API key directly from .env file
function loadApiKey(): string {
  const envPath = path.join(process.cwd(), '.env');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/TMDB_API_KEY="([^"]+)"/);
  if (!match) {
    throw new Error('TMDB_API_KEY not found in .env file');
  }
  return match[1];
}

const TMDB_API_KEY = loadApiKey();
const TMDB_BASE = 'https://api.themoviedb.org/3';

interface TMDBSeries {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department: string;
}

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 120; // ~8 req/sec to stay under TMDB limit

async function rateLimitedFetch(url: string): Promise<any> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }
  return response.json();
}

function generateSlug(name: string, tmdbId: number): string {
  const slugName = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `${tmdbId}-${slugName}`;
}

// Genre mapping
const GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

async function fetchTopSeries(pages: number = 50): Promise<TMDBSeries[]> {
  const allSeries: TMDBSeries[] = [];
  const seenIds = new Set<number>();
  
  console.log('📥 Fetching top series from TMDB...\n');
  
  // Fetch from both popular and top_rated endpoints
  const endpoints = ['popular', 'top_rated'];
  
  for (const endpoint of endpoints) {
    const pagesToFetch = Math.ceil(pages / endpoints.length);
    
    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        const url = `${TMDB_BASE}/tv/${endpoint}?api_key=${TMDB_API_KEY}&language=de-DE&page=${page}`;
        const data = await rateLimitedFetch(url);
        
        for (const series of data.results) {
          if (!seenIds.has(series.id)) {
            seenIds.add(series.id);
            allSeries.push(series);
          }
        }
        
        if (page % 10 === 0) {
          console.log(`   ${endpoint}: Page ${page}/${pagesToFetch} (${allSeries.length} series collected)`);
        }
      } catch (err) {
        console.error(`   ❌ Error fetching ${endpoint} page ${page}`);
      }
    }
  }
  
  console.log(`\n✅ Collected ${allSeries.length} unique series\n`);
  return allSeries.slice(0, 1000); // Limit to 1000
}

async function importSeriesWithCast(series: TMDBSeries): Promise<{ seriesImported: boolean; castCount: number }> {
  try {
    // Check if series already exists
    const existing = await prisma.series.findUnique({
      where: { tmdbId: series.id }
    });
    
    const seriesSlug = generateSlug(series.name, series.id);
    const genres = series.genre_ids.map(id => GENRE_MAP[id]).filter(Boolean);
    
    // Upsert series - using correct schema fields
    await prisma.series.upsert({
      where: { tmdbId: series.id },
      create: {
        tmdbId: series.id,
        title: series.name,  // 'title' is required field
        name: series.name,
        originalName: series.original_name,
        slug: seriesSlug,
        overview: series.overview || null,
        posterPath: series.poster_path,
        backdropPath: series.backdrop_path,
        firstAirDate: series.first_air_date ? new Date(series.first_air_date) : null,
        popularity: series.popularity,
        genres: genres,
        networks: [],
        updatedAt: new Date(),
      },
      update: {
        title: series.name,
        name: series.name,
        overview: series.overview || null,
        posterPath: series.poster_path,
        backdropPath: series.backdrop_path,
        popularity: series.popularity,
        updatedAt: new Date(),
      },
    });
    
    // Import cast
    let castCount = 0;
    try {
      const creditsUrl = `${TMDB_BASE}/tv/${series.id}/credits?api_key=${TMDB_API_KEY}&language=de-DE`;
      const creditsData = await rateLimitedFetch(creditsUrl);
      
      if (creditsData.cast && creditsData.cast.length > 0) {
        const topCast = creditsData.cast
          .filter((c: TMDBCastMember) => c.known_for_department === 'Acting')
          .slice(0, 10); // Top 10 cast per series
        
        for (const member of topCast) {
          try {
            const personId = generateSlug(member.name, member.id);
            
            // Upsert person
            await prisma.persons.upsert({
              where: { tmdbId: member.id },
              create: {
                id: personId,
                tmdbId: member.id,
                name: member.name,
                slug: personId,
                profilePath: member.profile_path,
                updatedAt: new Date(),
              },
              update: {
                name: member.name,
                profilePath: member.profile_path,
                updatedAt: new Date(),
              },
            });
            
            // Upsert character
            if (member.character && member.character.trim()) {
              const charName = member.character.split('/')[0].trim();
              const charSlug = generateSlug(charName, member.id);
              
              await prisma.characters.upsert({
                where: {
                  seriesTmdbId_name: {
                    seriesTmdbId: series.id,
                    name: member.character,
                  },
                },
                create: {
                  name: member.character,
                  slug: charSlug,
                  seriesTmdbId: series.id,
                  actorTmdbId: member.id,
                  actorName: member.name,
                  imageUrl: member.profile_path 
                    ? `https://image.tmdb.org/t/p/w500${member.profile_path}` 
                    : null,
                },
                update: {
                  actorTmdbId: member.id,
                  actorName: member.name,
                },
              });
            }
            
            castCount++;
          } catch {
            // Skip errors
          }
        }
      }
    } catch {
      // Skip cast errors
    }
    
    return { seriesImported: !existing, castCount };
  } catch (err) {
    return { seriesImported: false, castCount: 0 };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🎬 TOP 1000 SERIES IMPORTER');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Get initial counts
  const initialSeries = await prisma.series.count();
  const initialPersons = await prisma.persons.count();
  const initialChars = await prisma.characters.count();
  
  console.log('📊 Initial DB state:');
  console.log(`   Series: ${initialSeries}`);
  console.log(`   Persons: ${initialPersons}`);
  console.log(`   Characters: ${initialChars}\n`);
  
  // Fetch top series
  const topSeries = await fetchTopSeries(50); // 50 pages = ~1000 series
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   📥 IMPORTING SERIES + CAST');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  let newSeriesCount = 0;
  let totalCastImported = 0;
  let processed = 0;
  
  for (const series of topSeries) {
    const result = await importSeriesWithCast(series);
    
    if (result.seriesImported) {
      newSeriesCount++;
      console.log(`   ✅ NEW: ${series.name} (+${result.castCount} cast)`);
    }
    
    totalCastImported += result.castCount;
    processed++;
    
    if (processed % 100 === 0) {
      console.log(`\n   📊 Progress: ${processed}/${topSeries.length} (${newSeriesCount} new series)\n`);
    }
  }
  
  // Final stats
  const finalSeries = await prisma.series.count();
  const finalPersons = await prisma.persons.count();
  const finalChars = await prisma.characters.count();
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ✅ IMPORT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Series: ${initialSeries} → ${finalSeries} (+${finalSeries - initialSeries})`);
  console.log(`   Persons: ${initialPersons} → ${finalPersons} (+${finalPersons - initialPersons})`);
  console.log(`   Characters: ${initialChars} → ${finalChars} (+${finalChars - initialChars})`);
  console.log(`   New series imported: ${newSeriesCount}`);
  console.log(`   Total cast imported: ${totalCastImported}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  await prisma.$disconnect();
}

main().catch(console.error);
