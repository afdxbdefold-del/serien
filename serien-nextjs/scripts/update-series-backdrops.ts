/**
 * Update Existing Series with Top 10 Backdrops
 * 
 * Usage: npx tsx scripts/update-series-backdrops.ts [tmdbId] [--force]
 * Without tmdbId: Updates ALL series
 * With tmdbId: Updates specific series
 * --force: Updates even if backdrops already exist
 */

import { PrismaClient } from '@prisma/client';
import { fetchTopBackdrops } from '../lib/tmdb-backdrops';

const prisma = new PrismaClient();

async function updateSeriesBackdrops(tmdbId?: number, force: boolean = false) {
  try {
    let seriesToUpdate;
    
    if (tmdbId) {
      // Update specific series
      const series = await prisma.series.findUnique({
        where: { tmdbId },
        select: { tmdbId: true, name: true, title: true, backdrops: true }
      });
      
      if (!series) {
        console.error(`❌ Series ${tmdbId} not found`);
        return;
      }
      
      seriesToUpdate = [series];
    } else {
      // Update all series
      seriesToUpdate = await prisma.series.findMany({
        select: { tmdbId: true, name: true, title: true, backdrops: true }
      });
    }
    
    console.log(`\n🎬 Updating ${seriesToUpdate.length} series with top 10 backdrops...\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const series of seriesToUpdate) {
      const seriesName = series.name || series.title;
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📺 ${seriesName} (ID: ${series.tmdbId})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // Check if already has backdrops (and not forcing update)
      if (!force && series.backdrops && Array.isArray(series.backdrops) && series.backdrops.length >= 10) {
        console.log(`⊘ Skipping: Already has ${series.backdrops.length} backdrops (use --force to update)`);
        skippedCount++;
        continue;
      }
      
      if (series.backdrops && Array.isArray(series.backdrops) && series.backdrops.length > 0 && series.backdrops.length < 10) {
        console.log(`🔄 Upgrading from ${series.backdrops.length} to 10 backdrops...`);
      }
      
      // Fetch top 10 backdrops
      const topBackdrops = await fetchTopBackdrops('tv', series.tmdbId, 10);
      
      if (topBackdrops.length === 0) {
        console.log('⚠️  No backdrops found on TMDB');
        skippedCount++;
        continue;
      }
      
      // Update series
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: {
          backdrops: topBackdrops,
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ Updated with ${topBackdrops.length} backdrops`);
      updatedCount++;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 SUMMARY`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Updated: ${updatedCount}`);
    console.log(`⊘ Skipped: ${skippedCount}`);
    console.log(`📺 Total: ${seriesToUpdate.length}`);
    console.log('');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const tmdbId = args[0] && !args[0].startsWith('--') ? parseInt(args[0]) : undefined;
  const force = args.includes('--force');
  
  if (tmdbId && isNaN(tmdbId)) {
    console.error('❌ Invalid TMDB ID');
    process.exit(1);
  }
  
  await updateSeriesBackdrops(tmdbId, force);
}

main();
