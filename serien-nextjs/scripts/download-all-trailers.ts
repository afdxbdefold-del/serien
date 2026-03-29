/**
 * Download All Series Trailers Script
 * Downloads trailers for ALL series and stores them locally
 * 
 * Usage: npx tsx scripts/download-all-trailers.ts
 * 
 * Options:
 *   --limit=N     Process only N series
 *   --skip=N      Skip first N series
 *   --force       Re-download even if trailer exists
 */

import prisma from '../lib/prisma';
import { downloadYouTubeTrailer, searchYouTubeTrailerViaAPI } from '../lib/trailer-downloader';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Parse command line arguments
const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || Infinity;
const skip = parseInt(args.find(a => a.startsWith('--skip='))?.split('=')[1] || '0') || 0;
const force = args.includes('--force');

interface TrailerInfo {
  key: string;
  site: string;
  type: string;
  name: string;
}

async function fetchTrailersFromTMDB(tmdbId: number): Promise<TrailerInfo[]> {
  try {
    // Try German first
    const deRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=de-DE`
    );
    const deData = await deRes.json();
    
    const deTrailers = (deData.results || []).filter((v: any) => 
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    
    if (deTrailers.length > 0) {
      return deTrailers;
    }
    
    // Fallback to English
    const enRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
    );
    const enData = await enRes.json();
    
    return (enData.results || []).filter((v: any) => 
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
  } catch (error) {
    return [];
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('DOWNLOAD ALL SERIES TRAILERS');
  console.log('='.repeat(60));
  console.log(`Options: limit=${limit}, skip=${skip}, force=${force}`);
  console.log('');
  
  if (!TMDB_API_KEY) {
    console.error('ERROR: TMDB_API_KEY not set');
    process.exit(1);
  }
  
  // Find series to process
  const whereClause = force ? {} : { localTrailerPath: null };
  
  const allSeries = await prisma.series.findMany({
    where: whereClause,
    select: {
      tmdbId: true,
      name: true,
      title: true,
      trailers: true,
      localTrailerPath: true
    },
    orderBy: { tmdbId: 'asc' },
    skip: skip,
    take: limit === Infinity ? undefined : limit
  });
  
  console.log(`Found ${allSeries.length} series to process\n`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let noTrailer = 0;
  
  for (let i = 0; i < allSeries.length; i++) {
    const series = allSeries[i];
    const name = series.name || series.title;
    
    console.log(`[${i + 1}/${allSeries.length}] ${name} (${series.tmdbId})`);
    
    // Skip if already has local trailer (unless force)
    if (series.localTrailerPath && !force) {
      console.log(`   ⏭️  Already has local trailer`);
      skipped++;
      continue;
    }
    
    // Get trailer ID from TMDB
    let trailerId: string | null = null;
    
    // First check if we have trailers in DB
    const dbTrailers = series.trailers as TrailerInfo[] | null;
    if (dbTrailers && Array.isArray(dbTrailers) && dbTrailers.length > 0) {
      const youtubeTrailer = dbTrailers.find(t => t.site === 'YouTube');
      if (youtubeTrailer) {
        trailerId = youtubeTrailer.key;
        console.log(`   📦 Using DB trailer: ${trailerId}`);
      }
    }
    
    // If no trailer in DB, fetch from TMDB
    if (!trailerId) {
      console.log(`   🌐 Fetching from TMDB...`);
      const tmdbTrailers = await fetchTrailersFromTMDB(series.tmdbId);
      
      if (tmdbTrailers.length > 0) {
        trailerId = tmdbTrailers[0].key;
        console.log(`   📦 Found on TMDB: ${trailerId}`);
        
        // Save trailers to DB for future use
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { trailers: tmdbTrailers }
        });
      }
    }
    
    // If still no trailer, search YouTube directly
    if (!trailerId) {
      console.log(`   🔍 Searching YouTube...`);
      trailerId = await searchYouTubeTrailerViaAPI(name, 'de');
      
      if (!trailerId) {
        trailerId = await searchYouTubeTrailerViaAPI(name, 'en');
      }
      
      if (trailerId) {
        console.log(`   📦 Found on YouTube: ${trailerId}`);
      }
    }
    
    // Download trailer
    if (trailerId) {
      console.log(`   📥 Downloading...`);
      
      try {
        const result = await downloadYouTubeTrailer(trailerId, name);
        
        if (result.success && result.localPath) {
          await prisma.series.update({
            where: { tmdbId: series.tmdbId },
            data: { localTrailerPath: result.localPath }
          });
          console.log(`   ✅ Saved: ${result.localPath}`);
          success++;
        } else {
          console.log(`   ❌ Download failed: ${result.error}`);
          failed++;
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        failed++;
      }
    } else {
      console.log(`   ⚠️  No trailer found anywhere`);
      noTrailer++;
    }
    
    // Rate limiting between downloads
    await new Promise(r => setTimeout(r, 1000));
    console.log('');
  }
  
  console.log('='.repeat(60));
  console.log('ERGEBNIS:');
  console.log(`   ✅ Erfolgreich: ${success}`);
  console.log(`   ❌ Fehlgeschlagen: ${failed}`);
  console.log(`   ⏭️  Übersprungen: ${skipped}`);
  console.log(`   ⚠️  Kein Trailer: ${noTrailer}`);
  console.log('='.repeat(60));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
