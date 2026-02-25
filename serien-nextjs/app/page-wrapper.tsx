import prisma from '@/lib/prisma';
import HomePage from './HomePage';

export default async function Page() {
  // Fetch news and series from database
  const [articles, series] = await Promise.all([
    prisma.article.findMany({
      where: { status: 'published' },
      include: {
        author: { select: { name: true } }
      },
      orderBy: { publishedAt: 'desc' },
      take: 10
    }),
    prisma.series.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return <HomePage articles={articles} series={series} />;
}
