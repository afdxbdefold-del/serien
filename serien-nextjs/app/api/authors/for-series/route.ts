/**
 * GET /api/authors/for-series?q=<series name>
 *
 * Finds which author(s) have written the most about a given TV series.
 * Used on /autoren to let readers discover the expert for their favorite show.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthorUrl } from '@/lib/author-utils';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

type AuthorHit = {
  name: string;
  image: string | null;
  url: string;
  articleCount: number;
  recentArticles: { title: string; slug: string; publishedAt: string | null }[];
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  if (q.length < 2 || q.length > 80) {
    return NextResponse.json({ results: [] });
  }

  // Match series by title prefix OR substring
  const matchingSeries = await prisma.series.findMany({
    where: { title: { contains: q, mode: 'insensitive' } },
    select: { tmdbId: true, title: true, slug: true },
    take: 5,
    orderBy: { title: 'asc' },
  });

  if (matchingSeries.length === 0) {
    return NextResponse.json({ results: [], series: [] });
  }

  const tmdbIds = matchingSeries.map((s) => s.tmdbId);

  // Find articles for any of those series — either primarySeriesId or article_series join
  const articles = await prisma.articles.findMany({
    where: {
      status: 'published',
      OR: [
        { primarySeriesId: { in: tmdbIds } },
        { article_series: { some: { seriesId: { in: tmdbIds } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
      authorId: true,
      users: { select: { name: true, image: true, fullBio: true, role: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: 300,
  });

  // Aggregate by author
  const byAuthor = new Map<string, AuthorHit & { role: string | null; hasFullBio: boolean }>();
  for (const a of articles) {
    if (!a.users?.name) continue;
    const key = a.users.name;
    const entry = byAuthor.get(key) || {
      name: a.users.name,
      image: a.users.image || null,
      url: getAuthorUrl(a.users.name),
      articleCount: 0,
      recentArticles: [],
      role: a.users.role || null,
      hasFullBio: !!a.users.fullBio,
    };
    entry.articleCount++;
    if (entry.recentArticles.length < 3) {
      entry.recentArticles.push({
        title: a.title,
        slug: a.slug,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      });
    }
    byAuthor.set(key, entry);
  }

  // Prefer role=author with fullBio, then by article count
  const results = Array.from(byAuthor.values())
    .sort((a, b) => {
      const scoreA = (a.role === 'author' && a.hasFullBio ? 0 : 1);
      const scoreB = (b.role === 'author' && b.hasFullBio ? 0 : 1);
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.articleCount - a.articleCount;
    })
    .slice(0, 3)
    .map(({ role, hasFullBio, ...rest }) => rest);

  return NextResponse.json({
    query: q,
    series: matchingSeries.map((s) => ({ title: s.title, slug: s.slug })),
    results,
    totalArticles: articles.length,
  });
}
