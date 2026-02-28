/**
 * Test: New article with Q&A generation
 */

import { runContentPipeline } from './pipeline-v1';

async function testNewArticle() {
  console.log('🧪 Creating NEW article with complete pipeline...\n');
  
  const testArticle = {
    title: "Stranger Things Season 5: Cast Reveals Emotional Final Season Details",
    url: "https://tvline.com/test-stranger-things-s5",
    text: `
Stranger Things Season 5 is set to be the most emotional season yet, according to the cast. The final season of the hit Netflix series will bring closure to the story of Eleven, Mike, and the rest of the Hawkins crew.

Millie Bobby Brown, who plays Eleven, revealed in a recent interview that the final season's scripts made her cry. "It's the end of an era," she said. "Reading the finale script was incredibly emotional. The Duffer Brothers have crafted something really special."

Finn Wolfhard, who portrays Mike Wheeler, echoed these sentiments, saying that Season 5 will tie up all the loose ends from previous seasons. The season will be set in 1987, picking up after the events of Season 4's dramatic finale.

Production on Stranger Things Season 5 began in early 2024 and is expected to wrap by late 2025. The season will consist of eight episodes, with some reportedly running longer than feature films.

Netflix has confirmed that Season 5 will be the final chapter in the Stranger Things saga, though the streaming giant has expressed interest in potential spin-offs set in the same universe.

The Duffer Brothers have promised that the final season will deliver answers to long-standing mysteries, including the origins of the Upside Down and Eleven's ultimate destiny. Fans can expect the season to premiere in 2026.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Processing:', testArticle.title);
    console.log('');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ NEW ARTICLE PUBLISHED!');
      console.log('✅ ================================\n');
      console.log('📊 Article Details:');
      console.log('   ID:', result.article.id);
      console.log('   Slug:', result.article.slug);
      console.log('   Title:', result.article.title);
      console.log('   Status:', result.article.status);
      console.log('   Publish Mode:', result.article.publishMode);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
      console.log('🔍 Checking Q&A generation...');
    } else if (result.skipped) {
      console.log('\n⚠️  Article was skipped:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testNewArticle();
