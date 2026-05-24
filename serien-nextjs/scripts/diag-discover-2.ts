/* eslint-disable */
import prisma from '../lib/prisma';

async function main() {
  // 5) Hallucination log volume by week
  const hl = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS n, "failType", COUNT(*) AS cnt
    FROM hallucination_log
    WHERE "createdAt" >= NOW() - INTERVAL '60 days'
    GROUP BY 1, "failType"
    ORDER BY 1 DESC, cnt DESC
  `).catch(() => []);
  console.log('=== Hallucination log (last 60 days) ===');
  hl.slice(0, 30).forEach(r => console.log(`${r.week.toISOString().slice(0,10)}  ${r.failType?.padEnd(28)}  ${r.n}`));

  // 6) Pipeline-Run conversion rate by week (published / attempted)
  const conv = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date_trunc('week', "createdAt") AS week,
           COUNT(*) FILTER (WHERE status='success') AS published,
           COUNT(*) AS attempts
    FROM pipeline_runs
    WHERE "createdAt" >= NOW() - INTERVAL '60 days'
    GROUP BY 1 ORDER BY 1 DESC
  `).catch(() => []);
  console.log('\n=== Pipeline conversion rate (last 60 days) ===');
  conv.forEach(r => {
    const rate = Number(r.attempts) ? Math.round((Number(r.published) / Number(r.attempts)) * 100) : 0;
    console.log(`${r.week.toISOString().slice(0,10)}: pub=${r.published}, att=${r.attempts}, rate=${rate}%`);
  });

  // 7) Top primarySeriesId concentration (whether we're spamming the same shows)
  const topSeries = await prisma.$queryRawUnsafe<any[]>(`
    SELECT s.name, COUNT(a.id) AS n
    FROM articles a
    LEFT JOIN series s ON s."tmdbId" = a."primarySeriesId"
    WHERE a.status='published' AND a."publishedAt" >= NOW() - INTERVAL '30 days'
    GROUP BY s.name ORDER BY n DESC LIMIT 15
  `).catch((e) => { console.error('topSeries query failed:', e.message); return []; });
  console.log('\n=== Top primarySeries (last 30 days) ===');
  topSeries.forEach(r => console.log(`  ${(r.name || '<unknown>').padEnd(40)}: ${r.n}`));

  // 8) Articles per day on weekends vs weekdays (newsroom pattern check)
  const dow = await prisma.$queryRawUnsafe<any[]>(`
    SELECT EXTRACT(DOW FROM "publishedAt") AS dow, COUNT(*) AS n
    FROM articles
    WHERE status='published' AND "publishedAt" >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY 1
  `);
  const dowNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  console.log('\n=== Day-of-week distribution (last 30 days) ===');
  dow.forEach((r: any) => console.log(`  ${dowNames[Number(r.dow)]}: ${r.n}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
