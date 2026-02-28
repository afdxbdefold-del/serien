/**
 * Test GPT-5.2 Integration
 */

import { runContentPipeline } from './pipeline-v1';

async function testGPT52() {
  console.log('🤖 Testing GPT-5.2 with new article\n');
  
  const testArticle = {
    title: "The Last of Us Season 3: HBO Reveals Production Timeline",
    url: "https://tvline.com/test-tlou-s3",
    text: `
HBO has unveiled the production timeline for The Last of Us Season 3. The highly anticipated third season will begin filming in Vancouver in June 2025, according to network executives.

Pedro Pascal returns as Joel, alongside Bella Ramsey as Ellie. The new season will adapt material from The Last of Us Part II video game, expanding on the complex relationship between the two main characters.

Craig Mazin and Neil Druckmann are back as showrunners and executive producers. The duo has indicated that Season 3 will be darker and more intense than previous seasons, staying true to the source material.

HBO has also confirmed that Season 3 will consist of 10 episodes, two more than Season 2. The increased episode count will allow for deeper character development and more detailed storytelling.

Kaitlyn Dever joins the cast as Abby, a pivotal character from the video game. Additional casting announcements are expected in the coming months.

The series continues to be one of HBO's biggest hits, with Season 2 averaging over 15 million viewers per episode. Season 3 is expected to premiere in late 2026.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Article:', testArticle.title);
    console.log('🤖 Using GPT-5.2 for all generation steps\n');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ GPT-5.2 TEST SUCCESS!');
      console.log('✅ ================================\n');
      console.log('📊 Article Details:');
      console.log('   Title:', result.article.title);
      console.log('   Slug:', result.article.slug);
      console.log('   Status:', result.article.status);
      console.log('   Publish Mode:', result.article.publishMode);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('\n🎉 GPT-5.2 is working perfectly!');
    }
    
  } catch (error) {
    console.error('\n❌ GPT-5.2 Test failed:', error.message);
  }
}

testGPT52();
