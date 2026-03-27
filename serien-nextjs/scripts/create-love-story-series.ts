/**
 * Create "Love Story" (2026) series in database
 * Run with: npx tsx scripts/create-love-story-series.ts
 */
import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';

const prisma = new PrismaClient();

async function createSeries() {
  const tmdbId = 131142; // Love Story (2026)
  
  // Check if already exists
  const existing = await prisma.series.findUnique({ where: { tmdbId } });
  if (existing) {
    console.log('✅ Serie existiert bereits:', existing.name);
    console.log('   URL: /serie/' + existing.slug);
    await prisma.$disconnect();
    return;
  }
  
  console.log('📥 Fetching TMDB details for Love Story (ID: 131142)...');
  const details = await getTvDetailsComplete(tmdbId, 'de-DE');
  
  if (!details) {
    console.log('❌ TMDB fetch failed');
    await prisma.$disconnect();
    return;
  }
  
  console.log('📝 Creating series...');
  console.log('   Name:', details.name);
  console.log('   First Air:', details.firstAirDate);
  console.log('   Status:', details.status);
  
  const series = await prisma.series.create({
    data: {
      tmdbId,
      name: details.name,
      title: details.name,
      slug: 'love-story',
      posterPath: details.posterPath,
      backdropPath: details.backdropPath,
      overview: details.overview || '',
      status: details.status,
      firstAirDate: details.firstAirDate ? new Date(details.firstAirDate) : null,
      trailers: details.trailers || [],
      updatedAt: new Date(),
    }
  });
  
  console.log('\n✅ Serie erstellt!');
  console.log('   Name:', series.name);
  console.log('   Slug:', series.slug);
  console.log('   URL: /serie/love-story');
  console.log('   TMDB ID:', series.tmdbId);
  
  await prisma.$disconnect();
}

createSeries().catch(console.error);
