#!/usr/bin/env tsx
/**
 * TRAILER CLEANUP - Weekly Cron Job
 * 
 * Marks old/unused trailers as soft-deleted in the database
 * Note: Emergent Object Storage does not support delete API,
 * so files remain in cloud storage
 * 
 * Usage:
 *   npx tsx scripts/cleanup-trailers.ts [--days=30] [--dry-run]
 * 
 * Cron (weekly, Sunday 3am):
 *   0 3 * * 0 cd /app/serien-nextjs && npx tsx scripts/cleanup-trailers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CleanupOptions {
  daysOld: number;
  dryRun: boolean;
}

async function cleanupOldTrailers(options: CleanupOptions) {
  console.log('🧹 Starting trailer cleanup...\n');
  console.log(`Configuration:`);
  console.log(`  - Remove trailers older than: ${options.daysOld} days`);
  console.log(`  - Dry run: ${options.dryRun ? 'YES (no changes)' : 'NO'}`);
  console.log('');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - options.daysOld);

  try {
    // Find articles with trailers older than cutoff date
    const oldArticles = await prisma.articles.findMany({
      where: {
        trailerLocalUrl: { not: null },
        publishedAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        trailerLocalUrl: true,
      },
      orderBy: {
        publishedAt: 'asc',
      },
    });

    if (oldArticles.length === 0) {
      console.log('✅ No old trailers found');
      return { cleaned: 0, kept: 0 };
    }

    console.log(`📊 Found ${oldArticles.length} articles with old trailers:\n`);

    // Group by series to check if we should keep at least one trailer per series
    const seriesMap = new Map<number, typeof oldArticles>();
    
    for (const article of oldArticles) {
      const seriesId = await prisma.article
        .findUnique({
          where: { id: article.id },
          select: { primarySeriesId: true },
        })
        .then((a) => a?.primarySeriesId);

      if (seriesId) {
        if (!seriesMap.has(seriesId)) {
          seriesMap.set(seriesId, []);
        }
        seriesMap.get(seriesId)?.push(article);
      }
    }

    let cleanedCount = 0;
    let keptCount = 0;

    for (const [seriesId, articles] of seriesMap) {
      // Keep the newest trailer for each series
      const sortedArticles = articles.sort((a, b) => 
        (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0)
      );

      const toKeep = sortedArticles[0];
      const toClean = sortedArticles.slice(1);

      console.log(`\n📺 Series ID ${seriesId}:`);
      console.log(`   Keeping: "${toKeep.title}" (${toKeep.publishedAt?.toLocaleDateString()})`);
      
      if (toClean.length > 0) {
        console.log(`   Cleaning: ${toClean.length} older trailer(s)`);
        
        for (const article of toClean) {
          console.log(`     - "${article.title}" (${article.publishedAt?.toLocaleDateString()})`);
        }

        if (!options.dryRun) {
          // Soft delete: set trailerLocalUrl to null
          await prisma.articles.updateMany({
            where: {
              id: { in: toClean.map((a) => a.id) },
            },
            data: {
              trailerLocalUrl: null,
            },
          });
        }

        cleanedCount += toClean.length;
      }

      keptCount++;
    }

    console.log('\n' + '─'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Trailers cleaned: ${cleanedCount}`);
    console.log(`   Trailers kept: ${keptCount}`);
    
    if (options.dryRun) {
      console.log(`\n⚠️  DRY RUN - No changes made`);
      console.log(`   Run without --dry-run to apply changes`);
    } else {
      console.log(`\n✅ Cleanup complete`);
    }

    return { cleaned: cleanedCount, kept: keptCount };

  } catch (error: any) {
    console.error('\n❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// ========== CLI ==========
async function main() {
  const args = process.argv.slice(2);
  
  const options: CleanupOptions = {
    daysOld: 30,
    dryRun: false,
  };

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      options.daysOld = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npx tsx scripts/cleanup-trailers.ts [OPTIONS]');
      console.log('');
      console.log('Options:');
      console.log('  --days=N     Remove trailers older than N days (default: 30)');
      console.log('  --dry-run    Show what would be removed without making changes');
      console.log('  --help, -h   Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  npx tsx scripts/cleanup-trailers.ts');
      console.log('  npx tsx scripts/cleanup-trailers.ts --days=60');
      console.log('  npx tsx scripts/cleanup-trailers.ts --dry-run');
      process.exit(0);
    }
  }

  const startTime = Date.now();
  await cleanupOldTrailers(options);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Completed in ${duration}s`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
