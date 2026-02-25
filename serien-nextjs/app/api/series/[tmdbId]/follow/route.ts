import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

// GET /api/series/[tmdbId]/follow - Check if user follows series
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await params;
    
    // Get authenticated user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ following: false, requiresAuth: true });
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
  request: NextRequest,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await params;
    
    // Get authenticated user
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Bitte melden Sie sich an' },
        { status: 401 }
      );
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
