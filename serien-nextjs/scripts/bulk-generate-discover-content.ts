/**
 * Bulk Generate Discover Content for All Series
 * Generates evergreen editorial content for Series Hub pages
 */

import { PrismaClient } from '@prisma/client';
import { generateDiscoverContent } from '../lib/discover-content-generator';

const prisma = new PrismaClient();

async function generateDiscoverForSeries(tmdbId: number): Promise<boolean> {
  try {
    const series = await prisma.series.findUnique({
      where: { tmdbId },
      select: {
        name: true,
        title: true,
        overview: true,
        genres: true,
        firstAirDate: true,
        numberOfSeasons: true,
        status: true,
        networks: true,
        cast: true,
        crew: true,
        discoverIntro: true,
      }
    });

    if (!series) {
      console.log('   ⏭️  Series not found');
      return false;
    }

    const seriesName = series.name || series.title;

    // Skip if already has Discover content
    if (series.discoverIntro && series.discoverIntro.length > 100) {
      console.log(`   ✓ ${seriesName} already has Discover content`);
      return true;
    }

    console.log(`   🤖 Generating for: ${seriesName}`);

    const cast = series.cast as any[] || [];
    const crew = series.crew as any[] || [];
    const creators = crew.filter(c => c.job === 'Creator' || c.job === 'Executive Producer').map(c => c.name);

    const content = await generateDiscoverContent({
      seriesName,
      overview: series.overview || '',
      genres: series.genres as string[] || [],
      firstAirYear: series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null,
      numberOfSeasons: series.numberOfSeasons,
      status: series.status,
      networks: series.networks as string[] || [],
      creators,
      cast: cast.slice(0, 3),
    });

    // Save to database
    await prisma.series.update({
      where: { tmdbId },
      data: {
        discoverIntro: content.evergreenIntro,
        discoverStatus: content.seriesStatus,
        discoverNewsContext: content.newsContext,
        discoverQA: content.miniQA,
        updatedAt: new Date(),
      },
    });

    console.log(`   ✅ Generated: ${content.evergreenIntro.length} chars intro, ${content.miniQA.length} Q&A`);
    return true;

  } catch (error: any) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  const targetTmdbId = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (targetTmdbId) {
    // Single series
    console.log(`\n📝 Generating Discover Content for Series ${targetTmdbId}\n`);
    await generateDiscoverForSeries(targetTmdbId);
  } else {
    // Bulk: All series without Discover content
    console.log('\n📝 Bulk Generate: Discover Content for All Series\n');

    const seriesList = await prisma.series.findMany({
      where: {
        OR: [
          { discoverIntro: null },
          { discoverIntro: '' },
        ],
      },
      select: {
        tmdbId: true,
        name: true,
        title: true,
      },
      orderBy: { popularity: 'desc' },
      take: parseInt(process.env.DISCOVER_BULK_LIMIT || '500', 10),
    });

    console.log(`📊 Found ${seriesList.length} series without Discover content\n`);

    let successCount = 0;
    let failCount = 0;

    // Concurrency: process N series in parallel
    const concurrency = parseInt(process.env.DISCOVER_BULK_CONCURRENCY || '5', 10);
    for (let batchStart = 0; batchStart < seriesList.length; batchStart += concurrency) {
      const batch = seriesList.slice(batchStart, batchStart + concurrency);
      const results = await Promise.all(batch.map(async (series, j) => {
        const idx = batchStart + j;
        console.log(`[${idx + 1}/${seriesList.length}] ${series.name || series.title} (TMDB: ${series.tmdbId})`);
        return await generateDiscoverForSeries(series.tmdbId);
      }));
      successCount += results.filter(Boolean).length;
      failCount += results.filter(r => !r).length;
      // Gentle pause between batches
      if (batchStart + concurrency < seriesList.length) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📝 Total: ${seriesList.length}`);
    console.log('='.repeat(60));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
