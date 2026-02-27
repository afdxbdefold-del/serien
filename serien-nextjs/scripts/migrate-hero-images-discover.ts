/**
 * Migrate Hero Images to Google Discover Format
 * Upgrades all hero images from 1280x720 to 1600x900 (min 1200px width)
 */

import { PrismaClient } from '@prisma/client';
import { storeHeroImage } from '../lib/image-storage.js';

const prisma = new PrismaClient();

async function migrateHeroImages() {
  console.log('🚀 Starting Hero Image Migration to Google Discover Format...\n');
  console.log('Target: 1600x900 (16:9) - minimum 1200px width');
  console.log('━'.repeat(70));

  try {
    // Get all series with backdrop images
    const allSeries = await prisma.series.findMany({
      where: {
        OR: [
          { backdropPath: { not: null } },
          { posterPath: { not: null } }
        ]
      },
      select: {
        tmdbId: true,
        title: true,
        name: true,
        tmdbType: true,
        backdropPath: true,
        posterPath: true,
      },
    });

    console.log(`\n📊 Found ${allSeries.length} series to upgrade\n`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < allSeries.length; i++) {
      const series = allSeries[i];
      const seriesName = series.title || series.name;
      
      console.log(`\n[${i + 1}/${allSeries.length}] Upgrading: ${seriesName}`);
      console.log(`TMDB ID: ${series.tmdbId}`);

      try {
        // Use backdrop for hero (preferred)
        const tmdbPath = series.backdropPath || series.posterPath;
        
        if (!tmdbPath) {
          console.log('⚠️  No image available - skipped');
          skippedCount++;
          continue;
        }

        // Re-generate hero image with new 1600x900 format
        await storeHeroImage(
          tmdbPath,
          series.tmdbType as 'tv' | 'movie',
          series.tmdbId
        );

        console.log(`✅ Success! Hero image upgraded to 1600x900`);
        successCount++;

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        failCount++;
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log('📊 Migration Complete!');
    console.log('='.repeat(70));
    console.log(`✅ Success: ${successCount} (upgraded to 1600x900)`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📦 Total: ${allSeries.length}`);
    console.log('\n🎉 All hero images are now Google Discover ready (min. 1200px)!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateHeroImages().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
