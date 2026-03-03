/**
 * Test Script: Generate article for Wednesday to test trailer functionality
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🎬 Testing Trailer System with Wednesday');
  console.log('='.repeat(70));
  
  const uniqueId = Math.random().toString(36).substring(7);
  const testSource = {
    title: `Wednesday Staffel 3 Bestätigung ${uniqueId}`,
    url: 'https://example.com/wednesday-staffel-3',
    text: `Netflix hat die Hit-Serie "Wednesday" für eine dritte Staffel verlängert. Die Ankündigung erfolgt nach dem großen Erfolg der zweiten Staffel. Jenna Ortega kehrt in ihrer Rolle als Wednesday Addams zurück. Die Dreharbeiten für Staffel 3 sollen noch in diesem Jahr beginnen. Tim Burton bleibt als Executive Producer an Bord.`,
    useFullTextMode: false, // Use provided text directly
  };
  
  try {
    const result = await runPipelineV2(testSource);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ TEST ERFOLGREICH');
      console.log('='.repeat(70));
      console.log(`Artikel URL: http://localhost:3000/${result.slug}`);
      console.log(`Artikel ID: ${result.articleId}`);
      console.log('='.repeat(70));
    } else {
      console.log('\n❌ Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ TEST FEHLGESCHLAGEN:', error.message);
    console.error(error.stack);
  }
  
  process.exit(0);
}

main();
