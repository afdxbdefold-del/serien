/**
 * Test: The Pitt Article
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 THE PITT - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'The Pitt Season 2 Episode 8 Recap',
    url: 'https://thecinemaholic.com/the-pitt-season-2-episode-8-recap/',
    text: '',
    useFullTextMode: true,
  };
  
  try {
    const result = await runPipelineV2(source);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ THE PITT ARTIKEL ERFOLGREICH GENERIERT');
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
    console.error(error.stack);
  }
  
  process.exit(0);
}

main();
