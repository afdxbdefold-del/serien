import prisma from '../lib/prisma';

async function fixTellMeLiesExcerpt() {
  const distinctLead = 'Hulu zieht nach drei Staffeln den Stecker: „Tell Me Lies" wird nicht fortgesetzt. Die toxische Drama-Serie um Lucy und Stephen endet ohne weitere Fortsetzung – trotz offener Fragen und Spekulationen der Fans.';
  
  await prisma.articles.updateMany({
    where: { slug: 'tell-me-lies-staffel-4' },
    data: { excerpt: distinctLead }
  });
  
  console.log('✅ Excerpt updated for Tell Me Lies article');
  console.log(distinctLead);
}

fixTellMeLiesExcerpt().finally(() => prisma.$disconnect());
