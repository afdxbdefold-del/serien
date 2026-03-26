/**
 * Pre-generate Discover Data for Series Pages
 * 
 * Generates and caches:
 * - discoverQA: FAQ-style Q&A pairs
 * - discoverIntro: Cultural relevance intro text
 * - discoverStatus: Current status description
 * 
 * Run: npx tsx scripts/generate-series-discover-data.ts [--limit=10] [--force]
 */

import { PrismaClient } from '@prisma/client';
import { generateSeriesQA } from '../lib/qa-generator';
import { generateRelevanceContext, generateStatusContext } from '../lib/editorial-hook';

const prisma = new PrismaClient();

interface GenerationResult {
  tmdbId: number;
  name: string;
  success: boolean;
  error?: string;
  qaGenerated: boolean;
  introGenerated: boolean;
}

async function generateDiscoverDataForSeries(
  series: any,
  force: boolean = false
): Promise<GenerationResult> {
  const result: GenerationResult = {
    tmdbId: series.tmdbId,
    name: series.name || series.title || 'Unknown',
    success: false,
    qaGenerated: false,
    introGenerated: false,
  };

  try {
    const updates: any = {};

    // Generate Q&A if missing or forced
    if (force || !series.discoverQA || (series.discoverQA as any[]).length === 0) {
      console.log(`   📝 Generating Q&A...`);
      try {
        const qa = await generateSeriesQA({
          seriesName: series.name || series.title || '',
          overview: series.overview || 'Keine Beschreibung verfügbar',
          status: series.status || 'UNKNOWN',
          numberOfSeasons: series.numberOfSeasons || 0,
          firstAirDate: series.firstAirDate?.toISOString() || new Date().toISOString(),
          lastSeasonDate: series.lastAirDate?.toISOString(),
        });
        updates.discoverQA = qa;
        result.qaGenerated = true;
        console.log(`   ✅ Q&A: ${qa.length} items`);
      } catch (qaError: any) {
        console.log(`   ⚠️ Q&A failed: ${qaError.message}`);
      }
    } else {
      console.log(`   ⏭️ Q&A already exists (${(series.discoverQA as any[]).length} items)`);
    }

    // Generate Intro if missing or forced
    if (force || !series.discoverIntro || series.discoverIntro.length < 50) {
      console.log(`   📝 Generating Intro...`);
      try {
        const intro = await generateRelevanceContext(
          series.name || series.title || '',
          series.overview || '',
          series.status || 'UNKNOWN',
          series.voteAverage || 0,
          series.numberOfSeasons || 0
        );
        if (intro && intro.length > 50) {
          updates.discoverIntro = intro;
          result.introGenerated = true;
          console.log(`   ✅ Intro: ${intro.length} chars`);
        }
      } catch (introError: any) {
        console.log(`   ⚠️ Intro failed: ${introError.message}`);
      }
    } else {
      console.log(`   ⏭️ Intro already exists (${series.discoverIntro.length} chars)`);
    }

    // Generate Status (no LLM, just template)
    if (force || !series.discoverStatus || series.discoverStatus.length < 10) {
      const statusText = generateStatusContext(
        series.status,
        series.name || series.title || '',
        series.networks && series.networks.length > 0 ? series.networks[0] : undefined,
        series.lastAirDate,
        series.numberOfSeasons
      );
      if (statusText) {
        updates.discoverStatus = statusText;
      }
    }

    // Save updates if any
    if (Object.keys(updates).length > 0) {
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: updates,
      });
      result.success = true;
    } else {
      result.success = true; // Nothing to update, but not an error
    }

  } catch (error: any) {
    result.error = error.message;
    console.log(`   ❌ Error: ${error.message}`);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '10');
  const force = args.includes('--force');
  const popular = args.includes('--popular');

  console.log('\n' + '='.repeat(70));
  console.log('🎬 SERIES DISCOVER DATA GENERATOR');
  console.log('='.repeat(70));
  console.log(`   Limit: ${limit}`);
  console.log(`   Force regenerate: ${force}`);
  console.log(`   Popular only: ${popular}`);
  console.log('='.repeat(70) + '\n');

  // Find series that need data generated
  const whereClause: any = {};
  
  if (!force) {
    // Only series without discover data
    whereClause.OR = [
      { discoverQA: { equals: null } },
      { discoverIntro: { equals: null } },
      { discoverIntro: '' },
    ];
  }

  const orderBy: any = popular 
    ? { popularity: 'desc' }
    : { updatedAt: 'desc' };

  const series = await prisma.series.findMany({
    where: whereClause,
    orderBy,
    take: limit,
    select: {
      tmdbId: true,
      name: true,
      title: true,
      overview: true,
      status: true,
      voteAverage: true,
      numberOfSeasons: true,
      firstAirDate: true,
      lastAirDate: true,
      networks: true,
      popularity: true,
      discoverQA: true,
      discoverIntro: true,
      discoverStatus: true,
    },
  });

  console.log(`📊 Found ${series.length} series to process\n`);

  if (series.length === 0) {
    console.log('✅ All series already have discover data!');
    return;
  }

  const results: GenerationResult[] = [];

  for (let i = 0; i < series.length; i++) {
    const s = series[i];
    console.log(`\n[${i + 1}/${series.length}] ${s.name || s.title} (ID: ${s.tmdbId})`);
    
    const result = await generateDiscoverDataForSeries(s, force);
    results.push(result);

    // Rate limiting - wait between API calls
    if (i < series.length - 1) {
      console.log('   ⏳ Waiting 2s...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.success).length;
  const qaGenerated = results.filter(r => r.qaGenerated).length;
  const introGenerated = results.filter(r => r.introGenerated).length;
  
  console.log(`   Total: ${results.length}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Q&A generated: ${qaGenerated}`);
  console.log(`   Intros generated: ${introGenerated}`);
  console.log('='.repeat(70) + '\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
