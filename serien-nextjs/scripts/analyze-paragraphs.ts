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

  const paragraphs = article.contentHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  
  console.log('=== ABSATZ-ANALYSE ===\n');
  console.log(`Total paragraphs: ${paragraphs.length}\n`);
  
  paragraphs.forEach((p, i) => {
    const text = p.replace(/<[^>]*>/g, '').trim();
    const lastChar = text.slice(-1);
    const endsWithSentence = /[.!?]$/.test(text);
    
    console.log(`[${i}] Last char: "${lastChar}" | Ends with sentence: ${endsWithSentence ? '✅' : '❌'}`);
    console.log(`    Text (last 80 chars): ...${text.substring(Math.max(0, text.length - 80))}`);
    console.log();
  });
  
  // Check positions 2, 4, 6
  const positions = [2, 4, 6];
  console.log('=== H2 INSERTION POSITIONS ===\n');
  positions.forEach(pos => {
    if (pos >= paragraphs.length) {
      console.log(`Position ${pos}: OUT OF RANGE`);
      return;
    }
    
    const prevIdx = pos - 1;
    const prevText = paragraphs[prevIdx].replace(/<[^>]*>/g, '').trim();
    const endsWithSentence = /[.!?]$/.test(prevText);
    
    console.log(`Position ${pos} (after paragraph ${prevIdx}):`);
    console.log(`  ${endsWithSentence ? '✅ ALLOWED' : '❌ BLOCKED'} - Previous paragraph ends with: "${prevText.slice(-10)}"`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
