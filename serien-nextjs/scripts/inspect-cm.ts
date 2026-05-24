/* eslint-disable */
import prisma from '../lib/prisma';
async function main() {
  const slug = 'criminal-minds-staffel-19-startet-am-28-mai-ohne-alte-bekannte';
  const a = await prisma.articles.findUnique({
    where: { slug },
    select: { contentHtml: true, excerpt: true, publishedAt: true, updatedAt: true, sourceUrl: true, title: true },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  console.log('TITLE:', a.title);
  console.log('PUBLISHED:', a.publishedAt?.toISOString());
  console.log('UPDATED:  ', a.updatedAt?.toISOString());
  console.log('SOURCE:', a.sourceUrl);
  console.log('EXCERPT:', a.excerpt);
  const first = (a.contentHtml || '').trim().match(/<\w+[^>]*>/);
  console.log('FIRST TAG:', first?.[0]);
  console.log('---');
  console.log((a.contentHtml || '').slice(0, 600));
  await prisma.$disconnect();
}
main();
