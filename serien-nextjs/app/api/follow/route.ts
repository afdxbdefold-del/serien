import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const { seriesId } = await request.json();

    if (!seriesId) {
      return NextResponse.json(
        { detail: 'Series ID ist erforderlich' },
        { status: 400 }
      );
    }

    // Check if already following
    const existing = await prisma.follows.findUnique({
      where: {
        userId_tmdbSeriesId: {
          userId: user.id,
          tmdbSeriesId: seriesId
        }
      }
    });

    if (existing) {
      return NextResponse.json(
        { detail: 'Sie folgen dieser Serie bereits' },
        { status: 400 }
      );
    }

    // Create follow
    await prisma.follows.create({
      data: {
        userId: user.id,
        tmdbSeriesId: seriesId
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Follow error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Folgen der Serie' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { detail: 'Nicht authentifiziert' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const seriesId = parseInt(searchParams.get('seriesId') || '');

    if (!seriesId) {
      return NextResponse.json(
        { detail: 'Series ID ist erforderlich' },
        { status: 400 }
      );
    }

    // Delete follow
    await prisma.follows.delete({
      where: {
        userId_tmdbSeriesId: {
          userId: user.id,
          tmdbSeriesId: seriesId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unfollow error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Entfolgen der Serie' },
      { status: 500 }
    );
  }
}