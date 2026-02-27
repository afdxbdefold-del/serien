/**
 * TVLine Auto-Pipeline
 * Automatically processes fresh articles from TVLine
 */

import { PrismaClient } from '@prisma/client';
import { scrapeTVLineStreaming, getNextTVLineArticle } from '../lib/tvline-scraper.js';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

async function processTVLineArticles() {
  console.log('🚀 TVLine Auto-Pipeline Starting...\n');
  console.log('━'.repeat(70));
  
  try {
    // Get fresh articles
    const articles = await scrapeTVLineStreaming();
    
    if (articles.length === 0) {
      console.log('⚠️  No articles found. Exiting.');
      return;
    }
    
    console.log(`\n📊 Found ${articles.length} fresh articles`);
    console.log('━'.repeat(70));
    
    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    
    // Process each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      
      console.log(`\n[${i + 1}/${articles.length}] ${article.title}`);
      console.log(`URL: ${article.url}`);
      
      // Check if already processed
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
      
      if (existing) {
        console.log(`⏭️  Already processed (${existing.slug})`);
        skippedCount++;
        continue;
      }
      
      // Process through pipeline
      try {
        console.log('🔄 Running through pipeline...');
        
        const result = await runContentPipeline({
          url: article.url,
          title: article.title,
          text: '', // Will be fetched by pipeline
          useFullTextMode: false,
        });
        
        if (result === 'SUCCESS') {
          console.log('✅ Article published successfully!');
          processedCount++;
        } else if (result === 'SKIPPED') {
          console.log(`⏭️  Skipped: ${result}`);
          skippedCount++;
        } else {
          console.log(`⚠️  Result: ${result}`);
          failedCount++;
        }
        
        // Small delay between articles
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`❌ Pipeline failed: ${error.message}`);
        failedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 TVLine Auto-Pipeline Complete!');
    console.log('='.repeat(70));
    console.log(`✅ Processed: ${processedCount}`);
    console.log(`⏭️  Skipped: ${skippedCount}`);
    console.log(`❌ Failed: ${failedCount}`);
    console.log(`📦 Total: ${articles.length}`);
    
  } catch (error) {
    console.error('❌ Auto-pipeline failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run
processTVLineArticles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
