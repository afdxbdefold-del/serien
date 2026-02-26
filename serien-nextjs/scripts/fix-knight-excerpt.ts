import prisma from '../lib/prisma';

async function fixKnightExcerpt() {
  const distinctLead = 'Dunk steht vor seiner größten Herausforderung: Er muss sechs Ritter finden, die für Ser Duncan den Großen in den Kampf ziehen. Die vierte Episode von „A Knight of the Seven Kingdoms" zeigt, wie schwierig es ist, Verbündete zu gewinnen.';
  
  await prisma.article.updateMany({
    where: { slug: 'a-knight-of-the-seven-kingdoms-episode-4-recap' },
    data: { excerpt: distinctLead }
  });
  
  console.log('✅ Excerpt updated for A Knight of the Seven Kingdoms');
  console.log(distinctLead);
}

fixKnightExcerpt().finally(() => prisma.$disconnect());
