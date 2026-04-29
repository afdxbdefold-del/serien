/**
 * Article fetcher used by /news, /news/[filter], homepage block + article footer.
 * Centralises the SELECT shape + WHERE clauses so all callers stay in sync.
 */
import prisma from '@/lib/prisma';
import { STREAMERS, KINDS, classifyFilter, PAGE_SIZE } from './_lib';

export const NEWS_ARTICLE_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  heroImageUrl: true,
  cardImageUrl: true,
  publishedAt: true,
  category: true,
  primarySeriesId: true,
  series: {
    select: {
      slug: true,
      name: true,
      posterPath: true,
      backdropPath: true,
      networks: true,
    },
  },
} as const;

export type NewsArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  cardImageUrl: string | null;
  publishedAt: Date | null;
  category: string | null;
  primarySeriesId: number | null;
  series: {
    slug: string;
    name: string;
    posterPath: string | null;
    backdropPath: string | null;
    networks: string[];
  } | null;
};

interface FetchOpts {
  filterSlug?: string | null;       // /news/[filter] segment
  excludeIds?: string[];            // skip these (e.g. on article footer "Mehr News")
  excludePrimarySeriesId?: number | null;
  cursorPublishedAt?: Date | null;  // for "Mehr laden"
  limit?: number;
}

export async function fetchNewsArticles(opts: FetchOpts = {}): Promise<NewsArticle[]> {
  const limit = opts.limit ?? PAGE_SIZE;
  const where: Record<string, unknown> = {
    status: { in: ['published', 'PUBLISHED'] },
    publishedAt: { not: null },
    // Exclude articles flagged as "neue-videos" — that pipeline is deprecated.
    // NOTE: `NOT: { category: 'neue-videos' }` alone also filters out rows where
    // category IS NULL (SQL NULL != 'x' → UNKNOWN). Most of our articles have
    // category = null, so we need an explicit OR to include them.
    OR: [
      { category: null },
      { category: { not: 'neue-videos' } },
    ],
  };

  if (opts.excludeIds && opts.excludeIds.length > 0) {
    where.id = { notIn: opts.excludeIds };
  }
  if (opts.excludePrimarySeriesId != null) {
    where.primarySeriesId = { not: opts.excludePrimarySeriesId };
  }
  if (opts.cursorPublishedAt) {
    where.publishedAt = { lt: opts.cursorPublishedAt };
  }

  // /news/[filter] handling
  if (opts.filterSlug) {
    const cls = classifyFilter(opts.filterSlug);
    if (!cls) return [];

    if (cls.kind === 'streamer') {
      // Match against the linked series.networks array (case-insensitive substring).
      // We OR the candidate strings.
      where.series = {
        OR: cls.entry.networkMatches.flatMap((m) => [
          { networks: { has: m } },
          { networks: { has: m.charAt(0).toUpperCase() + m.slice(1) } },
        ]),
      };
    } else if (cls.kind === 'kind') {
      // Title regex applied at fetch time.
      // Prisma supports `mode: 'insensitive'` for `contains`, but no native regex on PG without raw SQL.
      // We over-fetch + post-filter to keep it simple and safe.
      const overFetch = limit * 8;
      const all = await prisma.articles.findMany({
        where,
        select: NEWS_ARTICLE_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: overFetch,
      });
      const filtered = all.filter((a) => cls.entry.titleRegex.test(a.title)).slice(0, limit);
      return filtered as NewsArticle[];
    } else if (cls.kind === 'month') {
      const start = new Date(Date.UTC(cls.year, cls.month - 1, 1, 0, 0, 0));
      const end = new Date(Date.UTC(cls.year, cls.month, 1, 0, 0, 0));
      // Combine with cursor logic: cursor wins if both set
      where.publishedAt = opts.cursorPublishedAt
        ? { lt: opts.cursorPublishedAt, gte: start }
        : { gte: start, lt: end };
    }
  }

  const rows = await prisma.articles.findMany({
    where,
    select: NEWS_ARTICLE_SELECT,
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });
  return rows as NewsArticle[];
}

/**
 * Returns the most-likely streamer slug for a given article (used for
 * "Mehr Netflix-News"-style cross-link in the article footer).
 */
export function streamerSlugFor(article: NewsArticle): string | null {
  const nets = article.series?.networks || [];
  if (!nets.length) return null;
  const lower = nets.map((n) => n.toLowerCase());
  for (const s of STREAMERS) {
    if (lower.some((n) => s.networkMatches.some((m) => n.includes(m)))) {
      return s.slug;
    }
  }
  return null;
}

export { STREAMERS, KINDS };
