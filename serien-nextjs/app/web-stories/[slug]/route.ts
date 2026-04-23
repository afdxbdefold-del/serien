import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { renderWebStory } from '@/lib/web-story-generator';

export const dynamic = 'force-dynamic';
export const revalidate = 600; // 10 min ISR

/**
 * Google Web Story endpoint: /web-stories/[slug]
 *
 * Returns fully-rendered AMP HTML (text/html). Canonical points to the regular
 * article page so Google can co-rank them without duplicate-content penalties.
 *
 * Stories are exposed to Discover via:
 *   1. Inclusion in the root sitemap (app/sitemap.ts)
 *   2. <link rel="amphtml" href="…"> in the article's <head>
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const article = await prisma.articles.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      heroImageUrl: true,
      heroLocalUrl: true,
      wasBedeutetDasText: true,
      darumRelevantText: true,
      bisherigerStandText: true,
      publishedAt: true,
      updatedAt: true,
      status: true,
      category: true,
      series: { select: { name: true, title: true } },
      users: { select: { name: true } },
    },
  });

  if (!article || article.status !== 'published') {
    return new NextResponse('Not found', { status: 404 });
  }

  const html = renderWebStory({
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    heroImageUrl: article.heroImageUrl,
    heroLocalUrl: article.heroLocalUrl,
    wasBedeutetDasText: article.wasBedeutetDasText,
    darumRelevantText: article.darumRelevantText,
    bisherigerStandText: article.bisherigerStandText,
    seriesName: article.series?.name || article.series?.title || null,
    category: article.category,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.users?.name || null,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cache 10 min at the edge, allow stale for 1 hour while revalidating
      'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600',
    },
  });
}
