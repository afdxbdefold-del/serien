/**
 * Direct Q&A Test
 */

import { generateArticleQA } from '../lib/qa-generator.ts';

async function testQA() {
  console.log('🧪 Testing Q&A Generation...\n');
  
  const testInput = {
    title: 'House of the Dragon Staffel 3: George R.R. Martin enthüllt wichtige Handlungdetails',
    seriesName: 'House of the Dragon',
    contentHtml: `
      <p>Die HBO-Serie House of the Dragon ist offiziell in die Produktion ihrer 3. Staffel gestartet.</p>
      <p>Die Dreharbeiten laufen bereits in Großbritannien, und HBO hat bestätigt, dass die neuen Folgen 2026 erscheinen sollen.</p>
      <p>George R.R. Martin hat angekündigt, dass Staffel 3 einige der dramatischsten Momente aus seinem Buch Fire & Blood adaptieren wird.</p>
    `
  };
  
  try {
    console.log('📝 Testing with article:', testInput.title);
    console.log('🔑 API Key present:', !!process.env.EMERGENT_LLM_KEY);
    console.log('');
    
    const questions = await generateArticleQA(testInput);
    
    if (questions && questions.length > 0) {
      console.log('\n✅ SUCCESS! Q&A Generated:');
      questions.forEach((q, i) => {
        console.log(`\n${i + 1}. ${q.question}`);
        console.log(`   ${q.answer}`);
      });
    } else {
      console.log('\n⚠️  No Q&A generated (check logs above)');
    }
    
  } catch (error) {
    console.error('\n❌ Q&A Generation Failed:');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  }
}

testQA().catch(console.error);
