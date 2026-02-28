/**
 * Fix excerpt truncation for existing articles
 */

import { PrismaClient } from '@prisma/client';
import { smartTruncate } from '../lib/smart-truncate.ts';

const prisma = new PrismaClient();

async function fixExcerpts() {
  console.log('🔧 Fixing excerpt truncation...\n');
  
  // Get all articles with excerpts ending in "…"
  const articles = await prisma.articles.findMany({
    where: {
      excerpt: { endsWith: '…' }
    }
  });
  
  console.log(`Found ${articles.length} articles with truncated excerpts\n`);
  
  for (const article of articles) {
    console.log(`Fixing: ${article.title}`);
    console.log(`  Old: ${article.excerpt}`);
    
    // Get the lead paragraph from contentHtml
    const leadMatch = article.contentHtml.match(/<p class="lead">([^<]+)<\/p>/);
    if (leadMatch) {
      const leadText = leadMatch[1].replace(/<[^>]*>/g, '').trim();
      const newExcerpt = smartTruncate(leadText, 200);
      
      await prisma.articles.update({
        where: { id: article.id },
        data: {
          excerpt: newExcerpt,
          updatedAt: new Date()
        }
      });
      
      console.log(`  New: ${newExcerpt}`);
      console.log(`  ✅ Fixed\n`);
    } else {
      console.log(`  ⚠️  No lead paragraph found\n`);
    }
  }
  
  console.log(`✅ Fixed ${articles.length} article(s)!`);
  
  await prisma.$disconnect();
}

fixExcerpts().catch(console.error);
