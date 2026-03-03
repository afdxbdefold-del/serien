/**
 * Test: The Last Thing He Told Me S2 EP1
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 THE LAST THING HE TOLD ME - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'The Last Thing He Told Me S2 EP1 Recap',
    url: 'https://thecinemaholic.com/the-last-thing-he-told-me-s2-ep1-recap/',
    text: '',
    useFullTextMode: true,
  };
  
  try {
    const result = await runPipelineV2(source);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ ARTIKEL ERFOLGREICH GENERIERT');
      console.log('='.repeat(70));
      console.log(`📝 Artikel: ${result.headline}`);
      console.log(`🔗 URL: http://localhost:3000/${result.slug}`);
      console.log(`🆔 ID: ${result.articleId}`);
      console.log('='.repeat(70));
    } else {
      console.log('\n⚠️  Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ TEST FEHLGESCHLAGEN:', error.message);
  }
  
  process.exit(0);
}

main();
