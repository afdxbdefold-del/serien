/* eslint-disable */
import prisma from '../lib/prisma';
async function main() {
  const url = 'https://thecinemaholic.com/the-boroughs-ending-explained/';
  console.log(`Checking: ${url}\n`);

  // 1) Did we publish an article from this source?
  const art = await prisma.articles.findFirst({
    where: { sourceUrl: { contains: 'thecinemaholic.com/the-boroughs-ending-explained' } },
    select: { slug: true, status: true, publishedAt: true },
  });
  console.log('Article:', art || '<none>');

  // 2) Pipeline_runs entries for that URL
  const runs = await prisma.pipeline_runs.findMany({
    where: { inputSource: { contains: 'thecinemaholic.com/the-boroughs-ending-explained' } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, status: true, errorStep: true, errorMessage: true },
  });
  console.log(`\nPipeline runs (${runs.length}):`);
  runs.forEach((r) => {
    console.log(`  ${r.createdAt.toISOString()}  status=${r.status}  errorStep=${r.errorStep || '-'}  msg=${(r.errorMessage || '').slice(0, 120)}`);
  });

  // 3) The source: was it ever discovered by the scraper?
  const disc = await (prisma as any).discovered_urls.findMany({
    where: { url: { contains: 'thecinemaholic.com/the-boroughs-ending-explained' } },
    select: { url: true, channel: true, createdAt: true, processed: true },
  }).catch(() => []);
  console.log(`\nDiscovered URLs (${disc.length}):`);
  disc.forEach((d) => console.log(`  ${d.createdAt?.toISOString?.()}  channel=${d.channel}  processed=${d.processed}`));

  // 4) Check for other The Boroughs articles
  const otherBoroughs = await prisma.articles.findMany({
    where: { OR: [{ slug: { contains: 'boroughs' } }, { sourceUrl: { contains: 'boroughs' } }] },
    select: { slug: true, sourceUrl: true, publishedAt: true },
    take: 8,
  });
  console.log(`\nOther "boroughs"-related articles (${otherBoroughs.length}):`);
  otherBoroughs.forEach((a) => console.log(`  /${a.slug}  ← ${a.sourceUrl}  (${a.publishedAt?.toISOString().slice(0, 10)})`));

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
