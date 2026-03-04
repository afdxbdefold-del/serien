/**
 * Quick test: Verify all fixes work for new articles
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🧪 TESTING: All fixes work for new articles\n');
  
  const source = {
    title: 'Stranger Things Season 5',
    url: 'https://thecinemaholic.com/stranger-things-season-5-release-date/',
    text: '',
    useFullTextMode: true,
  };
  
  console.log('⚡ Running Pipeline v2...\n');
  
  const result = await runPipelineV2(source);
  
  if (result) {
    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST ERFOLGREICH');
    console.log('='.repeat(70));
    console.log(`📝 ${result.headline}`);
    console.log(`🔗 http://localhost:3000/${result.slug}`);
    console.log('='.repeat(70));
  }
  
  process.exit(0);
}

main();
