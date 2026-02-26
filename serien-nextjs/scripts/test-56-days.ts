/**
 * TEST: FULL ARTICLE PIPELINE with real URL
 * URL: https://thecinemaholic.com/56-days-ending-explained/
 */

import { runContentPipeline } from './pipeline-v1';

async function main() {
  console.log('🧪 Testing FULL ARTICLE Pipeline with real article...\n');

  const source = {
    title: "56 Days Ending Explained: Netflix Thriller",
    url: "https://thecinemaholic.com/56-days-ending-explained/",
    text: `The Netflix thriller series explores a complex narrative. Initial synopsis placeholder.`,
    useFullTextMode: true  // CRITICAL: Activates FULL_ARTICLE mode with Playwright fetch
  };

  try {
    const result = await runContentPipeline(source);

    console.log('\n' + '='.repeat(80));
    console.log('📊 PIPELINE RESULT');
    console.log('='.repeat(80));

    if ('skipped' in result && result.skipped) {
      console.log('❌ Pipeline skipped');
      console.log(`   Reason: ${result.reason}`);
      
      if ('draft' in result && result.draft) {
        console.log(`\n📝 Draft saved:`);
        console.log(`   ID: ${result.draft.id}`);
        console.log(`   Title: ${result.draft.title}`);
        console.log(`   Word count: ${result.draft.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).length}`);
      }
    } else if ('success' in result && result.success) {
      console.log('✅ PIPELINE SUCCESS!\n');
      
      const article = result.article;
      const wordCount = article.contentHtml.replace(/<[^>]*>/g, '').split(/\s+/).length;
      const paragraphCount = (article.contentHtml.match(/<p>/g) || []).length;
      const hasQuelle = article.contentHtml.includes('Quelle:');
      
      console.log('📄 Article Details:');
      console.log(`   ID: ${article.id}`);
      console.log(`   Slug: ${article.slug}`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Publish Mode: ${article.publishMode}`);
      console.log('');
      
      console.log('📏 Content Metrics:');
      console.log(`   Word Count: ${wordCount} words`);
      console.log(`   Target: 450-900 words`);
      console.log(`   Status: ${
        wordCount >= 450 && wordCount <= 900 ? '✅ Within target' :
        wordCount >= 350 ? '⚠️  Acceptable but below target' :
        '❌ Too short'
      }`);
      console.log('');
      
      console.log('📄 Structure:');
      console.log(`   Paragraphs: ${paragraphCount}`);
      console.log(`   Min required: 5`);
      console.log(`   Status: ${paragraphCount >= 5 ? '✅ Pass' : '❌ Too few'}`);
      console.log('');
      
      console.log('🔗 Quelle Block:');
      console.log(`   Status: ${hasQuelle ? '✅ Present' : '❌ Missing'}`);
      
      if (hasQuelle) {
        const quelleMatch = article.contentHtml.match(/<p class="article-source">.*?<\/p>/);
        if (quelleMatch) {
          console.log(`   Content: ${quelleMatch[0].replace(/<[^>]*>/g, ' ').trim()}`);
        }
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('🎉 FULL ARTICLE MODE TEST COMPLETE');
      console.log('='.repeat(80));
    }

  } catch (error: any) {
    console.error('\n❌ TEST FAILED');
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
