/**
 * Test: Third article - Wednesday Season 2
 */

import { runContentPipeline } from './pipeline-v1';

async function testThirdArticle() {
  console.log('🧪 Creating third article: Wednesday Season 2\n');
  
  const testArticle = {
    title: "Wednesday Season 2: Jenna Ortega Teases Major Plot Twist",
    url: "https://tvline.com/test-wednesday-s2",
    text: `
Wednesday Season 2 is bringing a shocking twist to the Addams Family universe, according to star Jenna Ortega. The actress recently dropped hints about what fans can expect when the hit Netflix series returns.

Speaking at a recent press event, Ortega revealed that Season 2 will explore Wednesday's character in unexpected ways. "We're diving deeper into Wednesday's past and her connection to Nevermore Academy," she said. "There's a mystery that's been brewing since Season 1 that will finally come to light."

Tim Burton, who directed multiple episodes of Season 1, is returning to helm more episodes in the upcoming season. The show's writers are reportedly crafting storylines that will expand the supernatural elements of the series.

Catherine Zeta-Jones and Luis Guzmán are confirmed to return as Morticia and Gomez Addams. The family dynamic will play a larger role in Season 2, with more scenes set at the iconic Addams Family mansion.

Production on Wednesday Season 2 began in Ireland in early 2024. Netflix has confirmed the season will consist of eight episodes, matching the first season's format. Emma Myers will return as Enid, Wednesday's colorful roommate and unlikely best friend.

The series became Netflix's third most-watched English-language series ever, with 1.7 billion hours viewed in its first 28 days. Season 2 is expected to premiere in late 2025 or early 2026.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Processing:', testArticle.title);
    console.log('');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ THIRD ARTICLE PUBLISHED!');
      console.log('✅ ================================\n');
      console.log('📊 Details:');
      console.log('   Title:', result.article.title);
      console.log('   Slug:', result.article.slug);
      console.log('   Status:', result.article.status);
      console.log('   Publish Mode:', result.article.publishMode);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Skipped:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

testThirdArticle();
