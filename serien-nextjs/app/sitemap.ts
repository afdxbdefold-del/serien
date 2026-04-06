import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 3600; // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://serien.de';

  const [articles, series, indexedPersons, characters] = await Promise.all([
    prisma.articles.findMany({
      where: { status: 'published' },
      select: { slug: true, updatedAt: true },
    }),
    prisma.series.findMany({
      select: { tmdbId: true, slug: true, updatedAt: true },
    }),
    // Only index persons with substantial bio (Tiered Indexing)
    prisma.persons.findMany({
      where: { biography: { not: null } },
      select: { slug: true, updatedAt: true, biography: true },
    }),
    prisma.characters.findMany({
      where: { publishStatus: 'published' },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const seriesSlugs = new Set(series.map(s => s.slug));

  // Filter persons: only those with bio > 100 chars (matching noindex logic)
  const indexablePersons = indexedPersons.filter(
    p => p.biography && p.biography.length > 100
  );

  // Static + Hub pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/trending`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${baseUrl}/personen`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/figuren`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
    { url: `${baseUrl}/autoren`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/redaktionelle-richtlinien`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    { url: `${baseUrl}/nutzungsbedingungen`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/impressum`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${baseUrl}/datenschutz`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Article pages
  const articlePages: MetadataRoute.Sitemap = articles
    .filter(a => !seriesSlugs.has(a.slug))
    .map(a => ({
      url: `${baseUrl}/${a.slug}`,
      lastModified: a.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  // Series pages (exclude broken slugs like "-2661" from non-Latin titles)
  const seriesPages: MetadataRoute.Sitemap = series
    .filter(s => s.slug && !s.slug.startsWith('-'))
    .map(s => ({
      url: `${baseUrl}/serie/${s.slug}`,
      lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }));

  // Person pages (only indexable ones with bio > 100 chars)
  const personPages: MetadataRoute.Sitemap = indexablePersons.map(p => ({
    url: `${baseUrl}/person/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  // Character pages
  const characterPages: MetadataRoute.Sitemap = characters.map(c => ({
    url: `${baseUrl}/figur/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticPages, ...articlePages, ...seriesPages, ...personPages, ...characterPages];
}
