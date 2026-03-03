/**
 * Test: A Knight of the Seven Kingdoms Finale
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 A KNIGHT OF THE SEVEN KINGDOMS - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'A Knight of the Seven Kingdoms Finale Recap Ending',
    url: 'https://thecinemaholic.com/a-knight-of-the-seven-kingdoms-finale-recap-ending/',
    text: '',
    useFullTextMode: true,
  };
  
  try {
    const result = await runPipelineV2(source);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ KNIGHT ARTIKEL ERFOLGREICH');
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
