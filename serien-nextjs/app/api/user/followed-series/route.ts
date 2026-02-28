import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    // Get followed series
    const follows = await prisma.follows.findMany({
      where: { userId: user.id },
      include: {
        series: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const series = follows.map(f => f.series);

    return NextResponse.json(series);
  } catch (error) {
    console.error('Get followed series error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Laden der gefolgten Serien' },
      { status: 500 }
    );
  }
}