import prisma from '../lib/prisma';

async function main() {
  const a = await prisma.articles.findUnique({
    where: { slug: 'nach-dem-staffel-2-finale-one-piece-staffel-3-nimmt-fahrt-auf' },
    select: { excerpt: true, contentHtml: true, publishedAt: true, updatedAt: true, metaDescription: true }
  });
  console.log('=== EXCERPT ===');
  console.log(a?.excerpt);
  console.log('=== META ===');
  console.log(a?.metaDescription);
  console.log('=== publishedAt ===', a?.publishedAt);
  console.log('=== updatedAt   ===', a?.updatedAt);
  console.log('=== contentHtml (first 2000 chars) ===');
  console.log((a?.contentHtml || '').slice(0, 2000));
  await prisma.$disconnect();
}
main().catch(console.error);
