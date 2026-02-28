/**
 * Generate and save extended overview for a specific series
 * Usage: npx tsx scripts/generate-series-overview.ts <tmdbId>
 */

import { PrismaClient } from '@prisma/client';
import { generateSeriesExtendedOverview } from '../lib/series-overview-generator';

const prisma = new PrismaClient();

async function generateOverviewForSeries(tmdbId: number) {
  try {
    console.log(`📝 Generating extended overview for series ${tmdbId}...`);

    // Fetch series data
    const series = await prisma.series.findUnique({
      where: { tmdbId },
    });

    if (!series) {
      throw new Error(`Series with tmdbId ${tmdbId} not found`);
    }

    console.log(`✓ Found series: ${series.name || series.title}`);

    // Extract data for overview generation
    const cast = (series.cast as any[]) || [];
    const crew = (series.crew as any[]) || [];
    const creators = crew
      .filter(c => c.job === 'Creator' || c.job === 'Executive Producer')
      .slice(0, 3)
      .map(c => c.name);

    const input = {
      seriesName: series.name || series.title,
      originalTitle: series.originalName || series.originalTitle,
      originalOverview: series.overview || '',
      genres: series.genres || [],
      firstAirYear: series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null,
      numberOfSeasons: series.numberOfSeasons,
      status: series.status,
      cast: cast.slice(0, 5),
      creators,
      networks: series.networks || [],
    };

    console.log('🤖 Calling GPT-5.2 to generate extended overview...');

    // Generate extended overview
    const extendedOverview = await generateSeriesExtendedOverview(input);

    console.log(`✓ Generated overview (${extendedOverview.length} characters)`);
    console.log('\n--- Preview ---');
    console.log(extendedOverview.substring(0, 200) + '...');
    console.log('--- End Preview ---\n');

    // Save to database
    await prisma.series.update({
      where: { tmdbId },
      data: {
        extendedOverview,
        updatedAt: new Date(),
      },
    });

    console.log('✅ Extended overview saved to database!');
    
    return extendedOverview;
  } catch (error) {
    console.error('❌ Error generating overview:', error);
    throw error;
  }
}

async function main() {
  const tmdbId = parseInt(process.argv[2]);

  if (!tmdbId || isNaN(tmdbId)) {
    console.error('Usage: npx tsx scripts/generate-series-overview.ts <tmdbId>');
    console.error('Example: npx tsx scripts/generate-series-overview.ts 119051');
    process.exit(1);
  }

  await generateOverviewForSeries(tmdbId);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
