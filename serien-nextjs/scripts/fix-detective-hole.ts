import { PrismaClient } from '@prisma/client';
import { getTvDetailsComplete } from '../lib/tmdb';

const prisma = new PrismaClient();

async function fix() {
  // Correct TMDB ID for Harry Hole
  const HARRY_HOLE_TMDB_ID = 249597;
  
  // Ensure Harry Hole series exists
  let series = await prisma.series.findUnique({
    where: { tmdbId: HARRY_HOLE_TMDB_ID }
  });
  
  if (!series) {
    console.log('Creating Harry Hole series...');
    const details = await getTvDetailsComplete(HARRY_HOLE_TMDB_ID, 'de-DE');
    if (details) {
      series = await prisma.series.create({
        data: {
          tmdbId: HARRY_HOLE_TMDB_ID,
          name: details.name,
          title: details.name,
          slug: 'harry-hole',
          posterPath: details.posterPath,
          backdropPath: details.backdropPath,
          overview: details.overview || '',
          status: details.status,
          firstAirDate: details.firstAirDate ? new Date(details.firstAirDate) : null,
          trailers: details.trailers || [],
          updatedAt: new Date(),
        }
      });
      console.log('✅ Created:', series.name);
    }
  } else {
    console.log('✅ Harry Hole exists:', series.name);
  }
  
  // Fix the mismatched article
  const result = await prisma.articles.updateMany({
    where: {
      slug: 'netflix-serie-detective-hole-erreicht-100-bei-rotten-tomatoes'
    },
    data: {
      primarySeriesId: HARRY_HOLE_TMDB_ID,
      tmdbId: HARRY_HOLE_TMDB_ID,
      heroImageUrl: series?.backdropPath 
        ? `https://image.tmdb.org/t/p/original${series.backdropPath}`
        : undefined
    }
  });
  
  console.log(`✅ Fixed ${result.count} article(s)`);
  
  await prisma.$disconnect();
}

fix().catch(console.error);
