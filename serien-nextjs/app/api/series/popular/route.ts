import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');

    const series = await prisma.series.findMany({
      take: limit,
      orderBy: {
        popularity: 'desc',
      },
      select: {
        tmdbId: true,
        name: true,
        posterPath: true,
        posterLocalUrl: true,
      },
    });

    return NextResponse.json(series);
  } catch (error) {
    console.error('Failed to fetch popular series:', error);
    return NextResponse.json(
      { error: 'Failed to fetch series' },
      { status: 500 }
    );
  }
}
