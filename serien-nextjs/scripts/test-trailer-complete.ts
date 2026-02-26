/**
 * Test Trailer Download Feature - Direct Test
 */
import { downloadYouTubeTrailer, searchYouTubeTrailer } from '../lib/trailer-downloader';

async function testTrailerFeature() {
  console.log('🎬 Testing Trailer Download Feature\n');
  
  try {
    // Test 1: YouTube Search + Download
    console.log('━'.repeat(60));
    console.log('TEST: YouTube Search + Download + Cloud Upload');
    console.log('━'.repeat(60));
    
    const testSeries = 'The Rookie';
    console.log(`🔍 Step 1: Searching YouTube for "${testSeries} official trailer"`);
    
    const youtubeId = await searchYouTubeTrailer(testSeries);
    
    if (youtubeId) {
      console.log(`✅ Found YouTube ID: ${youtubeId}`);
      console.log(`   URL: https://youtube.com/watch?v=${youtubeId}`);
      console.log('');
      console.log(`🎬 Step 2: Downloading + Uploading to Emergent Object Storage...`);
      
      const result = await downloadYouTubeTrailer(youtubeId, testSeries);
      
      console.log('');
      console.log('━'.repeat(60));
      if (result.success) {
        console.log('✅ COMPLETE SUCCESS!');
        console.log('━'.repeat(60));
        console.log(`   Cloud Storage URL: ${result.localPath}`);
        console.log(`   This URL can be used in the database`);
        console.log(`   Frontend will access via: /trailer/${result.localPath}`);
      } else {
        console.log('❌ FAILED');
        console.log('━'.repeat(60));
        console.log(`   Error: ${result.error}`);
        console.log(`   This video may be blocked by YouTube`);
      }
    } else {
      console.log('❌ YouTube search returned no results');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test crashed:', error.message);
    console.error(error.stack);
  }
}

testTrailerFeature();
