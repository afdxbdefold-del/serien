/**
 * Comprehensive Test: Trailer Source Priority Testing
 * Tests the IMDB → Vimeo → TMDB → YouTube fallback with results tracking
 */

import { 
  searchIMDBTrailer, 
  searchVimeoTrailer, 
  searchYouTubeTrailer,
  downloadVideoTrailer 
} from '../lib/trailer-downloader';

interface TestResult {
  series: string;
  tmdbId: number;
  imdb: { success: boolean; videoId?: string; error?: string };
  vimeo: { success: boolean; videoId?: string; error?: string };
  youtube: { success: boolean; videoId?: string; error?: string };
  download?: { success: boolean; path?: string; error?: string };
  finalSource?: string;
  finalVideoId?: string;
}

// Test cases
const testSeries = [
  { name: 'Stranger Things', tmdbId: 66732 },
  { name: 'The Last of Us', tmdbId: 100088 },
  { name: 'Wednesday', tmdbId: 119051 },
];

async function runTests(): Promise<{ results: TestResult[], summary: any }> {
  console.log('🧪 TRAILER SOURCE PRIORITY TEST');
  console.log('='.repeat(70));
  console.log('Testing: IMDB → Vimeo → TMDB → YouTube fallback\n');
  console.log('Environment check:');
  console.log(`  TMDB_API_KEY: ${process.env.TMDB_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  EMERGENT_LLM_KEY: ${process.env.EMERGENT_LLM_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  const results: TestResult[] = [];
  const summary = {
    total: testSeries.length,
    imdbSuccess: 0,
    vimeoSuccess: 0,
    youtubeSuccess: 0,
    totalFound: 0,
    downloadSuccess: 0,
    downloadAttempted: 0,
  };

  for (const series of testSeries) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📺 ${series.name} (TMDB: ${series.tmdbId})`);
    console.log('─'.repeat(70));

    const result: TestResult = {
      series: series.name,
      tmdbId: series.tmdbId,
      imdb: { success: false },
      vimeo: { success: false },
      youtube: { success: false },
    };

    // Test IMDB
    console.log('\n[1/4] IMDB Search...');
    try {
      const imdbId = await searchIMDBTrailer(series.name, series.tmdbId);
      if (imdbId) {
        result.imdb = { success: true, videoId: imdbId };
        summary.imdbSuccess++;
        console.log(`  ✅ Found: ${imdbId}`);
      } else {
        result.imdb = { success: false, error: 'No video found' };
        console.log('  ⏭️ Not found');
      }
    } catch (error: any) {
      result.imdb = { success: false, error: error.message };
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Test Vimeo
    console.log('\n[2/4] Vimeo Search...');
    try {
      const vimeoId = await searchVimeoTrailer(series.name);
      if (vimeoId) {
        result.vimeo = { success: true, videoId: vimeoId };
        summary.vimeoSuccess++;
        console.log(`  ✅ Found: ${vimeoId}`);
      } else {
        result.vimeo = { success: false, error: 'No video found' };
        console.log('  ⏭️ Not found');
      }
    } catch (error: any) {
      result.vimeo = { success: false, error: error.message };
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Test YouTube  
    console.log('\n[4/4] YouTube Search...');
    try {
      const ytId = await searchYouTubeTrailer(series.name);
      if (ytId) {
        result.youtube = { success: true, videoId: ytId };
        summary.youtubeSuccess++;
        console.log(`  ✅ Found: ${ytId}`);
      } else {
        result.youtube = { success: false, error: 'No video found' };
        console.log('  ❌ Not found');
      }
    } catch (error: any) {
      result.youtube = { success: false, error: error.message };
      console.log(`  ❌ Error: ${error.message}`);
    }

    // Determine final source (priority: IMDB > Vimeo > YouTube)
    if (result.imdb.success && result.imdb.videoId) {
      result.finalSource = 'IMDB';
      result.finalVideoId = result.imdb.videoId;
      summary.totalFound++;
    } else if (result.vimeo.success && result.vimeo.videoId) {
      result.finalSource = 'Vimeo';
      result.finalVideoId = result.vimeo.videoId;
      summary.totalFound++;
    } else if (result.youtube.success && result.youtube.videoId) {
      result.finalSource = 'YouTube';
      result.finalVideoId = result.youtube.videoId;
      summary.totalFound++;
    }

    // Test download (only for YouTube as IMDB/Vimeo don't work)
    if (result.finalSource === 'YouTube' && result.finalVideoId) {
      console.log(`\n[Download Test] YouTube: ${result.finalVideoId}`);
      summary.downloadAttempted++;
      try {
        const downloadResult = await downloadVideoTrailer(result.finalVideoId, series.name);
        if (downloadResult.success) {
          result.download = { success: true, path: downloadResult.localPath };
          summary.downloadSuccess++;
          console.log(`  ✅ Downloaded: ${downloadResult.localPath}`);
        } else {
          result.download = { success: false, error: downloadResult.error };
          console.log(`  ❌ Failed: ${downloadResult.error}`);
        }
      } catch (error: any) {
        result.download = { success: false, error: error.message };
        console.log(`  ❌ Exception: ${error.message}`);
      }
    }

    console.log(`\n📊 Result: ${result.finalSource || 'NO SOURCE'} ${result.finalVideoId || ''}`);
    results.push(result);
  }

  // Print Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total Series Tested: ${summary.total}`);
  console.log(`─`.repeat(40));
  console.log(`IMDB Success:    ${summary.imdbSuccess}/${summary.total} (${Math.round(summary.imdbSuccess/summary.total*100)}%)`);
  console.log(`Vimeo Success:   ${summary.vimeoSuccess}/${summary.total} (${Math.round(summary.vimeoSuccess/summary.total*100)}%)`);
  console.log(`YouTube Success: ${summary.youtubeSuccess}/${summary.total} (${Math.round(summary.youtubeSuccess/summary.total*100)}%)`);
  console.log(`─`.repeat(40));
  console.log(`Total Found:     ${summary.totalFound}/${summary.total}`);
  console.log(`Downloads:       ${summary.downloadSuccess}/${summary.downloadAttempted} attempted`);
  console.log('='.repeat(70));

  // Pass/Fail determination
  const passed = summary.totalFound >= Math.floor(summary.total * 0.5); // 50% threshold
  console.log(`\nTEST ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`  (Threshold: 50% series must have at least one source)`);

  return { results, summary };
}

// Run tests
runTests()
  .then(({ results, summary }) => {
    // Output JSON for test report
    console.log('\n📋 JSON Results:');
    console.log(JSON.stringify({ results, summary }, null, 2));
  })
  .catch(console.error);
