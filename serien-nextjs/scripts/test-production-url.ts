/**
 * Production Test - Real URL
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 PRODUCTION TEST - REAL URL');
  console.log('='.repeat(70));
  
  const source = {
    title: 'Paradise Season 2 Episode 4 Recap',
    url: 'https://thecinemaholic.com/paradise-season-2-episode-4-recap/',
    text: '',
    useFullTextMode: true, // Fetch full article text
  };
  
  try {
    const result = await runPipelineV2(source);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ PRODUCTION TEST ERFOLGREICH');
      console.log('='.repeat(70));
      console.log(`📝 Artikel: ${result.headline}`);
      console.log(`🔗 URL: http://localhost:3000/${result.slug}`);
      console.log(`🆔 ID: ${result.articleId}`);
      console.log('='.repeat(70));
    } else {
      console.log('\n⚠️  Pipeline returned null (content skipped or failed quality gates)');
    }
  } catch (error: any) {
    console.error('\n❌ PRODUCTION TEST FEHLGESCHLAGEN:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

main();
