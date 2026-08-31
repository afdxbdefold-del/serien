import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminRequest } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

/**
 * Cleanup API for YouTube videos
 * 
 * POST /api/admin/cleanup-videos
 * Body: { "confirm": "DELETE_UNPROCESSED_VIDEOS" }
 * 
 * Deletes all unprocessed YouTube videos to reset the /neue-videos page
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.confirm !== 'DELETE_UNPROCESSED_VIDEOS') {
    return NextResponse.json(
      { error: 'Explicit confirmation required' },
      { status: 400 },
    );
  }

  try {
    const deletedVideos = await prisma.youtube_videos.deleteMany({
      where: { processed: false },
    });
    
    return NextResponse.json({
      success: true,
      message: `Alle ${deletedVideos.count} YouTube-Videos wurden gelöscht`,
      deletedVideos: deletedVideos.count,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Cleanup failed'
    }, { status: 500 });
  }
}
