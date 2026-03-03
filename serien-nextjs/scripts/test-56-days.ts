/**
 * Test: 56 Days Season 2
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 56 DAYS SEASON 2 - PIPELINE V2 TEST');
  console.log('='.repeat(70));
  
  const source = {
    title: '56 Days Season 2',
    url: 'https://thecinemaholic.com/56-days-season-2/',
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
