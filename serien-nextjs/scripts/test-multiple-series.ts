/**
 * Test: Multiple Series Trailer Download
 * Tests with 3-5 different series as requested
 */

import * as dotenv from 'dotenv';
dotenv.config();

interface SeriesTest {
  name: string;
  tmdbId: number;
  description: string;
}

const testSeries: SeriesTest[] = [
  { name: 'Stranger Things', tmdbId: 66732, description: 'Netflix Original - Very popular' },
  { name: 'The Last of Us', tmdbId: 100088, description: 'HBO Max - Game adaptation' },
  { name: 'Wednesday', tmdbId: 119051, description: 'Netflix - Tim Burton series' },
  { name: 'House of the Dragon', tmdbId: 94997, description: 'HBO - GOT prequel' },
  { name: 'The Mandalorian', tmdbId: 82856, description: 'Disney+ - Star Wars' },
];

async function testMultipleSeries() {
  console.log('═'.repeat(70));
  console.log('🎬 Multi-Series Trailer Download Test');
  console.log('   Testing with 5 different series across studios');
  console.log('═'.repeat(70));
  console.log(`\n📅 Test Date: ${new Date().toISOString()}\n`);
  
  const { 
    searchFilmStartsTrailer, 
    searchVideoBusterTrailer, 
    searchIMDBTrailer, 
    searchVimeoTrailer, 
    searchYouTubeTrailer,
    downloadVideoTrailer
  } = await import('../lib/trailer-downloader');
  
  const results: { 
    series: string; 
    source: string; 
    videoId: string | null; 
    downloadSuccess: boolean;
    cloudPath?: string;
    error?: string 
  }[] = [];
  
  for (const series of testSeries) {
    console.log('\n' + '─'.repeat(70));
    console.log(`🎬 ${series.name}`);
    console.log(`   ${series.description} (TMDB: ${series.tmdbId})`);
    console.log('─'.repeat(70));
    
    let videoId: string | null = null;
    let sourceFound: string = 'NONE';
    
    // Try fallback chain
    console.log('\n📍 Searching across sources...');
    
    // 1. FilmStarts
    console.log('   [1/5] FilmStarts.de...');
    videoId = await searchFilmStartsTrailer(series.name);
    if (videoId) {
      sourceFound = 'FilmStarts';
      console.log(`   ✅ Found on FilmStarts`);
    }
    
    // 2. VideoBuster
    if (!videoId) {
      console.log('   [2/5] VideoBuster.de...');
      videoId = await searchVideoBusterTrailer(series.name);
      if (videoId) {
        sourceFound = 'VideoBuster';
        console.log(`   ✅ Found on VideoBuster`);
      }
    }
    
    // 3. IMDB
    if (!videoId) {
      console.log('   [3/5] IMDB...');
      videoId = await searchIMDBTrailer(series.name, series.tmdbId);
      if (videoId) {
        sourceFound = 'IMDB';
        console.log(`   ✅ Found on IMDB`);
      }
    }
    
    // 4. Vimeo
    if (!videoId) {
      console.log('   [4/5] Vimeo...');
      videoId = await searchVimeoTrailer(series.name);
      if (videoId) {
        sourceFound = 'Vimeo';
        console.log(`   ✅ Found on Vimeo`);
      }
    }
    
    // 5. YouTube (last resort)
    if (!videoId) {
      console.log('   [5/5] YouTube...');
      videoId = await searchYouTubeTrailer(series.name);
      if (videoId) {
        sourceFound = 'YouTube';
        console.log(`   ✅ Found on YouTube: ${videoId}`);
      }
    }
    
    if (!videoId) {
      console.log('\n   ❌ No trailer found on any source');
      results.push({
        series: series.name,
        source: 'NONE',
        videoId: null,
        downloadSuccess: false,
        error: 'No video ID found'
      });
      continue;
    }
    
    console.log(`\n📥 Downloading from ${sourceFound}...`);
    
    try {
      const downloadResult = await downloadVideoTrailer(videoId, series.name);
      
      if (downloadResult.success && downloadResult.localPath) {
        console.log(`✅ Downloaded successfully!`);
        console.log(`   Cloud Path: ${downloadResult.localPath}`);
        results.push({
          series: series.name,
          source: sourceFound,
          videoId,
          downloadSuccess: true,
          cloudPath: downloadResult.localPath
        });
      } else {
        console.log(`❌ Download failed: ${downloadResult.error}`);
        results.push({
          series: series.name,
          source: sourceFound,
          videoId,
          downloadSuccess: false,
          error: downloadResult.error
        });
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        series: series.name,
        source: sourceFound,
        videoId,
        downloadSuccess: false,
        error: error.message
      });
    }
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(70));
  
  let successful = 0;
  let failed = 0;
  
  for (const result of results) {
    const status = result.downloadSuccess ? '✅' : '❌';
    console.log(`\n${status} ${result.series}`);
    console.log(`   Source: ${result.source}`);
    console.log(`   Video ID: ${result.videoId || 'N/A'}`);
    console.log(`   Download: ${result.downloadSuccess ? 'SUCCESS' : 'FAILED'}`);
    if (result.cloudPath) {
      console.log(`   Cloud Path: ${result.cloudPath}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.downloadSuccess) successful++;
    else failed++;
  }
  
  const successRate = (successful / results.length * 100).toFixed(1);
  
  console.log('\n' + '─'.repeat(70));
  console.log(`Total: ${results.length} series tested`);
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  📊 Success Rate: ${successRate}%`);
  console.log('─'.repeat(70));
  
  // Return structured results
  return {
    total: results.length,
    successful,
    failed,
    successRate: parseFloat(successRate),
    results
  };
}

testMultipleSeries()
  .then(summary => {
    console.log('\n🏁 Test completed');
    
    if (summary.successRate >= 80) {
      console.log('✅ Success rate meets target (≥80%)');
      process.exit(0);
    } else if (summary.successRate >= 60) {
      console.log('⚠️  Success rate below target but acceptable');
      process.exit(0);
    } else {
      console.log('❌ Success rate too low');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
