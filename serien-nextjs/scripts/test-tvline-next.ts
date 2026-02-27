/**
 * Process next unprocessed TVLine article
 */

import { PrismaClient } from '@prisma/client';
import { scrapeTVLineStreaming } from '../lib/tvline-scraper.js';
import { runContentPipeline } from './pipeline-v1.js';

const prisma = new PrismaClient();

async function processNextArticle() {
  console.log('🧪 Processing Next TVLine Article\n');
  console.log('━'.repeat(70));
  
  try {
    const articles = await scrapeTVLineStreaming();
    
    if (articles.length === 0) {
      console.log('❌ No articles found');
      return;
    }
    
    console.log(`\n📊 Found ${articles.length} articles. Checking for unprocessed...\n`);
    
    // Find first unprocessed article
    let targetArticle = null;
    
    for (const article of articles) {
      const urlParts = article.url.split('/');
      const possibleSlug = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1];
      
      const existing = await prisma.article.findFirst({
        where: {
          OR: [
            { slug: { contains: possibleSlug } },
            { title: { contains: article.title.substring(0, 40) } },
            { sourceUrl: article.url }, // Check sourceUrl too
          ],
        },
        select: { id: true, slug: true },
      });
      
      if (!existing) {
        targetArticle = article;
        break;
      } else {
        console.log(`⏭️  Already exists: ${article.title.substring(0, 60)}...`);
      }
    }
    
    if (!targetArticle) {
      console.log('\n⚠️  All articles already processed!');
      return;
    }
    
    console.log('\n' + '━'.repeat(70));
    console.log('📰 Selected Article:');
    console.log(`   ${targetArticle.title}`);
    console.log(`   ${targetArticle.url}`);
    console.log('━'.repeat(70));
    console.log('\n🔄 Running through pipeline...\n');
    
    const result = await runContentPipeline({
      url: targetArticle.url,
      title: targetArticle.title,
      text: '',
      useFullTextMode: false,
    });
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESULT:', result);
    console.log('='.repeat(70));
    
    if (result === 'SUCCESS') {
      console.log('\n✅✅✅ ARTICLE PUBLISHED SUCCESSFULLY! ✅✅✅');
      
      // Fetch the published article
      const published = await prisma.article.findFirst({
        where: { sourceUrl: targetArticle.url },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          status: true,
          primarySeries: { select: { name: true } },
        },
      });
      
      if (published) {
        console.log('\n📋 Published Article Details:');
        console.log('   ID:', published.id);
        console.log('   Slug:', published.slug);
        console.log('   Series:', published.primarySeries?.name);
        console.log('   Status:', published.status);
        console.log('   Excerpt:', published.excerpt?.substring(0, 80) + '...');
      }
    } else if (result === 'SKIPPED') {
      console.log('\n⏭️  Article was skipped by pipeline');
    } else {
      console.log('\n⚠️  Check logs above for details');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

processNextArticle();
