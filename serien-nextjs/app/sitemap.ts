import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://serien.de';

  // Fetch all published articles
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: {
      slug: true,
      updatedAt: true,
    },
  });

  // Fetch all series
  const series = await prisma.series.findMany({
    select: {
      tmdbId: true,
      slug: true,
      updatedAt: true,
    },
  });

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${baseUrl}/trending`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/redaktion`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/impressum`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
  ];

  // Article pages - using /<slug> instead of /artikel/<slug>
  const articlePages = articles.map((article) => ({
    url: `${baseUrl}/${article.slug}`,
    lastModified: article.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Series pages
  const seriesPages = series.map((show) => ({
    url: `${baseUrl}/serie/${show.tmdbId}-${show.slug}`,
    lastModified: show.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticPages, ...articlePages, ...seriesPages];
}