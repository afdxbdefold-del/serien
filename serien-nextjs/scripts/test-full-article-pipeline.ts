/**
 * TEST SCRIPT: FULL ARTICLE PIPELINE
 * 
 * Tests the new FULL_ARTICLE mode that:
 * - Fetches complete source text using Playwright
 * - Generates 450-900 word articles
 * - Adds "Quelle" block at the end
 * - Validates word count and structure
 */

import { runContentPipeline } from './pipeline-v1';

async function testFullArticlePipeline() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 TESTING: FULL ARTICLE PIPELINE');
  console.log('='.repeat(80) + '\n');

  // Test article - should generate a comprehensive 450-900 word article
  const testSource = {
    title: "The Last of Us Staffel 3: HBO bestätigt neue Season der Videospiel-Adaption",
    url: "https://example.com/test-full-article-" + Date.now(),
    text: `HBO hat heute offiziell die dritte Staffel von "The Last of Us" bestätigt. Die erfolgreiche Serie, die auf dem gleichnamigen Videospiel von Naughty Dog basiert, gehört zu den erfolgreichsten HBO-Produktionen der letzten Jahre.

Die erste Staffel startete im Januar 2024 und erreichte durchschnittlich 32 Millionen Zuschauer pro Episode. Staffel 2 ist derzeit in Produktion und soll im Frühjahr 2026 starten.

Pedro Pascal und Bella Ramsey kehren in ihren Hauptrollen als Joel und Ellie zurück. Craig Mazin und Neil Druckmann bleiben als Showrunner an Bord.

Die dritte Staffel wird Elemente aus dem zweiten Teil des Videospiels adaptieren. Die Dreharbeiten sollen im Herbst 2026 beginnen.

HBO Max plant, die Serie auf mindestens vier Staffeln auszudehnen, um die komplette Geschichte des Spiels zu erzählen. Die Produktionskosten pro Staffel liegen bei geschätzten 100 Millionen Dollar.

Fans des Spiels loben die Serie für ihre werkgetreue Adaption und die schauspielerischen Leistungen. Die Serie gewann bereits mehrere Emmy Awards und Golden Globes.

Weitere Details zur dritten Staffel, einschließlich neuer Cast-Mitglieder und des genauen Startdatums, sollen in den kommenden Monaten bekannt gegeben werden.`,
    useFullTextMode: true // CRITICAL: This enables FULL_ARTICLE mode
  };

  try {
    console.log('📝 Processing with FULL_ARTICLE mode enabled...\n');
    
    const result = await runContentPipeline(testSource);

    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80));

    if ('skipped' in result && result.skipped) {
      console.log('❌ Pipeline skipped');
      console.log(`   Reason: ${result.reason}`);
      
      if ('draft' in result && result.draft) {
        console.log(`   Draft ID: ${result.draft.id}`);
      }
    } else if ('success' in result && result.success) {
      console.log('✅ Pipeline SUCCESS!\n');
      console.log(`Article Details:`);
      console.log(`   ID: ${result.article.id}`);
      console.log(`   Slug: ${result.article.slug}`);
      console.log(`   Title: ${result.article.title}`);
      console.log(`   Publish Mode: ${result.article.publishMode}`);
      console.log(`   Content Length: ${result.article.contentHtml.length} chars`);
      
      // Validate word count
      const wordCount = result.article.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).length;
      console.log(`\n📏 Word Count Validation:`);
      console.log(`   Count: ${wordCount} words`);
      
      if (wordCount >= 450 && wordCount <= 900) {
        console.log(`   ✅ Within target range (450-900)`);
      } else if (wordCount >= 350) {
        console.log(`   ⚠️  Below target but acceptable (${wordCount} words)`);
      } else {
        console.log(`   ❌ Below minimum threshold (${wordCount} words)`);
      }
      
      // Check for "Quelle" block
      const hasQuelleBlock = result.article.contentHtml.includes('Quelle:');
      console.log(`\n🔗 Quelle Block:`);
      console.log(`   ${hasQuelleBlock ? '✅ Present' : '❌ Missing'}`);
      
      // Paragraph count
      const paragraphCount = (result.article.contentHtml.match(/<p>/g) || []).length;
      console.log(`\n📄 Structure:`);
      console.log(`   Paragraphs: ${paragraphCount}`);
      console.log(`   ${paragraphCount >= 5 ? '✅' : '❌'} Min 5 paragraphs requirement`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    console.error(error.stack);
  }
}

// Run test
testFullArticlePipeline()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
