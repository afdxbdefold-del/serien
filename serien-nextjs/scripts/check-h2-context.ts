import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-um-eine-3-staffel-bei-amazon-prime-verlaengert' },
    select: { contentHtml: true }
  });

  if (article) {
    const html = article.contentHtml;
    
    // Find all H2s and their following paragraphs
    const h2Pattern = /<h2>([^<]+)<\/h2>\s*\n*\s*<p[^>]*>([\s\S]*?)<\/p>/g;
    const matches = [...html.matchAll(h2Pattern)];
    
    console.log('=== H2 + FOLLOWING PARAGRAPH ===\n');
    
    matches.forEach((match, i) => {
      const heading = match[1];
      const paragraph = match[2].replace(/<[^>]*>/g, '').substring(0, 200);
      
      console.log(`${i + 1}. H2: "${heading}"`);
      console.log(`   Text: ${paragraph}...\n`);
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error);
