import prisma from '../lib/prisma';

async function checkLinks() {
  const article = await prisma.article.findFirst({
    where: { slug: 'a-knight-of-the-seven-kingdoms-episode-4-recap' },
    select: { contentHtml: true }
  });
  
  if (article) {
    const lines = article.contentHtml.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('Mehr zu') || line.includes('Weitere News')) {
        console.log(`Zeile ${i}: ${line.substring(0, 150)}`);
      }
    });
  }
}

checkLinks().finally(() => prisma.$disconnect());
