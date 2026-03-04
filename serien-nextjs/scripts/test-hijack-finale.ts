/**
 * Test: Hijack Season 2 Finale
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 HIJACK SEASON 2 FINALE - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: 'Hijack Season 2 Finale Recap & Ending',
    url: 'https://thecinemaholic.com/hijack-season2-finale-recap-ending/',
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
