/**
 * Q&A Test - Simple article
 */

import { runContentPipeline } from './pipeline-v1';

async function testQA() {
  console.log('🧪 Testing Q&A with new article\n');
  
  const testArticle = {
    title: "Breaking Bad Spin-off: Better Call Saul Gets New Season Announcement",
    url: "https://tvline.com/test-bcs-news",
    text: `
Breaking Bad fans have reason to celebrate as Better Call Saul is getting a surprise new chapter. AMC announced today that the critically acclaimed prequel series will return for a special limited series.

Bob Odenkirk will reprise his role as Jimmy McGill, also known as Saul Goodman. The new limited series will explore previously untold stories from Saul's life after the events of Breaking Bad.

Vince Gilligan and Peter Gould are returning as showrunners and executive producers. The production is scheduled to begin filming in Albuquerque, New Mexico, in summer 2025.

Rhea Seehorn is also confirmed to return as Kim Wexler, addressing one of the biggest questions left after the series finale. The new season will consist of six episodes.

AMC plans to premiere the limited series in 2026, marking over a decade since Breaking Bad concluded. The network describes it as "the final chapter in the Breaking Bad universe."
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Processing:', testArticle.title);
    console.log('');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ ARTICLE PUBLISHED!');
      console.log('✅ ================================\n');
      console.log('   Title:', result.article.title);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
      console.log('⏳ Q&A should be generated in STEP 10...');
    }
    
  } catch (error) {
    console.error('\n❌ Failed:', error.message);
  }
}

testQA();
