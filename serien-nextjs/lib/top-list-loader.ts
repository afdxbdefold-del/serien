/**
 * TOP LIST LOADER — shared ranking logic for Pillar Pages.
 *
 * Used by:
 *   /top-100-serien          — all series
 *   /top-100-netflix         — filtered by Netflix network
 *   /top-100-amazon-prime    — Prime Video
 *   /top-100-disney-plus     — Disney+
 *   (future) /top-100-crime, /top-100-comedy — genre variants
 *
 * Ranking-Algorithmus (Hybrid-Score):
 *   pageviews_14d  × 0.60
 *   popularity     × 0.30
 *   recent_articles× 0.10
 */

import prisma from '@/lib/prisma';

export interface RankedSeries {
  rank: number;
  tmdbId: number;
  slug: string;
  title: string;
  overview: string | null;
  posterPath: string | null;
  posterLocalUrl: string | null;
  genres: string[];
  networks: string[];
  voteAverage: number | null;
  firstAirDate: Date | null;
  views14d: number;
  articles30d: number;
  popularity: number;
  hybridScore: number;
  platformTag: string;
}

export interface LoadTopListOpts {
  limit?: number;                 // default 100
  networkFilter?: string[];       // e.g. ['Netflix'] — series must include at least one
  genreFilter?: string[];         // e.g. ['Crime', 'Drama']
  minPopularity?: number;         // default 5
}

export function primaryPlatform(networks: string[]): string {
  const priority = ['Netflix', 'Amazon Prime Video', 'Prime Video', 'Apple TV+', 'Disney+', 'Disney Plus', 'Hulu', 'HBO', 'Max', 'HBO Max', 'Paramount+', 'Peacock', 'ARD', 'ZDF', 'Sky'];
  for (const p of priority) if (networks.some((n) => n.toLowerCase() === p.toLowerCase())) return p;
  return networks[0] || 'TV';
}

function matchesNetwork(networks: string[], filter: string[]): boolean {
  if (filter.length === 0) return true;
  const lower = networks.map((n) => n.toLowerCase());
  return filter.some((f) => lower.includes(f.toLowerCase()));
}

function matchesGenre(genres: string[], filter: string[]): boolean {
  if (filter.length === 0) return true;
  const lower = genres.map((g) => g.toLowerCase());
  return filter.some((f) => lower.includes(f.toLowerCase()));
}

export async function loadTopList(opts: LoadTopListOpts = {}): Promise<RankedSeries[]> {
  const limit          = opts.limit ?? 100;
  const networkFilter  = opts.networkFilter ?? [];
  const genreFilter    = opts.genreFilter ?? [];
  const minPopularity  = opts.minPopularity ?? 5;

  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000);
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000);

  // 1) Candidate pool — widen the pool when filters are active so we have
  //    enough candidates AFTER the in-memory network/genre filter.
  const hasFilter = networkFilter.length > 0 || genreFilter.length > 0;
  const poolPopularity = hasFilter ? 1 : minPopularity;

  const candidates = await prisma.series.findMany({
    where: {
      OR: [
        { popularity: { gte: poolPopularity } },
        { article_series: { some: { articles: { publishedAt: { gte: since30d }, status: 'published' } } } },
      ],
    },
    select: {
      tmdbId: true, slug: true, title: true, name: true, overview: true,
      posterPath: true, posterLocalUrl: true, genres: true, networks: true,
      popularity: true, voteAverage: true, firstAirDate: true,
      article_series: {
        where: { articles: { publishedAt: { gte: since30d }, status: 'published' } },
        select: { articleId: true },
      },
    },
  });

  // 2) Apply network/genre filters in-memory (networks is String[], no
  //    efficient Prisma `hasSome` case-insensitive filter for mixed-case data)
  const filtered = candidates.filter(
    (s) =>
      matchesNetwork(s.networks || [], networkFilter) &&
      matchesGenre(s.genres || [], genreFilter),
  );

  if (filtered.length === 0) return [];

  // 3) Pageviews per series — join via article_series → analytics_events
  const tmdbIds = filtered.map((s) => s.tmdbId);
  const articleIds = await prisma.article_series.findMany({
    where: { seriesId: { in: tmdbIds } },
    select: { articleId: true, seriesId: true },
  });

  const articleToSeries = new Map<string, number[]>();
  for (const r of articleIds) {
    if (!articleToSeries.has(r.articleId)) articleToSeries.set(r.articleId, []);
    articleToSeries.get(r.articleId)!.push(r.seriesId);
  }

  const views = articleIds.length
    ? await prisma.analytics_events.groupBy({
        by: ['articleId'],
        where: {
          articleId: { in: articleIds.map((a) => a.articleId) },
          event: 'pageview',
          createdAt: { gte: since14d },
        },
        _count: { _all: true },
      })
    : [];

  const seriesViews = new Map<number, number>();
  for (const v of views) {
    const seriesIds = articleToSeries.get(v.articleId || '') || [];
    const share = seriesIds.length > 0 ? v._count._all / seriesIds.length : 0;
    for (const sid of seriesIds) seriesViews.set(sid, (seriesViews.get(sid) || 0) + share);
  }

  // 4) Hybrid score
  const maxViews      = Math.max(1, ...Array.from(seriesViews.values()));
  const maxPopularity = Math.max(1, ...filtered.map((s) => s.popularity || 0));
  const maxArticles   = Math.max(1, ...filtered.map((s) => s.article_series.length));

  const scored = filtered.map((s) => {
    const v = seriesViews.get(s.tmdbId) || 0;
    const p = s.popularity || 0;
    const a = s.article_series.length;
    const hybrid =
      (v / maxViews) * 60 +
      (p / maxPopularity) * 30 +
      (a / maxArticles) * 10;
    return {
      tmdbId: s.tmdbId,
      slug: s.slug,
      title: s.title || s.name || 'Unbekannt',
      overview: s.overview,
      posterPath: s.posterPath,
      posterLocalUrl: s.posterLocalUrl,
      genres: (s.genres || []).slice(0, 3),
      networks: s.networks || [],
      voteAverage: s.voteAverage,
      firstAirDate: s.firstAirDate,
      views14d: Math.round(v),
      articles30d: a,
      popularity: p,
      hybridScore: Number(hybrid.toFixed(2)),
      platformTag: primaryPlatform(s.networks || []),
    };
  });

  scored.sort((a, b) => b.hybridScore - a.hybridScore);
  return scored.slice(0, limit).map((s, i) => ({ ...s, rank: i + 1 }));
}
