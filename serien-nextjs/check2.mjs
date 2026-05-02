import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

const arts = await p.articles.findMany({
  where: { createdAt: { gte: since } },
  orderBy: { createdAt: 'desc' },
  select: { slug: true, title: true, status: true, publishedAt: true, createdAt: true, category: true, publishMode: true },
});
console.log(`=== Articles created in 24h (count=${arts.length}) ===`);
for (const a of arts.slice(0, 30)) {
  console.log(`${a.createdAt.toISOString()} | st=${(a.status||'-').padEnd(8)} | mode=${(a.publishMode||'-').padEnd(8)} | cat=${(a.category||'-').padEnd(10)} | ${a.slug}`);
}

const lastPub = await p.articles.findFirst({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  select: { slug: true, publishedAt: true, status: true, publishMode: true },
});
console.log(`\n=== Letzter publizierter Artikel ===\n`, lastPub);

const succ = await p.pipeline_runs.findMany({
  where: { pipeline: 'pipeline-v2', status: 'success', createdAt: { gte: since } },
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: { id: true, createdAt: true, articleSlug: true, metadata: true },
});
console.log(`\n=== Letzte 10 pipeline-v2 success runs ===`);
for (const r of succ) {
  console.log(`${r.createdAt.toISOString()} | slug=${r.articleSlug || '-'} | meta=${(r.metadata||'').slice(0,200)}`);
}

await p.$disconnect();
