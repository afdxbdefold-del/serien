/* eslint-disable */
import prisma from '../lib/prisma';

async function main() {
  const slug = 'baywatch-startet-im-januar-erster-teaser-zeigt-neue-und-alte-gesichter';
  const a = await prisma.articles.findUnique({
    where: { slug },
    select: { slug: true, sourceUrl: true, publishedAt: true, excerpt: true, contentHtml: true },
  });
  if (!a) { console.log('NOT FOUND'); return; }
  console.log('PUBLISHED:', a.publishedAt);
  console.log('SOURCE:', a.sourceUrl);
  console.log('\n=== EXCERPT ===');
  console.log(a.excerpt);
  console.log('\n=== contentHtml ===');
  console.log(a.contentHtml);

  // Look for pipeline_runs entry
  const run = await prisma.pipeline_runs.findFirst({
    where: { OR: [{ inputSource: a.sourceUrl || '' }, { articleId: undefined }] },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, status: true, metadata: true, inputSource: true, errorStep: true, errorMessage: true },
  }).catch(() => null);
  if (run) {
    console.log('\n=== Pipeline Run ===');
    console.log('createdAt:', run.createdAt);
    console.log('status:', run.status);
    console.log('metadata:', run.metadata);
  }
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
