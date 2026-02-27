/**
 * Test: Process second TVLine article (Matlock)
 */

import { PrismaClient } from '@prisma/client';
import { scrapeTVLineStreaming } from '../lib/tvline-scraper.js';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

async function testSecondArticle() {
  console.log('🧪 Testing TVLine Pipeline - Article #2\n');
  
  try {
    const articles = await scrapeTVLineStreaming();
    
    if (articles.length < 2) {
      console.log('❌ Not enough articles');
      return;
    }
    
    // Take the second article (Matlock)
    const testArticle = articles[1];
    
    console.log('📰 Test Article #2:');
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
    console.log('📊 Result:', result);
    console.log('='.repeat(70));
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSecondArticle();
