/* eslint-disable */
import prisma from '../lib/prisma';

async function main() {
  const a = await prisma.articles.findUnique({
    where: { slug: 'warum-landman-monate-nach-dem-finale-noch-immer-zuschauer-zieht' },
    select: {
      slug: true, sourceUrl: true, title: true, excerpt: true,
      contentHtml: true, publishedAt: true, primarySeriesId: true,
    },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  console.log('SLUG:', a.slug);
  console.log('TITLE:', a.title);
  console.log('PUBLISHED:', a.publishedAt);
  console.log('SOURCE URL:', a.sourceUrl);
  console.log('EXCERPT:', a.excerpt);
  console.log('\n=== contentHtml (first 3000 chars) ===');
  console.log((a.contentHtml || '').slice(0, 3000));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
