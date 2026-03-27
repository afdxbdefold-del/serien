import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verify admin token
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  
  const token = authHeader.substring(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// GET: List all series in local database
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
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
