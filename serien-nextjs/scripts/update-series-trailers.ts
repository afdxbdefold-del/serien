#!/usr/bin/env tsx
/**
 * Update series with trailer data from TMDB
 */

import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';

const prisma = new PrismaClient();

async function updateSeriesTrailers(seriesId: number) {
  console.log(`\n🔍 Fetching trailer data for series ${seriesId}...`);

  try {
    // Get complete details from TMDB (includes trailers)
    const details = await getTvDetailsComplete(seriesId);

    if (!details) {
      console.log('❌ Series not found on TMDB');
      return;
    }

    console.log(`✅ Found: ${details.name}`);
    console.log(`   Trailers: ${details.trailers?.length || 0}`);

    if (details.trailers && details.trailers.length > 0) {
      // Update series with trailer data
      await prisma.series.update({
        where: { tmdbId: seriesId },
        data: {
          trailers: details.trailers,
        },
      });

      console.log('✅ Trailer data updated in database');
      
      // Show trailer info
      details.trailers.slice(0, 3).forEach((trailer: any) => {
        console.log(`   - ${trailer.name} (${trailer.type}, ${trailer.iso_639_1})`);
      });
    } else {
      console.log('⚠️  No trailers available for this series');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Get series ID from command line or default to School Spirits
const seriesId = process.argv[2] ? parseInt(process.argv[2]) : 208397;

updateSeriesTrailers(seriesId)
  .then(() => {
    console.log('\n✅ Done!');
    prisma.$disconnect();
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
