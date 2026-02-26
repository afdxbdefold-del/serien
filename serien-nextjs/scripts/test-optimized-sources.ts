/**
 * Test Script: Optimierte Quellen-Reihenfolge + Cookie-Auth
 * Tests the new IMDB → Vimeo → TMDB → YouTube fallback with cookie extraction
 */

import { 
  searchIMDBTrailer, 
  searchVimeoTrailer, 
  searchYouTubeTrailer,
  downloadVideoTrailer 
} from '../lib/trailer-downloader';

// Test cases
const testSeries = [
  { name: 'Stranger Things', tmdbId: 66732 },
  { name: 'The Last of Us', tmdbId: 100088 },
  { name: 'Wednesday', tmdbId: 119051 },
];

async function testOptimizedSources() {
  console.log('🧪 Testing Optimized 4-Source Fallback System');
  console.log('='.repeat(70));
  console.log('Priority: IMDB → Vimeo → TMDB → YouTube (with cookies)\n');

  for (const series of testSeries) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📺 Testing: ${series.name} (TMDB: ${series.tmdbId})`);
    console.log('─'.repeat(70));

    let videoId: string | null = null;
    let source: string | null = null;

    // Source 1: IMDB
    console.log('\n🔍 [1/4] Searching IMDB...');
    try {
      videoId = await searchIMDBTrailer(series.name, series.tmdbId);
      if (videoId) {
        source = 'IMDB';
        console.log(`✅ Found on IMDB: ${videoId}`);
      } else {
        console.log('⏭️  Not found on IMDB');
      }
    } catch (error: any) {
      console.log(`❌ IMDB error: ${error.message}`);
    }

    // Source 2: Vimeo
    if (!videoId) {
      console.log('\n🔍 [2/4] Searching Vimeo...');
      try {
        videoId = await searchVimeoTrailer(series.name);
        if (videoId) {
          source = 'Vimeo';
          console.log(`✅ Found on Vimeo: ${videoId}`);
        } else {
          console.log('⏭️  Not found on Vimeo');
        }
      } catch (error: any) {
        console.log(`❌ Vimeo error: ${error.message}`);
      }
    }

    // Source 3: TMDB (würde normalerweise hier gecheckt)
    // Übersprungen in diesem Test, da wir direkt zu YouTube gehen

    // Source 4: YouTube
    if (!videoId) {
      console.log('\n🔍 [4/4] Searching YouTube (with cookie auth)...');
      try {
        videoId = await searchYouTubeTrailer(series.name);
        if (videoId) {
          source = 'YouTube';
          console.log(`✅ Found on YouTube: ${videoId}`);
        } else {
          console.log('❌ Not found on any source');
        }
      } catch (error: any) {
        console.log(`❌ YouTube error: ${error.message}`);
      }
    }

    // Summary
    if (videoId && source) {
      console.log(`\n✅ RESULT: Found on ${source}`);
      console.log(`   Video ID: ${videoId}`);
      
      // Optional: Test download (commented out to save time)
      // console.log('\n🎬 Testing download...');
      // const downloadResult = await downloadVideoTrailer(videoId, series.name);
      // console.log(downloadResult.success ? '✅ Download successful' : `❌ Download failed: ${downloadResult.error}`);
    } else {
      console.log('\n❌ RESULT: Not found on any source');
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Test complete');
}

testOptimizedSources().catch(console.error);
