import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Last 8h - all pipeline-v2 runs by hour & status
const since = new Date(Date.now() - 12 * 60 * 60 * 1000);
const runs = await p.pipeline_runs.findMany({
  where: { pipeline: 'pipeline-v2', createdAt: { gte: since } },
  orderBy: { createdAt: 'desc' },
  select: { createdAt: true, status: true, errorStep: true, errorMessage: true, articleSlug: true, metadata: true },
});

const buckets = {};
for (const r of runs) {
  const h = r.createdAt.toISOString().slice(0, 13);
  buckets[h] = buckets[h] || { ok: 0, fail: 0, byStep: {} };
  if (r.status === 'success') buckets[h].ok++;
  else if (r.status === 'failed') {
    buckets[h].fail++;
    buckets[h].byStep[r.errorStep || 'unknown'] = (buckets[h].byStep[r.errorStep || 'unknown'] || 0) + 1;
  }
}
console.log('=== pipeline-v2 by hour (last 12h) ===');
for (const [h, b] of Object.entries(buckets).sort()) {
  const top = Object.entries(b.byStep).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}=${v}`).join(', ');
  console.log(`${h}: success=${b.ok} | failed=${b.fail} | top: ${top}`);
}

// Last 5 successes
const succ = runs.filter(r => r.status === 'success').slice(0, 5);
console.log('\n=== Most recent 5 success ===');
for (const r of succ) console.log(`${r.createdAt.toISOString()} | ${r.articleSlug}`);

// Newest 20 failures since last published article (after 03:16:10Z)
const cutoff = new Date('2026-05-02T03:16:10.500Z');
const recentFails = runs.filter(r => r.status === 'failed' && r.createdAt > cutoff).slice(0, 20);
console.log('\n=== Failures AFTER last published article (most recent first, max 20) ===');
for (const r of recentFails) {
  console.log(`${r.createdAt.toISOString()} | ${r.errorStep} | ${(r.errorMessage||'').slice(0,80)}`);
}

// total runs after cutoff
const after = runs.filter(r => r.createdAt > cutoff);
const stepCounts = {};
for (const r of after) stepCounts[r.errorStep || (r.status==='success'?'OK':'unknown')] = (stepCounts[r.errorStep || (r.status==='success'?'OK':'unknown')] || 0) + 1;
console.log(`\n=== Step distribution AFTER 03:16 (n=${after.length}) ===`);
for (const [k,v] of Object.entries(stepCounts).sort((a,b)=>b[1]-a[1])) console.log(`${k}: ${v}`);

await p.$disconnect();
