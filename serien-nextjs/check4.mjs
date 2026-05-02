import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const cutoff = new Date('2026-05-02T03:16:10.500Z');
const after = await p.pipeline_runs.findMany({
  where: { pipeline: 'pipeline-v2', createdAt: { gte: cutoff } },
  select: { metadata: true, errorStep: true, articleSlug: true, status: true, createdAt: true },
});

const urlMap = {};
for (const r of after) {
  try {
    const m = JSON.parse(r.metadata || '{}');
    const u = m.url || '?';
    urlMap[u] = urlMap[u] || { count: 0, step: r.errorStep, status: r.status };
    urlMap[u].count++;
  } catch {}
}
const uniqUrls = Object.entries(urlMap).sort((a,b)=>b[1].count - a[1].count);
console.log(`=== Unique URLs in failed runs after last publish: ${uniqUrls.length} URLs over ${after.length} runs ===`);
for (const [u, info] of uniqUrls.slice(0, 30)) {
  console.log(`x${info.count} | ${info.step} | ${u}`);
}

// rss-source last fetch
const rssLog = await p.rss_fetch_log?.findMany?.({
  orderBy: { createdAt: 'desc' },
  take: 10,
}).catch(()=>null);
console.log('\n=== rss_fetch_log (or skipped) ===');
console.log(rssLog ? rssLog.slice(0,5) : 'no model');

// scraped_articles count
const scraped = await p.scraped_articles?.findMany?.({
  orderBy: { createdAt: 'desc' },
  take: 5,
}).catch(()=>null);
console.log('\n=== scraped_articles last 5 ===');
console.log(scraped ? scraped.map(s=>({source: s.source, url: s.url?.slice(0,100), createdAt: s.createdAt, processed: s.processed, status: s.status})).slice(0,5) : 'no model');

await p.$disconnect();
