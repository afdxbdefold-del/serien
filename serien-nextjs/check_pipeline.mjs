import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

// 1. Pipeline-Run Aggregat letzte 24h
const runs = await p.pipeline_runs.groupBy({
  by: ['pipeline', 'status', 'errorStep'],
  where: { createdAt: { gte: since } },
  _count: true,
  orderBy: { _count: { pipeline: 'desc' } },
});
console.log('=== Pipeline Runs (24h) ===');
for (const r of runs) {
  console.log(`${r.pipeline.padEnd(20)} | ${String(r.status).padEnd(10)} | ${String(r.errorStep || '-').padEnd(28)} | n=${r._count}`);
}

// 2. Letzter erfolgreicher Artikel
const last = await p.articles.findFirst({
  orderBy: { publishedAt: 'desc' },
  select: { slug: true, title: true, publishedAt: true, status: true },
});
console.log('\n=== Letzter Artikel ===');
console.log(last);

// 3. cron-news erfolgreich aber kein articleSlug
const silent = await p.pipeline_runs.findMany({
  where: {
    pipeline: 'cron-news',
    status: 'success',
    articleSlug: null,
    createdAt: { gte: since },
  },
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { id: true, createdAt: true, errorStep: true, errorMessage: true, metadata: true },
});
console.log(`\n=== cron-news success ohne articleSlug (24h, last 5 of ?) ===`);
for (const s of silent) {
  console.log(s);
}

await p.$disconnect();
