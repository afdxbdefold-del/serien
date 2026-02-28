/**
 * Clean up existing articles with LLM artifacts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sanitizeContent(text) {
  return text
    // Remove generic filler sentences
    .replace(/Die\s+[A-Z][\w-]+-(Serie|Plattform)\s+[„"][\w\s:]+[""]\s+berichtet über die neue staffel\./gi, '')
    .replace(/^\s*Inhaltlich steht\s*/gm, '')
    // Clean up double spaces and empty paragraphs
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/<\/p>\s+<p>/g, '</p>\n\n<p>')
    .trim();
}

async function main() {
  console.log('🧹 Cleaning LLM artifacts from articles...\n');
  
  const articles = await prisma.articles.findMany({
    where: {
      contentHtml: { contains: 'berichtet über die neue staffel' }
    }
  });
  
  console.log(`Found ${articles.length} articles with artifacts\n`);
  
  for (const article of articles) {
    console.log(`Cleaning: ${article.title}`);
    
    const cleanedContent = sanitizeContent(article.contentHtml);
    const cleanedExcerpt = article.excerpt ? sanitizeContent(article.excerpt) : article.excerpt;
    
    await prisma.articles.update({
      where: { id: article.id },
      data: {
        contentHtml: cleanedContent,
        excerpt: cleanedExcerpt,
        updatedAt: new Date()
      }
    });
    
    console.log(`  ✅ Cleaned\n`);
  }
  
  console.log(`✅ Cleaned ${articles.length} articles!`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
