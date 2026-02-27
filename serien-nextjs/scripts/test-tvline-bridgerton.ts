/**
 * Test: Bridgerton article (3rd in list)
 */

import { PrismaClient } from '@prisma/client';
import { scrapeTVLineStreaming } from '../lib/tvline-scraper.js';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

async function testBridgertonArticle() {
  console.log('🧪 Testing TVLine Pipeline - Bridgerton Article\n');
  
  try {
    const articles = await scrapeTVLineStreaming();
    
    if (articles.length < 3) {
      console.log('❌ Not enough articles');
      return;
    }
    
    // Find a Bridgerton article
    const testArticle = articles.find(a => a.title.toLowerCase().includes('bridgerton')) || articles[2];
    
    console.log('📰 Test Article:');
    console.log(`   ${testArticle.title}`);
    console.log(`   ${testArticle.url}\n`);
    console.log('━'.repeat(70));
    
    const result = await runContentPipeline({
      url: testArticle.url,
      title: testArticle.title,
      text: '',
      useFullTextMode: false,
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 Final Result:', result);
    console.log('='.repeat(70));
    
    if (result === 'SUCCESS') {
      console.log('\n✅✅✅ PIPELINE TEST SUCCESSFUL! ✅✅✅');
      console.log('TVLine scraper and pipeline are working correctly.');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testBridgertonArticle();
