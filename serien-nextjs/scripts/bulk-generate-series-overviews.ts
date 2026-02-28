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
    const seriesList = await prisma.series.findMany({
      where: {
        extendedOverview: null,
        // Only series with basic data
        overview: { not: null },
      },
      orderBy: [
        { articles: { _count: 'desc' } }, // Series with most articles first
        { popularity: 'desc' },
      ],
      take: 50, // Process top 50 series
      select: {
        tmdbId: true,
        name: true,
        title: true,
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

    for (let i = 0; i < seriesList.length; i++) {
      const series = seriesList[i];
      const seriesName = series.name || series.title;

      console.log(`\n[${i + 1}/${seriesList.length}] ${seriesName} (${series._count.articles} Artikel)`);
      console.log(`   TMDB ID: ${series.tmdbId}`);

      try {
        // Extract data for overview generation
        const cast = (series.cast as any[]) || [];
        const crew = (series.crew as any[]) || [];
        const creators = crew
          .filter(c => c.job === 'Creator' || c.job === 'Executive Producer')
          .slice(0, 3)
          .map(c => c.name);

        const input = {
          seriesName: seriesName,
          originalOverview: series.overview || '',
          genres: (series.genres as string[]) || [],
          firstAirYear: series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null,
          numberOfSeasons: series.numberOfSeasons,
          status: series.status,
          cast: cast.slice(0, 5),
          creators,
          networks: (series.networks as string[]) || [],
        };

        console.log('   🤖 Generiere Extended Overview...');

        // Generate extended overview
        const extendedOverview = await generateSeriesExtendedOverview(input);

        // Save to database
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: {
            extendedOverview,
            updatedAt: new Date(),
          },
        });

        console.log(`   ✅ Gespeichert (${extendedOverview.length} Zeichen)`);
        successCount++;

        // Rate limiting: Wait 2 seconds between requests to avoid overwhelming the LLM
        if (i < seriesList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`   ❌ Fehler: ${error instanceof Error ? error.message : String(error)}`);
        failCount++;
        
        // Continue with next series even if one fails
        continue;
      }
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
