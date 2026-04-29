/**
 * GET /api/news/list?cursor=ISO&filter=netflix
 *
 * Returns the next PAGE_SIZE published articles older than `cursor`,
 * filtered by /news sub-route slug. Used by the "Mehr laden" client island.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchNewsArticles } from '@/app/news/_data';
import { PAGE_SIZE } from '@/app/news/_lib';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const filter = searchParams.get('filter');

  const cursorDate = cursor ? new Date(cursor) : null;
  if (cursor && (!cursorDate || isNaN(cursorDate.getTime()))) {
    return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 });
  }

  const articles = await fetchNewsArticles({
    filterSlug: filter || null,
    cursorPublishedAt: cursorDate,
    limit: PAGE_SIZE,
  });

  const nextCursor =
    articles.length === PAGE_SIZE && articles[articles.length - 1].publishedAt
      ? new Date(articles[articles.length - 1].publishedAt as Date).toISOString()
      : null;

  return NextResponse.json({
    items: articles.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      heroImageUrl: a.heroImageUrl,
      cardImageUrl: a.cardImageUrl,
      publishedAt: a.publishedAt,
      seriesName: a.series?.name || null,
      seriesPosterPath: a.series?.posterPath || null,
      seriesBackdropPath: a.series?.backdropPath || null,
    })),
    nextCursor,
  });
}
