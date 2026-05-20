/**
 * Bulk generate extended overviews for multiple series
 * Usage: npx tsx scripts/bulk-generate-series-overviews.ts
 */

import { PrismaClient } from '@prisma/client';
import { generateSeriesExtendedOverview } from '../lib/series-overview-generator';

const prisma = new PrismaClient();

async function bulkGenerateOverviews() {
  try {
    console.log('🚀 Bulk Extended Overview Generation gestartet\n');

    // Fetch series that don't have extended overview yet
    // Prioritize series with articles (more important series)
    const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
    const limit = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 1000;
    const seriesList = await prisma.series.findMany({
      where: {
        extendedOverview: null,
        // No filter on `overview` — the generator can fall back to Wikipedia
        // for series whose TMDB overview is empty (which is the *exact*
        // group we need to backfill).
      },
      orderBy: [
        { articles: { _count: 'desc' } }, // Series with most articles first
        { popularity: 'desc' },
      ],
      take: limit,
      select: {
        tmdbId: true,
        name: true,
        title: true,
        originalName: true,
        overview: true,
        genres: true,
        firstAirDate: true,
        numberOfSeasons: true,
        status: true,
        cast: true,
        crew: true,
        networks: true,
        _count: {
          select: { articles: true }
        }
      },
    });

    console.log(`📊 Gefunden: ${seriesList.length} Serien ohne Extended Overview\n`);

    if (seriesList.length === 0) {
      console.log('✅ Alle Serien haben bereits eine Extended Overview!');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // Concurrency: process N series in parallel batches. Default 5 keeps a
    // reasonable balance between throughput and LLM rate-limits.
    const CONC_ARG = process.argv.find(a => a.startsWith('--concurrency='));
    const concurrency = CONC_ARG ? Math.max(1, parseInt(CONC_ARG.split('=')[1], 10)) : 5;

    const processOne = async (series: typeof seriesList[number], i: number) => {
      const seriesName = series.name || series.title;
      const prefix = `[${i + 1}/${seriesList.length}] ${seriesName}`;
      try {
        const cast = (series.cast as any[]) || [];
        const crew = (series.crew as any[]) || [];
        const creators = crew
          .filter(c => c.job === 'Creator' || c.job === 'Executive Producer')
          .slice(0, 3)
          .map(c => c.name);

        const input = {
          seriesName,
          originalTitle: series.originalName ?? undefined,
          originalOverview: series.overview || '',
          genres: (series.genres as string[]) || [],
          firstAirYear: series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null,
          numberOfSeasons: series.numberOfSeasons,
          status: series.status,
          cast: cast.slice(0, 5),
          creators,
          networks: (series.networks as string[]) || [],
        };

        const extendedOverview = await generateSeriesExtendedOverview(input);
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { extendedOverview, updatedAt: new Date() },
        });
        console.log(`✅ ${prefix} (${extendedOverview.length} Zeichen)`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${prefix} — ${error instanceof Error ? error.message : String(error)}`);
        failCount++;
      }
    };

    for (let batchStart = 0; batchStart < seriesList.length; batchStart += concurrency) {
      const batch = seriesList.slice(batchStart, batchStart + concurrency);
      await Promise.all(batch.map((s, j) => processOne(s, batchStart + j)));
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 ZUSAMMENFASSUNG:');
    console.log(`   ✅ Erfolgreich: ${successCount}`);
    console.log(`   ❌ Fehlgeschlagen: ${failCount}`);
    console.log(`   📝 Total verarbeitet: ${successCount + failCount}/${seriesList.length}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Kritischer Fehler:', error);
    throw error;
  }
}

async function main() {
  await bulkGenerateOverviews();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
