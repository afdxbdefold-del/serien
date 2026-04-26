/**
 * Compatibility shim — schema definitions consolidated into `schema-generator.ts`.
 *
 * Old imports (`@/lib/schema`) keep working; the canonical source of truth is
 * `lib/schema-generator.ts`. Both `generateOrganizationSchema` and
 * `generateWebsiteSchema` (note the lower-case 's') are re-exported with the
 * names used historically.
 */

import {
  generateOrganizationSchema as orgSchema,
  generateWebSiteSchema,
  generateBreadcrumbSchema as breadcrumbSchema,
  ORG_ID,
} from './schema-generator';

const CANONICAL_SITE_URL = 'https://serien.de';

export const generateOrganizationSchema = orgSchema;
export const generateWebsiteSchema = generateWebSiteSchema; // legacy name
export const generateBreadcrumbSchema = breadcrumbSchema;

/**
 * Legacy article-schema entrypoint — minimal wrapper around the canonical
 * generator. Keeps the old caller-shape working but uses the central
 * publisher entity via @id reference.
 */
export function generateArticleSchema(article: {
  title: string;
  excerpt: string;
  publishedAt: Date;
  updatedAt: Date;
  slug: string;
  heroLocalUrl?: string;
  author: { name: string };
}) {
  const baseUrl = CANONICAL_SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: article.heroLocalUrl || `${baseUrl}/og-image.png`,
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    inLanguage: 'de-DE',
    isAccessibleForFree: true,
    author: {
      '@type': 'Person',
      name: article.author.name,
    },
    publisher: { '@id': ORG_ID },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/${article.slug}`,
    },
  };
}

export function generateTVSeriesSchema(series: {
  title: string;
  overview?: string;
  posterLocalUrl?: string;
  firstAirDate?: Date;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  voteAverage?: number;
  genres?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: series.title,
    description: series.overview,
    image: series.posterLocalUrl,
    datePublished: series.firstAirDate?.toISOString(),
    numberOfSeasons: series.numberOfSeasons,
    numberOfEpisodes: series.numberOfEpisodes,
    aggregateRating: series.voteAverage
      ? {
          '@type': 'AggregateRating',
          ratingValue: series.voteAverage,
          bestRating: 10,
        }
      : undefined,
    genre: series.genres,
  };
}
