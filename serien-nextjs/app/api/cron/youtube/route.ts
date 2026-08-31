import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireCronAuth } from '@/lib/cron-auth';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;

  // Check if this is a manual trigger (bypasses age filter)
  const trigger = request.nextUrl.searchParams.get('trigger') === 'manual' ? 'manual' : 'cron';
  
  console.log(`🎬 Starting P4-YT Pipeline (${trigger})...`);
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
    const results = await processUnprocessedVideos(3, trigger);

    const duration = Math.round((Date.now() - startTime) / 1000);
    const successCount = results.filter(r => r.success).length;

    console.log(`\n✅ Cron job complete in ${duration}s`);
    console.log(`   New videos found: ${newVideos.length}`);
    console.log(`   Articles created: ${successCount}/${results.length}`);

    return NextResponse.json({
      success: true,
      trigger,
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
