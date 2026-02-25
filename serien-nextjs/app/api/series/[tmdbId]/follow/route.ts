import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Temporary mock user until auth is properly configured
const MOCK_USER_ID = 'author_001'; // Sophie Hartmann

// GET /api/series/[tmdbId]/follow - Check if user follows series
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tmdbId: string }> }
) {
  try {
    const { tmdbId } = await params;
    
    // Use mock user for now
    const userId = MOCK_USER_ID;

    const follow = await prisma.follow.findUnique({
      where: {
        userId_tmdbSeriesId: {
          userId,
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
    const { tmdbId } = await params;
    
    // Use mock user for now
    const userId = MOCK_USER_ID;
    const seriesId = parseInt(tmdbId);

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        userId_tmdbSeriesId: {
          userId,
          tmdbSeriesId: seriesId
        }
      }
    });

    if (existing) {
      // Unfollow
      await prisma.follow.delete({
        where: {
          userId_tmdbSeriesId: {
            userId,
            tmdbSeriesId: seriesId
          }
        }
      });
      return NextResponse.json({ following: false, message: 'Unfollowed' });
    } else {
      // Follow
      await prisma.follow.create({
        data: {
          userId,
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
