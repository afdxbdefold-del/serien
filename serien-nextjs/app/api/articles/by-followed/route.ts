import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { tmdbIds } = await request.json();

    if (!tmdbIds || !Array.isArray(tmdbIds) || tmdbIds.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    // Get articles for the followed series
    const articles = await prisma.article.findMany({
      where: {
        status: 'published',
        primarySeriesId: {
          in: tmdbIds,
        },
      },
      orderBy: {
        publishedAt: 'desc',
      },
      take: 50,
      select: {
        id: true,
        title: true,
        excerpt: true,
        slug: true,
        heroLocalUrl: true,
        cardImageUrl: true,
        publishedAt: true,
        category: true,
        tmdbId: true,
        tmdbType: true,
        primarySeriesId: true,
        primarySeries: {
          select: {
            tmdbId: true,
            name: true,
            title: true,
            posterLocalUrl: true,
            networks: true,
          },
        },
        author: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ articles });
  } catch (error) {
    console.error('Error fetching articles by followed series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}
