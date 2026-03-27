/**
 * Fetch trailers for all series without trailers
 * Run: npx tsx scripts/fetch-series-trailers.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function fetchTrailers(tmdbId: number): Promise<any[]> {
  // Try German first, then English
  for (const lang of ['de-DE', 'en-US']) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=${lang}`
      );
      const data = await res.json();
      const videos = data.results || [];
      
      // Filter for YouTube trailers/teasers
      const trailers = videos.filter(
        (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
      );
      
      if (trailers.length > 0) {
        return trailers;
      }
    } catch (e) {
      console.error(`Error fetching trailers for ${tmdbId}:`, e);
    }
  }
  return [];
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🎬 SERIES TRAILER FETCH');
  console.log('═'.repeat(60));

  // Get series without trailers, ordered by popularity
  const seriesWithoutTrailers = await prisma.series.findMany({
    where: {
      OR: [
        { trailers: { equals: null } },
        { trailers: { equals: [] } }
      ]
    },
    select: { tmdbId: true, name: true, popularity: true },
    orderBy: { popularity: 'desc' },
    take: 200
  });

  console.log(`Found ${seriesWithoutTrailers.length} series without trailers\n`);

  let updated = 0;
  let skipped = 0;

  for (const series of seriesWithoutTrailers) {
    const trailers = await fetchTrailers(series.tmdbId);
    
    if (trailers.length > 0) {
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: { trailers }
      });
      console.log(`✅ ${series.name}: ${trailers.length} trailer(s)`);
      updated++;
    } else {
      console.log(`⚠️ ${series.name}: no trailers found`);
      skipped++;
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Updated: ${updated} | ⚠️ Skipped: ${skipped}`);
  console.log('═'.repeat(60));

  await prisma.$disconnect();
}

main().catch(console.error);
