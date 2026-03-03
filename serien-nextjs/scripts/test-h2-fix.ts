import { PrismaClient } from '@prisma/client';
import { addSemanticHeadings } from '../lib/heading-generator';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-bekommt-eine-verlaengerung-fuer-staffel-3-bei-amazon-prime' },
    select: { id: true, title: true, contentHtml: true }
  });

  if (!article) {
    console.log('Artikel nicht gefunden');
    return;
  }

  // Remove existing H2
  let cleanHtml = article.contentHtml.replace(/<h2>[^<]+<\/h2>\s*/g, '');
  
  console.log('Testing updated H2 generator...\n');
  
  const updated = await addSemanticHeadings({
    contentHtml: cleanHtml,
    articleTitle: article.title,
    seriesName: 'Alex Cross'
  });

  const h2Count = (updated.match(/<h2>/g) || []).length;
  console.log('\n=== RESULT ===');
  console.log('H2 count:', h2Count);
  
  if (h2Count > 0) {
    const h2s = updated.match(/<h2>([^<]+)<\/h2>/g);
    console.log('\nGenerated H2s:');
    h2s?.forEach((h2, i) => {
      const text = h2.replace(/<\/?h2>/g, '');
      console.log(`  ${i + 1}. "${text}"`);
    });
    
    // Check for broken sentences
    const broken = updated.match(/[^.!?]\s*<\/p>\s*<h2>/g);
    if (broken) {
      console.log('\n❌ WARNING: H2 after incomplete sentence!');
    } else {
      console.log('\n✅ All H2s are after complete sentences!');
    }
    
    // Update article
    await prisma.articles.update({
      where: { id: article.id },
      data: { contentHtml: updated }
    });
    console.log('✅ Article updated');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
