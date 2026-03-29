/**
 * Fix Missing Trailers Script
 * Fetches trailers from TMDB for all series that have null/empty trailers
 * 
 * Usage: npx tsx scripts/fix-missing-trailers.ts
 */

import prisma from '../lib/prisma';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function fetchTrailersFromTMDB(tmdbId: number): Promise<any[]> {
  try {
    // Try German first
    const deRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=de-DE`
    );
    const deData = await deRes.json();
    
    if (deData.results && deData.results.length > 0) {
      return deData.results;
    }
    
    // Fallback to English
    const enRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
    );
    const enData = await enRes.json();
    
    return enData.results || [];
  } catch (error) {
    console.error(`Error fetching trailers for ${tmdbId}:`, error);
    return [];
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('FIX MISSING TRAILERS');
  console.log('='.repeat(60));
  
  if (!TMDB_API_KEY) {
    console.error('ERROR: TMDB_API_KEY not set');
    process.exit(1);
  }
  
  // Find all series without trailers
  const seriesWithoutTrailers = await prisma.series.findMany({
    where: {
      OR: [
        { trailers: { equals: null } },
        { trailers: { equals: [] } }
      ]
    },
    select: {
      tmdbId: true,
      name: true,
      title: true
    }
  });
  
  console.log(`Found ${seriesWithoutTrailers.length} series without trailers\n`);
  
  let fixed = 0;
  let noTrailersFound = 0;
  
  for (const series of seriesWithoutTrailers) {
    const name = series.name || series.title;
    process.stdout.write(`${series.tmdbId} - ${name}: `);
    
    const trailers = await fetchTrailersFromTMDB(series.tmdbId);
    
    if (trailers.length > 0) {
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: { trailers }
      });
      console.log(`✅ ${trailers.length} trailers`);
      fixed++;
    } else {
      console.log(`❌ keine Trailer auf TMDB`);
      noTrailersFound++;
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 250));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`FERTIG: ${fixed} gefixt, ${noTrailersFound} ohne Trailer auf TMDB`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
