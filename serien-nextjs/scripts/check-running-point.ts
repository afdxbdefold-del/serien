import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const articles = await p.articles.findMany({
    where: { OR: [
      { slug: { contains: 'running-point', mode: 'insensitive' } },
      { title: { contains: 'Running Point', mode: 'insensitive' } },
    ]},
    select: { slug: true, title: true, publishedAt: true, status: true },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  });
  console.log('ARTICLES:', JSON.stringify(articles, null, 2));
  const series = await p.series.findMany({
    where: { OR: [
      { slug: { contains: 'running-point', mode: 'insensitive' } },
      { title: { contains: 'Running Point', mode: 'insensitive' } },
    ]},
    select: { slug: true, title: true, tmdbId: true },
    take: 5,
  });
  console.log('SERIES:', JSON.stringify(series, null, 2));
  await p.$disconnect();
})();
