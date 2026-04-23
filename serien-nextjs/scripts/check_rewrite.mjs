import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const runs = await p.pipeline_runs.findMany({
  where: { startedAt: { gte: new Date(Date.now() - 7*24*60*60*1000) } },
  select: { id: true, metadata: true, startedAt: true },
  orderBy: { startedAt: 'desc' },
  take: 200
});
let attempted = 0, applied = 0, totalGain = 0;
const samples = [];
for (const r of runs) {
  try {
    const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
    if (m?.headlineRewrite) {
      attempted++;
      if (m.headlineRewrite.applied) {
        applied++;
        totalGain += (m.headlineRewrite.afterScore || 0) - (m.headlineRewrite.beforeScore || 0);
        if (samples.length < 5) samples.push({
          before: m.headlineRewrite.beforeHeadline,
          after: m.headlineRewrite.afterHeadline,
          gain: (m.headlineRewrite.afterScore || 0) - (m.headlineRewrite.beforeScore || 0),
          createdAt: r.startedAt
        });
      }
    }
  } catch (e) {}
}
console.log(JSON.stringify({ windowRuns: runs.length, attempted, applied, avgGain: applied ? (totalGain/applied).toFixed(1) : 0, samples }, null, 2));
await p.$disconnect();
