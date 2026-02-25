import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';

  // Hole alle veröffentlichten Artikel
  const articles = await prisma.article.findMany({
    where: { status: 'published' },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true
    },
    orderBy: { publishedAt: 'desc' }
  });

  const articleUrls = articles.map((article) => ({
    url: `${baseUrl}/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: 'daily' as const,
    priority: 0.8
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1
    },
    ...articleUrls
  ];
}
