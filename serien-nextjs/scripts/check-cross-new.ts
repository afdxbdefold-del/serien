import { PrismaClient } from '@prisma/client';

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

  console.log('=== CROSS ARTIKEL (NEU) ===');
  console.log('Title:', article.title);
  
  const h2Count = (article.contentHtml.match(/<h2>/g) || []).length;
  console.log('H2 count:', h2Count);
  
  if (h2Count > 0) {
    // Show each H2 with surrounding context
    const h2Pattern = /<p[^>]*>([^<]*)<\/p>\s*<h2>([^<]+)<\/h2>\s*<p[^>]*>([^<]*)/g;
    const matches = [...article.contentHtml.matchAll(h2Pattern)];
    
    console.log('\n=== H2 WITH CONTEXT ===\n');
    matches.forEach((match, i) => {
      const before = match[1].substring(Math.max(0, match[1].length - 100));
      const h2 = match[2];
      const after = match[3].substring(0, 100);
      
      console.log(`${i + 1}. Before: "...${before}"`);
      console.log(`   H2: "${h2}"`);
      console.log(`   After: "${after}..."`);
      console.log();
    });
    
    // Check for broken sentences
    const broken = article.contentHtml.match(/[^.!?]\s*<\/p>\s*<h2>/g);
    if (broken) {
      console.log('⚠️  WARNING: Found H2 after incomplete sentence!');
      console.log('Count:', broken.length);
    } else {
      console.log('✅ All H2s are placed after complete sentences!');
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
