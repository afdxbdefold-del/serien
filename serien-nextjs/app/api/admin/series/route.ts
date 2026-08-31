import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

// GET: List all series in local database
export async function GET(request: NextRequest) {
  if (!await verifyAdminRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '100');

    const series = await prisma.series.findMany({
      where: search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } },
        ]
      } : undefined,
      select: {
        tmdbId: true,
        name: true,
        slug: true,
        posterPath: true,
        status: true,
        firstAirDate: true,
      },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return NextResponse.json({ 
      series,
      total: series.length 
    });

  } catch (error: any) {
    console.error('Error fetching series:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
