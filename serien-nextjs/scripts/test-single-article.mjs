/**
 * Single Article Test - Quick pipeline validation
 */

import { runContentPipeline } from './pipeline-v1';

async function testSingleArticle() {
  console.log('🧪 Testing single article through complete pipeline...\n');
  
  const testArticle = {
    title: "The Night Agent Season 3: Everything We Know So Far",
    url: "https://tvline.com/test-article-night-agent",
    text: `
The Night Agent has been renewed for Season 3 at Netflix. The spy thriller series, which stars Gabriel Basso as FBI agent Peter Sutherland, will return for a third season following the success of Season 2.

Season 2 premiered on January 23, 2025, and quickly became one of Netflix's most-watched shows. The renewal was announced just weeks after the season 2 debut, confirming the streaming giant's confidence in the series.

Creator Shawn Ryan has indicated that Season 3 will take Peter Sutherland in a new direction, potentially exploring different aspects of the Night Action program. The show has been praised for its intense action sequences and political intrigue.

Production on Season 3 is expected to begin in mid-2025, with a potential release date in early 2026. Gabriel Basso will return as Peter Sutherland, and several key cast members are expected to reprise their roles.

The series is based on the novel by Matthew Quirk and has become a flagship action series for Netflix. The renewal demonstrates Netflix's commitment to high-quality thriller content.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Processing:', testArticle.title);
    console.log('🔗 URL:', testArticle.url);
    console.log('');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ SUCCESS! Article Published!');
      console.log('✅ ================================\n');
      console.log('📊 Article Details:');
      console.log('   ID:', result.article.id);
      console.log('   Slug:', result.article.slug);
      console.log('   Title:', result.article.title);
      console.log('   Status:', result.article.status);
      console.log('   Publish Mode:', result.article.publishMode);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Article was skipped:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ Pipeline failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSingleArticle();
