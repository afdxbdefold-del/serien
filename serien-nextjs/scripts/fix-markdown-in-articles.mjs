/**
 * Fix Markdown formatting in existing articles
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function convertMarkdownToHTML(text: string): string {
  return text
    // Bold: **text** or __text__ -> <strong>text</strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ -> <em>text</em>  
    .replace(/\*([^*]+?)\*/g, '<em>$1</em>')
    .replace(/_([^_]+?)_/g, '<em>$1</em>');
}

async function main() {
  console.log('🔧 Fixing Markdown formatting in articles...\n');
  
  // Get all articles with ** in content
  const articles = await prisma.articles.findMany({
    where: {
      OR: [
        { contentHtml: { contains: '**' } },
        { excerpt: { contains: '**' } }
      ]
    }
  });
  
  console.log(`Found ${articles.length} articles with Markdown formatting\n`);
  
  for (const article of articles) {
    console.log(`Fixing: ${article.title}`);
    
    // Convert contentHtml
    const fixedContent = convertMarkdownToHTML(article.contentHtml);
    const fixedExcerpt = convertMarkdownToHTML(article.excerpt || '');
    
    // Update article
    await prisma.articles.update({
      where: { id: article.id },
      data: {
        contentHtml: fixedContent,
        excerpt: fixedExcerpt,
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✅ Fixed\n`);
  }
  
  console.log(`\n✅ Fixed ${articles.length} articles!`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
