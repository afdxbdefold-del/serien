/**
 * Test: Fact Safety Layer
 * 
 * Test mit einem Artikel, der unbestätigte "Serienende" Claims enthält
 */

import { runContentPipeline } from './pipeline-v1';

async function main() {
  console.log('\n🛡️  FACT SAFETY LAYER TEST');
  console.log('='.repeat(70));

  // Test Article with UNVERIFIED "series end" claim
  const testArticle = {
    title: "Breaking Bad Spin-off: Better Call Saul endet 2027 mit Staffel 7",
    url: "https://example.com/bcs-fake-end-" + Date.now(),
    text: `
      AMC hat angekündigt, dass Better Call Saul 2027 mit der siebten Staffel enden wird. Die Serie wird nach insgesamt sieben Seasons abgeschlossen.
      
      Bob Odenkirk kehrt als Jimmy McGill zurück. Rhea Seehorn spielt erneut Kim Wexler. Die finale Staffel wird die Geschichte zum Abschluss bringen. Vince Gilligan ist weiterhin als Executive Producer tätig.
      
      Die siebte Staffel wird zehn Episoden umfassen. Die Dreharbeiten beginnen Ende 2026. AMC plant eine wöchentliche Veröffentlichung. Die Serie endet definitiv 2027.
      
      Better Call Saul ist ein Spin-off von Breaking Bad. Die Show lief seit 2015 auf AMC. Die Serie gewann mehrere Emmy Awards.
    `
  };

  console.log('Testing article with UNVERIFIED claims:');
  console.log('- "endet 2027 mit Staffel 7"');
  console.log('- "finale Staffel"');
  console.log('- "insgesamt sieben Seasons"');
  console.log('');

  try {
    const result = await runContentPipeline(testArticle);
    
    if ('skipped' in result && result.skipped) {
      console.log(`\n⚠️  Pipeline Result: SKIPPED`);
      console.log(`   Reason: ${result.reason}`);
      
      if (result.reason.includes('fact_safety')) {
        console.log('\n✅ FACT SAFETY LAYER WORKING!');
        console.log('   Article was correctly rejected due to unverified facts.');
      }
    } else if ('success' in result && result.success) {
      console.log(`\n❌ FACT SAFETY LAYER FAILED!`);
      console.log(`   Article was published despite unverified facts.`);
      console.log(`   Article ID: ${result.article.id}`);
    }
  } catch (error: any) {
    console.error('\n❌ Test ERROR:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
