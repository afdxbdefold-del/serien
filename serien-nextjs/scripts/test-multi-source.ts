/**
 * Test Multi-Source Trailer Download (YouTube + Vimeo Fallback)
 */
import { searchYouTubeTrailer, searchVimeoTrailer, downloadVideoTrailer } from '../lib/trailer-downloader';

async function testMultiSourceTrailer() {
  console.log('🎬 Testing Multi-Source Trailer Download\n');
  
  const testSeries = [
    { name: 'The Rookie', desc: 'Popular series (likely on both)' },
    { name: 'Breaking Bad', desc: 'Very popular (definitely on YouTube)' },
    { name: 'Arcane', desc: 'Netflix series (may need Vimeo)' }
  ];

  for (const series of testSeries) {
    console.log('\n' + '━'.repeat(70));
    console.log(`Testing: ${series.name}`);
    console.log(`Context: ${series.desc}`);
    console.log('━'.repeat(70));
    
    let videoId: string | null = null;
    let source = '';

    try {
      // Step 1: Try YouTube
      console.log('\n📍 Step 1: Searching YouTube...');
      videoId = await searchYouTubeTrailer(series.name);
      
      if (videoId) {
        console.log(`✅ Found on YouTube: ${videoId}`);
        source = 'YouTube';
      } else {
        console.log('❌ Not found on YouTube');
        
        // Step 2: Fallback to Vimeo
        console.log('\n📍 Step 2: Searching Vimeo (fallback)...');
        videoId = await searchVimeoTrailer(series.name);
        
        if (videoId) {
          console.log(`✅ Found on Vimeo: ${videoId}`);
          source = 'Vimeo';
        } else {
          console.log('❌ Not found on Vimeo either');
        }
      }

      // Step 3: Download if found
      if (videoId) {
        console.log(`\n📍 Step 3: Downloading from ${source}...`);
        console.log(`⏱️  This may take 1-2 minutes...`);
        
        const result = await downloadVideoTrailer(videoId, series.name);
        
        if (result.success) {
          console.log(`\n✅ SUCCESS! Trailer downloaded from ${source}`);
          console.log(`   Cloud URL: ${result.localPath}`);
        } else {
          console.log(`\n❌ FAILED: ${result.error}`);
        }
      } else {
        console.log(`\n⏭️  SKIPPED: No trailer found on any source`);
      }

    } catch (error: any) {
      console.error(`\n❌ ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '━'.repeat(70));
  console.log('🏁 Multi-Source Test Complete');
  console.log('━'.repeat(70));
}

testMultiSourceTrailer();
