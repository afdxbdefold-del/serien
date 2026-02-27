import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // Get user's followed series
    const follows = await prisma.follow.findMany({
      where: { userId: user.id },
      select: { tmdbSeriesId: true },
    });

    const followedSeriesIds = follows.map(f => f.tmdbSeriesId);

    if (followedSeriesIds.length === 0) {
      return NextResponse.json([]);
    }

    // Get articles for followed series
    const articles = await prisma.articles.findMany({
      where: {
        status: 'published',
        primarySeriesId: {
          in: followedSeriesIds,
        },
      },
      include: {
        author: {
          select: {
            name: true,
            id: true,
          },
        },
        primarySeries: {
          select: {
            title: true,
            slug: true,
            tmdbId: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: 50,
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Failed to fetch my feed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}
