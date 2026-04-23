import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const runs = await p.pipeline_runs.findMany({
  where: { startedAt: { gte: new Date(Date.now() - 7*24*60*60*1000) } },
  select: { id: true, metadata: true, startedAt: true, articleTitle: true },
  orderBy: { startedAt: 'desc' },
  take: 200
});
const withRewrite = [];
for (const r of runs) {
  try {
    const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
    if (m?.headlineRewrite) withRewrite.push({ ...r, rewrite: m.headlineRewrite });
  } catch (e) {}
}
console.log(`Found ${withRewrite.length} runs with rewrite metadata`);
console.log('First full sample:');
console.log(JSON.stringify(withRewrite[0], null, 2));
await p.$disconnect();
