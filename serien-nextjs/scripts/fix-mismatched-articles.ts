/**
 * Fix articles that were incorrectly assigned to wrong series
 * due to the old substring-matching bug
 */
import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';
import { generateSeriesSlug } from '../lib/slug-utils';

const prisma = new PrismaClient();

// Articles to fix with their correct TMDB IDs
const FIXES = [
  {
    articleId: 'pipeline-v2-1774639898645',
    slug: 'dune-prophecy-staffel-2-abgeschlossen',
    correctSeriesName: 'Dune: Prophecy',
    correctTmdbId: 90228
  },
  {
    articleId: 'pipeline-v2-1774636273754',
    slug: 'michael-fassbender-in-neuer-netflix-serie-kennedy',
    correctSeriesName: 'Kennedy',
    correctTmdbId: 15800
  }
];

async function ensureSeriesExists(tmdbId: number, name: string) {
  let series = await prisma.series.findUnique({
    where: { tmdbId }
  });
  
  if (!series) {
    console.log(`  📥 Creating series "${name}" (TMDB: ${tmdbId})...`);
    
    const details = await getTvDetailsComplete(tmdbId, 'de-DE');
    
    if (!details) {
      console.log(`  ❌ Failed to fetch TMDB details for ${tmdbId}`);
      return null;
    }
    
    series = await prisma.series.create({
      data: {
        tmdbId,
        name: details.name,
        title: details.name,
        slug: generateSeriesSlug(details.name, tmdbId),
        posterPath: details.posterPath,
        backdropPath: details.backdropPath,
        overview: details.overview || '',
        status: details.status,
        firstAirDate: details.firstAirDate ? new Date(details.firstAirDate) : null,
        trailers: details.trailers || [],
        updatedAt: new Date(),
      }
    });
    
    console.log(`  ✅ Series created: ${series.name}`);
  } else {
    console.log(`  ✅ Series exists: ${series.name}`);
  }
  
  return series;
}

async function fixArticles() {
  console.log('='.repeat(70));
  console.log('FIXING MISMATCHED ARTICLES');
  console.log('='.repeat(70));
  
  for (const fix of FIXES) {
    console.log(`\n📄 Fixing: ${fix.slug}`);
    console.log(`   Correct series: ${fix.correctSeriesName} (TMDB: ${fix.correctTmdbId})`);
    
    // Ensure the correct series exists
    const series = await ensureSeriesExists(fix.correctTmdbId, fix.correctSeriesName);
    
    if (!series) {
      console.log(`   ❌ Skipping - could not create series`);
      continue;
    }
    
    // Update the article
    try {
      await prisma.articles.update({
        where: { id: fix.articleId },
        data: {
          primarySeriesId: fix.correctTmdbId,
          tmdbId: fix.correctTmdbId,
          heroImageUrl: series.backdropPath
            ? `https://image.tmdb.org/t/p/original${series.backdropPath}`
            : undefined
        }
      });
      
      console.log(`   ✅ Article updated to ${fix.correctSeriesName}`);
    } catch (error: any) {
      console.log(`   ❌ Failed to update article: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('FIX COMPLETE');
  console.log('='.repeat(70));
  
  await prisma.$disconnect();
}

fixArticles().catch(console.error);
