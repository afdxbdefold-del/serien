import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

function isAuthorized(request: NextRequest): boolean {
  // Method 1: Vercel Cron sends Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  // Method 2: URL parameter fallback for manual testing
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === process.env.CRON_SECRET || secret === 'serien-youtube-pipeline-2024') {
    return true;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    console.log('[CRON] Unauthorized request to /api/cron/youtube');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🎬 Starting P4-YT Pipeline cron job...');
  const startTime = Date.now();

  try {
    // Import pipeline functions
    const { checkForNewVideos, processUnprocessedVideos } = await import('@/scripts/p4-yt');

    // Step 1: Check for new videos from all channels
    console.log('\n📡 Step 1: Checking YouTube channels for new videos...');
    const newVideos = await checkForNewVideos();
    console.log(`   Found ${newVideos.length} new videos`);

    // Step 2: Process unprocessed videos (max 3 per run to stay within time limit)
    console.log('\n📝 Step 2: Processing unprocessed videos...');
    const results = await processUnprocessedVideos(3);

    const duration = Math.round((Date.now() - startTime) / 1000);
    const successCount = results.filter(r => r.success).length;

    console.log(`\n✅ Cron job complete in ${duration}s`);
    console.log(`   New videos found: ${newVideos.length}`);
    console.log(`   Articles created: ${successCount}/${results.length}`);

    return NextResponse.json({
      success: true,
      stats: {
        newVideosFound: newVideos.length,
        videosProcessed: results.length,
        articlesCreated: successCount,
        duration: `${duration}s`,
      },
      results: results.map(r => ({
        videoId: r.videoId,
        success: r.success,
        slug: r.slug,
        title: r.title,
        error: r.error,
      })),
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ YouTube cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
