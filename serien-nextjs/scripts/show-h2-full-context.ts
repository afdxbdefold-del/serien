import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const article = await prisma.articles.findFirst({
    where: { slug: 'cross-bekommt-eine-verlaengerung-fuer-staffel-3-bei-amazon-prime' },
    select: { contentHtml: true }
  });

  if (!article) {
    console.log('Artikel nicht gefunden');
    return;
  }

  // Find all H2s with 200 chars before and after
  const h2Indices: number[] = [];
  let searchPos = 0;
  
  while (true) {
    const pos = article.contentHtml.indexOf('<h2>', searchPos);
    if (pos === -1) break;
    h2Indices.push(pos);
    searchPos = pos + 1;
  }
  
  console.log(`Found ${h2Indices.length} H2 tags\n`);
  console.log('='.repeat(70));
  
  h2Indices.forEach((pos, i) => {
    const before = article.contentHtml.substring(Math.max(0, pos - 200), pos);
    const h2End = article.contentHtml.indexOf('</h2>', pos) + 5;
    const h2Text = article.contentHtml.substring(pos, h2End);
    const after = article.contentHtml.substring(h2End, h2End + 200);
    
    console.log(`\nH2 #${i + 1}:`);
    console.log('Before: ' + before.replace(/\n/g, ' ').substring(0, 100) + '...');
    console.log('H2:     ' + h2Text);
    console.log('After:  ' + after.replace(/\n/g, ' ').substring(0, 100) + '...');
    console.log('='.repeat(70));
  });

  await prisma.$disconnect();
}

main().catch(console.error);
