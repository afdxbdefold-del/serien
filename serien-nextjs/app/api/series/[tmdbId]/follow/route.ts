import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

// GET /api/series/[tmdbId]/follow - Check if user follows series
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const session = await getServerSession();
    const { tmdbId } = await params;
    
    if (!session?.user?.email) {
      return NextResponse.json({ following: false });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ following: false });
    }

    const follow = await prisma.follow.findUnique({
      where: {
        userId_tmdbSeriesId: {
          userId: user.id,
          tmdbSeriesId: parseInt(tmdbId)
        }
      }
    });

    return NextResponse.json({ following: !!follow });
  } catch (error) {
    console.error('Failed to check follow status:', error);
    return NextResponse.json({ following: false });
  }
}

// POST /api/series/[tmdbId]/follow - Toggle follow
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const session = await getServerSession();
    const { tmdbId } = await params;
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const seriesId = parseInt(tmdbId);

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        userId_tmdbSeriesId: {
          userId: user.id,
          tmdbSeriesId: seriesId
        }
      }
    });

    if (existing) {
      // Unfollow
      await prisma.follow.delete({
        where: {
          userId_tmdbSeriesId: {
            userId: user.id,
            tmdbSeriesId: seriesId
          }
        }
      });
      return NextResponse.json({ following: false, message: 'Unfollowed' });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          userId: user.id,
          tmdbSeriesId: seriesId
        }
      });
      return NextResponse.json({ following: true, message: 'Followed' });
    }
  } catch (error) {
    console.error('Failed to toggle follow:', error);
    return NextResponse.json({ error: 'Failed to toggle follow' }, { status: 500 });
  }
}
