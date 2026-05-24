/* eslint-disable */
import prisma from '../lib/prisma';

async function main() {
  // 9) Hallucination log (fixed column name)
  const halCols = await prisma.$queryRawUnsafe<any[]>(`
    SELECT column_name FROM information_schema.columns WHERE table_name='hallucination_log'
  `).catch(() => []);
  console.log('=== hallucination_log columns ===');
  halCols.forEach((c: any) => console.log('  ' + c.column_name));

  const halCount = await prisma.$queryRawUnsafe<any[]>(`
    SELECT date_trunc('week', "createdAt") AS week, COUNT(*) AS n
    FROM hallucination_log WHERE "createdAt" >= NOW() - INTERVAL '60 days'
    GROUP BY 1 ORDER BY 1 DESC
  `).catch(() => []);
  console.log('\n=== Hallucination volume per week (last 60d) ===');
  halCount.forEach((r: any) => console.log(`  ${r.week.toISOString().slice(0,10)}: ${r.n}`));

  // 10) Sample 5 recent articles — check generator + key markers
  const samples = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { slug: true, contentHtml: true, excerpt: true, metaDescription: true, publishedAt: true, sourceUrl: true },
    orderBy: { publishedAt: 'desc' },
    take: 8,
  });
  console.log('\n=== Latest 8 articles — content markers ===');
  for (const a of samples) {
    const html = a.contentHtml || '';
    const wordCount = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    const h2 = (html.match(/<h2/gi) || []).length;
    const strong = (html.match(/<strong/gi) || []).length;
    const links = (html.match(/<a\s+/gi) || []).length;
    const quotes = (html.match(/[„"]/g) || []).length;
    const md = (html.match(/\*\*[^*]+\*\*/g) || []).length;
    console.log(`/${a.slug}`);
    console.log(`  words=${wordCount}  h2=${h2}  strong=${strong}  links=${links}  quotes=${quotes}  unconverted_md=${md}`);
    console.log(`  source: ${a.sourceUrl?.slice(0, 80) || '<none>'}`);
  }

  // 11) Articles with unconverted markdown ** in DB
  const mdLeft = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) AS n FROM articles
    WHERE status='published' AND "contentHtml" ~ '\\*\\*[^*]+\\*\\*'
  `);
  console.log(`\nArticles with unconverted **markdown** still in DB: ${mdLeft[0]?.n || 0}`);

  // 12) Articles with no <h2> at all
  const noH2 = await prisma.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) AS n FROM articles
    WHERE status='published' AND "contentHtml" !~ '<h2' AND "publishedAt" >= NOW() - INTERVAL '30 days'
  `);
  console.log(`Recent (30d) articles without ANY <h2>: ${noH2[0]?.n || 0}`);

  // 13) Sources distribution
  const srcs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT split_part(split_part("sourceUrl", '://', 2), '/', 1) AS host, COUNT(*) AS n
    FROM articles WHERE status='published' AND "publishedAt" >= NOW() - INTERVAL '30 days'
    GROUP BY 1 ORDER BY n DESC LIMIT 15
  `);
  console.log('\n=== Source publishers (last 30 days) ===');
  srcs.forEach((r: any) => console.log(`  ${(r.host || '').padEnd(40)}: ${r.n}`));

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
