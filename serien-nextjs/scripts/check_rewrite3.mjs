import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const runs = await p.pipeline_runs.findMany({
  where: { startedAt: { gte: new Date(Date.now() - 14*24*60*60*1000) } },
  select: { id: true, metadata: true, startedAt: true, articleTitle: true, status: true },
  orderBy: { startedAt: 'desc' },
  take: 2000
});
let total = 0, attempted = 0, applied = 0, gains = [];
const samples = [];
for (const r of runs) {
  try {
    const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
    if (m?.headlineRewrite) {
      total++;
      if (m.headlineRewrite.attempted) attempted++;
      if (m.headlineRewrite.applied) {
        applied++;
        gains.push(m.headlineRewrite.gain || 0);
        if (samples.length < 6) samples.push({
          date: r.startedAt.toISOString().slice(0,16),
          before: m.headlineRewrite.originalHeadline,
          after: m.headlineRewrite.finalHeadline,
          gain: m.headlineRewrite.gain,
          beforeScore: m.headlineRewrite.beforePerformance,
          afterScore: m.headlineRewrite.afterPerformance
        });
      }
    }
  } catch (e) {}
}
const avgGain = gains.length ? (gains.reduce((a,b)=>a+b,0)/gains.length).toFixed(1) : 0;
const maxGain = gains.length ? Math.max(...gains) : 0;
console.log(`Runs scanned: ${runs.length} (14d)`);
console.log(`Runs with rewrite-metadata: ${total}`);
console.log(`Attempted: ${attempted}`);
console.log(`Applied: ${applied}`);
console.log(`Avg gain: +${avgGain} Punkte`);
console.log(`Max gain: +${maxGain} Punkte`);
console.log('\nSamples:');
for (const s of samples) {
  console.log(`\n[${s.date}] +${s.gain}P (${s.beforeScore} → ${s.afterScore})`);
  console.log(`  ALT:  ${s.before}`);
  console.log(`  NEU:  ${s.after}`);
}
await p.$disconnect();
