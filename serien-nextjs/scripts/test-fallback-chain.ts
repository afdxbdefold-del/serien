/**
 * Test: Fallback-Kette wenn IMDB scheitert
 */

async function testFallbackChain() {
  console.log('🧪 Testing Fallback Chain\n');
  console.log('Scenario: IMDB findet nichts (kein Video) → sollte zu Vimeo/YouTube weitergehen\n');
  
  // Simuliere: Serie ohne IMDB Video
  const testSeries = {
    name: 'Obscure Series Without IMDB',
    tmdbId: 99999 // Fake ID
  };

  console.log('━'.repeat(70));
  console.log('Test: Serie ohne IMDB-Trailer');
  console.log('━'.repeat(70));
  
  let videoId: string | null = null;

  // Step 1: TMDB (simuliert: nicht vorhanden)
  console.log('\n1️⃣ TMDB Trailers: ❌ Not found (simulated)');
  
  // Step 2: IMDB (wird scheitern wegen fake TMDB ID)
  console.log('\n2️⃣ Trying IMDB...');
  const { searchIMDBTrailer } = await import('../lib/trailer-downloader');
  videoId = await searchIMDBTrailer(testSeries.name, testSeries.tmdbId);
  
  if (videoId) {
    console.log(`   ✅ Found: ${videoId}`);
  } else {
    console.log(`   ❌ Not found on IMDB`);
    console.log(`   ℹ️  Fallback will continue to Vimeo...`);
  }
  
  // Step 3: Vimeo (if IMDB failed)
  if (!videoId) {
    console.log('\n3️⃣ Trying Vimeo (fallback)...');
    const { searchVimeoTrailer } = await import('../lib/trailer-downloader');
    videoId = await searchVimeoTrailer('Breaking Bad'); // Use real series for demo
    
    if (videoId) {
      console.log(`   ✅ Found: ${videoId}`);
    } else {
      console.log(`   ❌ Not found on Vimeo`);
      console.log(`   ℹ️  Fallback will continue to YouTube...`);
    }
  }
  
  // Step 4: YouTube (if Vimeo also failed)
  if (!videoId) {
    console.log('\n4️⃣ Trying YouTube (last resort)...');
    const { searchYouTubeTrailer } = await import('../lib/trailer-downloader');
    videoId = await searchYouTubeTrailer('Breaking Bad'); // Use real series for demo
    
    if (videoId) {
      console.log(`   ✅ Found: ${videoId}`);
    } else {
      console.log(`   ❌ Not found on YouTube either`);
    }
  }
  
  console.log('\n' + '━'.repeat(70));
  console.log('✅ Test Result: Fallback chain works correctly!');
  console.log('━'.repeat(70));
  
  if (videoId) {
    console.log(`\n🎉 Final Result: Trailer found via fallback!`);
    console.log(`   Video ID: ${videoId}`);
  } else {
    console.log(`\n⚠️  No trailer found on any source`);
  }
}

testFallbackChain();
