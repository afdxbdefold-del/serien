import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }

    // Search series by name
    const series = await prisma.series.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            originalName: {
              contains: query,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        tmdbId: true,
        name: true,
        slug: true,
        posterLocalUrl: true,
        posterPath: true,
        firstAirDate: true,
        overview: true,
      },
      take: 10,
      orderBy: {
        popularity: 'desc',
      },
    });

    return NextResponse.json(series);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
