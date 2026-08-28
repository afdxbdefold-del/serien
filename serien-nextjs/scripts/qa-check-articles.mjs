// READ-ONLY QA check: recent published articles + source hosts. No LLM calls.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.articles.count({ where: { status: 'published' } });
  console.log('TOTAL_PUBLISHED=' + total);

  const recent = await prisma.articles.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 12,
    select: { slug: true, title: true, publishedAt: true, sourceUrl: true },
  });

  console.log('--- RECENT 12 ---');
  for (const a of recent) {
    let host = 'n/a';
    try { host = a.sourceUrl ? new URL(a.sourceUrl).host : 'n/a'; } catch {}
    console.log(`${a.publishedAt?.toISOString()} | ${host} | /news/${a.slug} | ${a.title?.slice(0, 60)}`);
  }

  const now = new Date();
  for (const days of [1, 3, 7, 30]) {
    const since = new Date(now.getTime() - days * 86400000);
    const c = await prisma.articles.count({
      where: { status: 'published', publishedAt: { gte: since } },
    });
    console.log(`PUBLISHED_LAST_${days}D=${c}`);
  }
}

main()
  .catch((e) => { console.error('ERROR', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
