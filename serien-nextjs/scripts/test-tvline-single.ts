/**
 * Test: Process ONE TVLine article through the full pipeline
 */

import { PrismaClient } from '@prisma/client';
import { scrapeTVLineStreaming } from '../lib/tvline-scraper.js';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

async function testSingleArticle() {
  console.log('🧪 Testing TVLine Pipeline (Single Article)\n');
  console.log('━'.repeat(70));
  
  try {
    // Get fresh articles
    const articles = await scrapeTVLineStreaming();
    
    if (articles.length === 0) {
      console.log('❌ No articles found');
      return;
    }
    
    // Take the first article that hasn't been processed
    let testArticle = null;
    
    for (const article of articles) {
      const urlParts = article.url.split('/');
      const possibleSlug = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      const existing = await prisma.article.findFirst({
        where: {
          OR: [
            { slug: { contains: possibleSlug } },
            { title: { contains: article.title.substring(0, 50) } },
          ],
        },
        select: { id: true, slug: true },
      });
      
      if (!existing) {
        testArticle = article;
        break;
      }
    }
    
    if (!testArticle) {
      console.log('⚠️  All articles already processed. Using first article for re-test...');
      testArticle = articles[0];
    }
    
    console.log('\n📰 Test Article:');
    console.log(`   Title: ${testArticle.title}`);
    console.log(`   URL: ${testArticle.url}`);
    console.log('\n' + '━'.repeat(70));
    console.log('🔄 Running through pipeline...\n');
    
    const result = await runContentPipeline({
      url: testArticle.url,
      title: testArticle.title,
      text: '',
      useFullTextMode: false,
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 Test Result:', result);
    console.log('='.repeat(70));
    
    if (result === 'SUCCESS') {
      console.log('✅ Pipeline test successful!');
      console.log('\nNext steps:');
      console.log('1. Check the article on the website');
      console.log('2. If all looks good, activate the full auto-pipeline');
    } else {
      console.log(`⚠️  Result: ${result}`);
      console.log('Check logs above for details');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testSingleArticle();
