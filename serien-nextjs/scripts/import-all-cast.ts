/**
 * MASS CAST IMPORTER
 * 
 * Imports ALL cast members from ALL series in the database
 * This will populate the persons table with thousands of actors
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
console.log(`🔑 TMDB API Key loaded: ${TMDB_API_KEY.substring(0, 8)}...`);
const TMDB_BASE = 'https://api.themoviedb.org/3';

interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  gender: number;
  known_for_department: string;
}

interface TMDBCreditsResponse {
  cast: TMDBCastMember[];
}

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests (10 req/sec)

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

function generatePersonId(tmdbId: number, name: string): string {
  // Format: tmdbId-slugified-name (same as slug but used as ID)
  return generateSlug(name, tmdbId);
}

async function importCastForSeries(seriesTmdbId: number, seriesName: string): Promise<number> {
  try {
    // Fetch credits from TMDB
    const url = `${TMDB_BASE}/tv/${seriesTmdbId}/credits?api_key=${TMDB_API_KEY}&language=de-DE`;
    const data: TMDBCreditsResponse = await rateLimitedFetch(url);
    
    if (!data.cast || data.cast.length === 0) {
      return 0;
    }
    
    // Take top 15 cast members
    const topCast = data.cast
      .filter(c => c.known_for_department === 'Acting')
      .slice(0, 15);
    
    if (topCast.length === 0) {
      return 0;
    }
    
    let importedCount = 0;
    
    for (const member of topCast) {
      try {
        const personId = generatePersonId(member.id, member.name);
        const personSlug = generateSlug(member.name, member.id);
        
        // Upsert person
        await prisma.persons.upsert({
          where: { tmdbId: member.id },
          create: {
            id: personId,
            tmdbId: member.id,
            name: member.name,
            slug: personSlug,
            profilePath: member.profile_path,
            updatedAt: new Date(),
          },
          update: {
            name: member.name,
            profilePath: member.profile_path,
            updatedAt: new Date(),
          },
        });
        
        // Upsert character (if character name exists)
        if (member.character && member.character.trim()) {
          const charName = member.character.split('/')[0].trim();
          const charSlug = generateSlug(charName, member.id);
          
          await prisma.characters.upsert({
            where: {
              seriesTmdbId_name: {
                seriesTmdbId: seriesTmdbId,
                name: member.character,
              },
            },
            create: {
              name: member.character,
              slug: charSlug,
              seriesTmdbId: seriesTmdbId,
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
        
        importedCount++;
      } catch (dbErr) {
        // Skip silently - likely duplicate or constraint error
      }
    }
    
    return importedCount;
  } catch (err) {
    return 0;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('   🎬 MASS CAST IMPORTER');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Get all series
  const allSeries = await prisma.series.findMany({
    select: { tmdbId: true, name: true },
    orderBy: { name: 'asc' },
  });
  
  console.log(`\n📺 Found ${allSeries.length} series in database\n`);
  
  // Get existing person count
  const existingPersons = await prisma.persons.count();
  console.log(`👤 Existing persons: ${existingPersons}\n`);
  
  let totalImported = 0;
  let seriesProcessed = 0;
  let seriesWithNewCast = 0;
  
  // Process in batches
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < allSeries.length; i += BATCH_SIZE) {
    const batch = allSeries.slice(i, i + BATCH_SIZE);
    
    // Process batch in parallel
    const results = await Promise.all(
      batch.map(async (series) => {
        const count = await importCastForSeries(series.tmdbId, series.name);
        return { series, count };
      })
    );
    
    // Log results
    for (const { series, count } of results) {
      seriesProcessed++;
      if (count > 0) {
        seriesWithNewCast++;
        totalImported += count;
        console.log(`   ✅ ${series.name}: +${count} cast members`);
      }
    }
    
    // Progress update every 50 series
    if (seriesProcessed % 50 === 0) {
      console.log(`\n   📊 Progress: ${seriesProcessed}/${allSeries.length} series (${totalImported} imported)\n`);
    }
  }
  
  // Final stats
  const finalPersonCount = await prisma.persons.count();
  const finalCharacterCount = await prisma.characters.count();
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   ✅ IMPORT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   Series processed: ${seriesProcessed}`);
  console.log(`   Series with new cast: ${seriesWithNewCast}`);
  console.log(`   Total cast imported: ${totalImported}`);
  console.log(`   Persons in DB: ${existingPersons} → ${finalPersonCount} (+${finalPersonCount - existingPersons})`);
  console.log(`   Characters in DB: ${finalCharacterCount}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  await prisma.$disconnect();
}

main().catch(console.error);
