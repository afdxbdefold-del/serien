import { PrismaClient } from '@prisma/client';
import { addSemanticHeadings } from '../lib/heading-generator';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-um-eine-3-staffel-bei-amazon-prime-verlaengert' },
    select: { id: true, title: true, contentHtml: true },
    orderBy: { createdAt: 'desc' }
  });

  if (!article) {
    console.log('Artikel nicht gefunden');
    return;
  }

  console.log('=== TESTING H2 GENERATOR ===\n');
  console.log('Article:', article.title);
  console.log('Current H2 count:', (article.contentHtml.match(/<h2>/g) || []).length);
  console.log('Paragraph count:', (article.contentHtml.match(/<p/g) || []).length);
  console.log();

  const updated = await addSemanticHeadings({
    contentHtml: article.contentHtml,
    articleTitle: article.title,
    seriesName: 'Alex Cross'
  });

  const h2Count = (updated.match(/<h2>/g) || []).length;
  
  console.log('\n=== RESULT ===');
  console.log('H2 count after:', h2Count);
  
  if (h2Count > 0) {
    const h2Matches = updated.match(/<h2>([^<]+)<\/h2>/g);
    console.log('\nGenerated H2s:');
    h2Matches?.forEach((h2, i) => {
      const text = h2.replace(/<\/?h2>/g, '');
      console.log(`  ${i + 1}. "${text}" (${text.length} chars, ${text.split(/\s+/).length} words)`);
    });
    
    // Update article
    await prisma.articles.update({
      where: { id: article.id },
      data: { contentHtml: updated }
    });
    
    console.log('\n✅ Article updated in database');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
