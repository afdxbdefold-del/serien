import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const articles = await prisma.articles.findMany({
    where: { id: { startsWith: 'pipeline-v2' } },
    select: { id: true, title: true, slug: true, contentHtml: true },
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  if (articles.length > 0) {
    const article = articles[0];
    console.log('=== PIPELINE V2 ARTIKEL ===');
    console.log('ID:', article.id);
    console.log('Title:', article.title);
    console.log('Slug:', article.slug);
    
    const h2Count = (article.contentHtml.match(/<h2>/g) || []).length;
    const h3Count = (article.contentHtml.match(/<h3>/g) || []).length;
    console.log('\nH2 tags:', h2Count);
    console.log('H3 tags:', h3Count);
    
    if (h2Count > 0) {
      const h2s = article.contentHtml.match(/<h2>([^<]+)<\/h2>/g);
      console.log('\nH2 Überschriften:');
      h2s?.forEach((h2, i) => {
        const text = h2.replace(/<\/?h2>/g, '');
        console.log(`  ${i + 1}. "${text}" (${text.length} chars)`);
      });
    }
  } else {
    console.log('Kein pipeline-v2 Artikel gefunden');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
