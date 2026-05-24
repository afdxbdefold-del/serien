/* eslint-disable */
import prisma from '../lib/prisma';
async function main() {
  const a = await prisma.articles.findUnique({
    where: { slug: 'sha-na-na-spielte-gegen-den-zeitgeist-und-gewann-was-folgte-ueberrascht' },
    select: { contentHtml: true, excerpt: true, publishedAt: true, sourceUrl: true, metaDescription: true, title: true },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  console.log('TITLE:', a.title);
  console.log('PUBLISHED:', a.publishedAt);
  console.log('SOURCE:', a.sourceUrl);
  console.log('EXCERPT:', a.excerpt);
  console.log('---');
  console.log('FIRST 1500 CHARS OF contentHtml:');
  console.log((a.contentHtml || '').slice(0, 1500));
  console.log('---');
  console.log('H2 count:', (a.contentHtml || '').match(/<h2/gi)?.length || 0);
  console.log('FIRST TAG:', (a.contentHtml || '').trim().match(/<\w+[^>]*>/)?.[0]);

  // pipeline run
  const run = await prisma.pipeline_runs.findFirst({
    where: { inputSource: a.sourceUrl || '' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  }).catch(() => null);
  console.log('GENERATOR:', (run?.metadata as any)?.generator);
  console.log('CONTENT_TYPE:', (run?.metadata as any)?.contentType);
  await prisma.$disconnect();
}
main();
