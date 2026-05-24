/* eslint-disable */
import prisma from '../lib/prisma';

async function main() {
  // 1) Publication volume last 60 days
  const byDay = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date_trunc('day', "publishedAt") AS day, COUNT(*) AS n
    FROM articles
    WHERE status='published' AND "publishedAt" >= NOW() - INTERVAL '60 days'
    GROUP BY 1 ORDER BY 1 DESC
  `);
  console.log('=== Publication Volume (last 60 days) ===');
  byDay.forEach(r => console.log(`${r.day.toISOString().slice(0,10)}: ${r.n}`));

  // 2) Total published
  const total = await prisma.articles.count({ where: { status: 'published' } });
  console.log(`\nTotal published: ${total}`);

  // 3) Word-count distribution last 7 days vs 30-60 days ago
  const recent: any = await prisma.$queryRawUnsafe(`
    SELECT AVG(array_length(regexp_split_to_array("contentHtml", '\\s+'), 1)) AS avg_words
    FROM articles WHERE status='published' AND "publishedAt" >= NOW() - INTERVAL '7 days'
  `);
  const older: any = await prisma.$queryRawUnsafe(`
    SELECT AVG(array_length(regexp_split_to_array("contentHtml", '\\s+'), 1)) AS avg_words
    FROM articles WHERE status='published' AND "publishedAt" < NOW() - INTERVAL '30 days' AND "publishedAt" >= NOW() - INTERVAL '60 days'
  `);
  console.log(`\nAvg words last 7d:    ${Math.round(Number(recent[0]?.avg_words) || 0)}`);
  console.log(`Avg words 30-60d ago: ${Math.round(Number(older[0]?.avg_words) || 0)}`);

  // 4) Articles with potentially broken content (empty or < 300 chars stripped)
  const broken = await prisma.$queryRawUnsafe<any[]>(`
    SELECT slug, LENGTH("contentHtml") AS len, "publishedAt"
    FROM articles
    WHERE status='published'
      AND (LENGTH(regexp_replace("contentHtml", '<[^>]+>', '', 'g')) < 300)
    ORDER BY "publishedAt" DESC
    LIMIT 30
  `);
  console.log(`\n=== Articles with stripped body < 300 chars ===`);
  console.log(`Count: ${broken.length}`);
  broken.slice(0, 10).forEach(r => console.log(`  /${r.slug}  (${r.len}c, ${r.publishedAt?.toISOString()?.slice(0,10)})`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
