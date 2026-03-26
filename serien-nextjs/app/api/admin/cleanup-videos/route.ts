import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cleanup API for YouTube videos
 * 
 * GET /api/admin/cleanup-videos?secret=CRON_SECRET
 * 
 * Deletes all unprocessed YouTube videos to reset the /neue-videos page
 */
export async function GET(request: NextRequest) {
  // Verify secret
  const secret = request.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Delete all videos (full reset)
    const deletedVideos = await prisma.youtube_videos.deleteMany({});
    
    return NextResponse.json({
      success: true,
      message: `Alle ${deletedVideos.count} YouTube-Videos wurden gelöscht`,
      deletedVideos: deletedVideos.count,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({
      error: error.message || 'Cleanup failed'
    }, { status: 500 });
  }
}
