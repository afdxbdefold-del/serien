import prisma from '../lib/prisma';

async function fixExcerpt() {
  const distinctLead = 'Die sechste Episode von „The Pitt" Staffel 2 endet mit einem emotionalen Abschied: Stammpatient Louie stirbt im Pittsburgh Trauma Medical Center. Das Team erfährt die tragische Geschichte hinter seinem jahrelangen Alkoholismus.';
  
  await prisma.articles.updateMany({
    where: { slug: 'the-pitt-staffel-2-episode-6-recap' },
    data: { excerpt: distinctLead }
  });
  
  console.log('✅ Excerpt updated with distinct lead:');
  console.log(distinctLead);
}

fixExcerpt().finally(() => prisma.$disconnect());
