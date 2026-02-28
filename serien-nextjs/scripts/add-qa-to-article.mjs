import { PrismaClient } from '@prisma/client';
import { generateArticleQA } from '../lib/qa-generator.ts';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'house-of-the-dragon-staffel-3-george-r-r-martin-enthuellt-wichtige-handlungdetails' },
    include: { series: true }
  });
  
  if (!article) {
    console.log('❌ Artikel nicht gefunden');
    return;
  }
  
  console.log('📄 Generiere Q&A für:', article.title);
  
  const qaItems = await generateArticleQA({
    title: article.title,
    contentHtml: article.contentHtml,
    seriesName: article.series?.title || 'Unknown'
  });
  
  if (qaItems.length > 0) {
    console.log(`\n✅ ${qaItems.length} Q&A Paare generiert, speichere in DB...`);
    
    // Delete old Q&A
    await prisma.article_qa.deleteMany({
      where: { articleId: article.id }
    });
    
    // Insert new Q&A as JSON array
    await prisma.article_qa.create({
      data: {
        id: `${article.id}-qa`,
        articleId: article.id,
        questions: qaItems,
        schemaEnabled: true,
        generatedAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    console.log('✅ Q&A in Datenbank gespeichert!');
    console.log(`\n📍 Artikel URL: http://localhost:3000/${article.slug}`);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
