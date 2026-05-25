/* eslint-disable */
import prisma from '../lib/prisma';
async function main() {
  const a = await prisma.articles.findUnique({
    where: { slug: 'iman-vellani-besucht-den-set-von-daredevil-born-again-staffel-3' },
    select: { contentHtml: true, excerpt: true, sourceUrl: true, publishedAt: true },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  console.log('SOURCE:', a.sourceUrl);
  console.log('PUBLISHED:', a.publishedAt?.toISOString());
  console.log('EXCERPT:', a.excerpt);
  console.log('---');
  console.log(a.contentHtml);
  await prisma.$disconnect();
}
main();
