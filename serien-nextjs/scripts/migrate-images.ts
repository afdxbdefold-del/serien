/**
 * Image Migration Script
 * Downloads all images from TMDB and stores them locally
 */

import { PrismaClient } from '@prisma/client';
import { storeAllImagesForItem } from '../lib/image-storage.js';

const prisma = new PrismaClient();

async function migrateImages() {
  console.log('🚀 Starting image migration...\n');
  console.log('This will download all series images from TMDB and store them locally.');
  console.log('━'.repeat(70));

  try {
    // Get all series
    const allSeries = await prisma.series.findMany({
      select: {
        tmdbId: true,
        title: true,
        name: true,
        tmdbType: true,
      },
    });

    console.log(`\n📊 Found ${allSeries.length} series to migrate\n`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < allSeries.length; i++) {
      const series = allSeries[i];
      const seriesName = series.title || series.name;
      
      console.log(`\n[${i + 1}/${allSeries.length}] Processing: ${seriesName}`);
      console.log(`TMDB ID: ${series.tmdbId}`);

      try {
        // Download and store all images
        const results = await storeAllImagesForItem(
          series.tmdbType as 'tv' | 'movie',
          series.tmdbId
        );

        if (!results.hero && !results.card && !results.og && !results.poster) {
          console.log('⚠️  No images available - skipped');
          skippedCount++;
          continue;
        }

        // Update database with new local URLs
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: {
            // Store storage paths in local URL fields
            posterLocalUrl: results.poster ? `/${results.poster}` : null,
            backdropLocalUrl: results.hero ? `/${results.hero}` : null,
          },
        });

        console.log(`✅ Success! Stored ${Object.values(results).filter(Boolean).length} images`);
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
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Skipped: ${skippedCount}`);
    console.log(`📦 Total: ${allSeries.length}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateImages().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
