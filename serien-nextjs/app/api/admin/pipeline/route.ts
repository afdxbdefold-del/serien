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

// GET: Pipeline dashboard data
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get recent articles from all pipelines
    const recentArticles = await prisma.articles.findMany({
      where: {
        createdAt: { gte: oneDayAgo },
        OR: [
          { id: { startsWith: 'trend-' } },
          { id: { startsWith: 'yt-' } },
          { category: 'neue-videos' },
          { contentType: { in: ['GENERATED', 'NEWS'] } }
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        createdAt: true,
        sourceUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Get YouTube stats
    const ytStats = {
      totalChannels: await prisma.youtube_channels.count(),
      activeChannels: await prisma.youtube_channels.count({ where: { isActive: true } }),
      totalVideos: await prisma.youtube_videos.count(),
      unprocessedVideos: await prisma.youtube_videos.count({ where: { processed: false } }),
      processedVideos: await prisma.youtube_videos.count({ where: { processed: true } }),
    };

    // Get Trends stats
    const trendStats = {
      totalTrends: await prisma.trending_topics.count(),
      recentTrends: await prisma.trending_topics.count({
        where: { date: { gte: sevenDaysAgo } }
      }),
      processedTrends: await prisma.trending_topics.count({
        where: { processed: true, date: { gte: sevenDaysAgo } }
      }),
    };

    // Get YouTube channels
    const channels = await prisma.youtube_channels.findMany({
      select: {
        id: true,
        channelId: true,
        name: true,
        url: true,
        isActive: true,
        lastCheckedAt: true,
        _count: { select: { videos: true } }
      },
      orderBy: { name: 'asc' }
    });

    // Get unprocessed videos
    const unprocessedVideos = await prisma.youtube_videos.findMany({
      where: { processed: false },
      select: {
        id: true,
        videoId: true,
        title: true,
        publishedAt: true,
        channel: { select: { name: true } }
      },
      orderBy: { publishedAt: 'desc' },
      take: 10
    });

    // Article stats by source
    const articleStats = {
      ytArticles: await prisma.articles.count({
        where: { id: { startsWith: 'yt-' }, createdAt: { gte: sevenDaysAgo } }
      }),
      trendArticles: await prisma.articles.count({
        where: { id: { startsWith: 'trend-' }, createdAt: { gte: sevenDaysAgo } }
      }),
      totalLast7Days: await prisma.articles.count({
        where: { createdAt: { gte: sevenDaysAgo } }
      }),
    };

    return NextResponse.json({
      recentArticles,
      ytStats,
      trendStats,
      channels,
      unprocessedVideos,
      articleStats,
      lastUpdate: now.toISOString()
    });

  } catch (error) {
    console.error('Pipeline API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Run pipeline actions
export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, videoId, searchTerm } = body;

    // Run P4-YT: Check for new videos
    if (action === 'yt-check') {
      const { checkForNewVideos } = await import('@/scripts/p4-yt');
      const newVideos = await checkForNewVideos();
      return NextResponse.json({ 
        success: true, 
        message: `${newVideos.length} neue Videos gefunden`,
        count: newVideos.length
      });
    }

    // Run P4-YT: Process single video
    if (action === 'yt-process-video') {
      if (!videoId) {
        return NextResponse.json({ error: 'videoId required' }, { status: 400 });
      }
      
      const video = await prisma.youtube_videos.findUnique({
        where: { videoId },
        include: { channel: true }
      });
      
      if (!video) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }
      
      const { generateArticleFromVideo } = await import('@/scripts/p4-yt');
      const result = await generateArticleFromVideo({
        videoId: video.videoId,
        title: video.title,
        description: video.description || '',
        thumbnailUrl: video.thumbnailUrl || '',
        publishedAt: video.publishedAt,
        channelId: video.channelId,
        channelName: video.channel.name,
      });
      
      return NextResponse.json({ 
        success: result.success, 
        message: result.success ? `Artikel erstellt: ${result.title}` : result.error,
        result
      });
    }

    // Run P4-YT: Process next unprocessed videos
    if (action === 'yt-process-batch') {
      const { processUnprocessedVideos } = await import('@/scripts/p4-yt');
      const results = await processUnprocessedVideos(3);
      const successCount = results.filter(r => r.success).length;
      
      return NextResponse.json({ 
        success: true, 
        message: `${successCount}/${results.length} Artikel erstellt`,
        results
      });
    }

    // Run P3-Trends: Process single trend
    if (action === 'trends-process') {
      if (!searchTerm) {
        return NextResponse.json({ error: 'searchTerm required' }, { status: 400 });
      }
      
      const { runP3TrendsPipeline } = await import('@/scripts/p3-trends');
      const result = await runP3TrendsPipeline(`manual-${Date.now()}`, searchTerm);
      
      return NextResponse.json({ 
        success: result.success, 
        message: result.success ? `Artikel erstellt: ${result.title}` : result.error,
        result
      });
    }

    // Toggle YouTube channel active status
    if (action === 'toggle-channel') {
      const { channelId, isActive } = body;
      if (!channelId) {
        return NextResponse.json({ error: 'channelId required' }, { status: 400 });
      }
      
      await prisma.youtube_channels.update({
        where: { channelId },
        data: { isActive }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Kanal ${isActive ? 'aktiviert' : 'deaktiviert'}`
      });
    }

    // Delete video
    if (action === 'delete-video') {
      if (!videoId) {
        return NextResponse.json({ error: 'videoId required' }, { status: 400 });
      }
      
      await prisma.youtube_videos.delete({
        where: { videoId }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Video gelöscht'
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Pipeline POST error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
