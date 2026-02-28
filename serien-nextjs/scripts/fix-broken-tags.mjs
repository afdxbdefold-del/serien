/**
 * Fix broken <strong> tags in articles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function fixBrokenStrongTags(html) {
  // Fix patterns like: </strong>word<strong> -> word
  // These occur when markdown conversion splits words incorrectly
  return html
    .replace(/<\/strong>(\w+)<strong>/g, '$1')
    .replace(/<\/strong>(\d+)<strong>/g, '<strong>$1</strong>');
}

async function main() {
  console.log('🔧 Fixing broken <strong> tags...\n');
  
  const articles = await prisma.articles.findMany();
  
  let fixedCount = 0;
  
  for (const article of articles) {
    const broken = article.contentHtml.match(/<\/strong>[^<\s]+<strong>/g);
    
    if (broken) {
      console.log(`Fixing: ${article.title}`);
      console.log(`  Found ${broken.length} broken tag(s)`);
      
      const fixed = fixBrokenStrongTags(article.contentHtml);
      
      await prisma.articles.update({
        where: { id: article.id },
        data: {
          contentHtml: fixed,
          updatedAt: new Date()
        }
      });
      
      fixedCount++;
      console.log(`  ✅ Fixed\n`);
    }
  }
  
  console.log(`✅ Fixed ${fixedCount} article(s)!`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
