import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cron schedules (UTC times)
const CRON_SCHEDULES = {
  'p3-trends': { schedule: '0 9,13,18,22 * * *', name: 'P3-Trends', hours: [9, 13, 18, 22] },
  'p4-youtube': { schedule: '0 8,11,14,17,20,23 * * *', name: 'P4-YouTube', hours: [8, 11, 14, 17, 20, 23] },
  'cron-news': { schedule: '0 */2 * * *', name: 'News Import', hours: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] },
  'cron-releases': { schedule: '0 6 * * *', name: 'Releases', hours: [6] },
};

function getNextCronRun(hours: number[]): Date {
  const now = new Date();
  const currentHour = now.getUTCHours();
  
  // Find next scheduled hour
  let nextHour = hours.find(h => h > currentHour);
  
  if (nextHour === undefined) {
    // Next run is tomorrow at first scheduled hour
    nextHour = hours[0];
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(nextHour, 0, 0, 0);
    return tomorrow;
  }
  
  const nextRun = new Date(now);
  nextRun.setUTCHours(nextHour, 0, 0, 0);
  return nextRun;
}

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
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Get pipeline runs directly from prisma
    let pipelineRuns: any[] = [];
    let pipelineStats: Record<string, any> = {};
    
    try {
      pipelineRuns = await prisma.pipeline_runs.findMany({
        where: { startedAt: { gte: since } },
        orderBy: { startedAt: 'desc' },
        take: 100
      });
      
      // Calculate stats
      const statsByPipeline: Record<string, any> = {};
      for (const run of pipelineRuns) {
        if (!statsByPipeline[run.pipeline]) {
          statsByPipeline[run.pipeline] = {
            total: 0, success: 0, partial: 0, failed: 0, articles: 0, durations: []
          };
        }
        const s = statsByPipeline[run.pipeline];
        s.total++;
        if (run.status === 'success') s.success++;
        else if (run.status === 'partial') s.partial++;
        else if (run.status === 'failed') s.failed++;
        if (run.articleId) s.articles++;
        if (run.durationMs) s.durations.push(run.durationMs);
      }
      
      for (const [pipeline, stats] of Object.entries(statsByPipeline)) {
        const s = stats as any;
        pipelineStats[pipeline] = {
          ...s,
          avgDuration: s.durations.length > 0 
            ? Math.round(s.durations.reduce((a: number, b: number) => a + b, 0) / s.durations.length)
            : 0
        };
        delete pipelineStats[pipeline].durations;
      }
    } catch (e) {
      console.error('Failed to fetch pipeline runs:', e);
    }

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

    // Error analysis - group most common errors
    const pipelineRunsArray = Array.isArray(pipelineRuns) ? pipelineRuns : [];
    const failedRuns = pipelineRunsArray.filter((r: any) => r.status === 'failed' && r.errorMessage);
    const errorGroups: Record<string, { count: number; lastSeen: string; step?: string }> = {};
    
    for (const run of failedRuns) {
      // Normalize error message (remove IDs, timestamps, etc.)
      let errorKey = (run.errorMessage || 'Unknown')
        .replace(/\d{10,}/g, '[ID]')
        .replace(/https?:\/\/[^\s]+/g, '[URL]')
        .substring(0, 100);
      
      if (!errorGroups[errorKey]) {
        errorGroups[errorKey] = { count: 0, lastSeen: run.startedAt, step: run.errorStep || undefined };
      }
      errorGroups[errorKey].count++;
      if (new Date(run.startedAt) > new Date(errorGroups[errorKey].lastSeen)) {
        errorGroups[errorKey].lastSeen = run.startedAt;
      }
    }
    
    const topErrors = Object.entries(errorGroups)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([message, data]) => ({ message, ...data }));

    // Daily success/failure chart data (last 7 days)
    const chartData: { date: string; success: number; failed: number; partial: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);
      
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayRuns = pipelineRunsArray.filter((r: any) => {
        const runDate = new Date(r.startedAt);
        return runDate >= dayStart && runDate <= dayEnd;
      });
      
      chartData.push({
        date: dayStart.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' }),
        success: dayRuns.filter((r: any) => r.status === 'success').length,
        failed: dayRuns.filter((r: any) => r.status === 'failed').length,
        partial: dayRuns.filter((r: any) => r.status === 'partial').length,
      });
    }

    // Cron status - next runs and last run status
    const cronStatus: Record<string, { 
      nextRun: string; 
      lastRun?: string; 
      lastStatus?: string;
      schedule: string;
    }> = {};
    
    for (const [pipeline, config] of Object.entries(CRON_SCHEDULES)) {
      const lastRun = pipelineRunsArray.find((r: any) => r.pipeline === pipeline);
      cronStatus[pipeline] = {
        nextRun: getNextCronRun(config.hours).toISOString(),
        lastRun: lastRun?.startedAt,
        lastStatus: lastRun?.status,
        schedule: config.schedule,
      };
    }

    // Get last 10 created articles with more details
    const lastCreatedArticles = await prisma.articles.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        createdAt: true,
        publishedAt: true,
        status: true,
        heroVideoUrl: true,
        users: { select: { name: true } },
        series: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Check if any pipeline is currently running
    const hasRunningPipeline = pipelineRunsArray.some((r: any) => r.status === 'running');

    return NextResponse.json({
      recentArticles,
      lastCreatedArticles,
      ytStats,
      trendStats,
      channels,
      unprocessedVideos,
      articleStats,
      pipelineRuns: pipelineRunsArray,
      pipelineStats,
      topErrors,
      chartData,
      cronStatus,
      hasRunningPipeline,
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
      const result = await runP3TrendsPipeline(`manual-${Date.now()}`, searchTerm, 'manual');
      
      return NextResponse.json({ 
        success: result.success, 
        message: result.success ? `Artikel erstellt: ${result.title}` : result.error,
        result
      });
    }

    // Run Pipeline-V2 with URL
    if (action === 'v2-process') {
      const { url } = body;
      if (!url) {
        return NextResponse.json({ error: 'url required' }, { status: 400 });
      }
      
      const { runPipelineV2 } = await import('@/scripts/pipeline-v2');
      const result = await runPipelineV2({
        title: 'Extracting...',
        url,
        text: '',
        useFullTextMode: true,
        trigger: 'manual',
      });
      
      return NextResponse.json({ 
        success: !!result, 
        message: result ? `Artikel erstellt: ${result.headline}` : 'Pipeline fehlgeschlagen',
        result
      });
    }

    // Export logs as CSV
    if (action === 'export-csv') {
      const runs = await getRecentPipelineRuns({ hours: 168, limit: 500 }); // Last 7 days
      
      const csvHeader = 'Zeit,Pipeline,Status,Input,Artikel,Quellen,Wörter,Fakten,Anti-AI,Dauer,Fehler\n';
      const csvRows = runs.map(r => [
        new Date(r.startedAt).toISOString(),
        r.pipeline,
        r.status,
        `"${(r.inputQuery || r.inputVideoId || '').replace(/"/g, '""')}"`,
        r.articleSlug || '',
        r.sourcesFound,
        r.wordsCollected,
        r.factsExtracted,
        r.antiAiScore || '',
        r.durationMs || '',
        `"${(r.errorMessage || '').replace(/"/g, '""')}"`,
      ].join(','));
      
      return new NextResponse(csvHeader + csvRows.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=pipeline-logs-${new Date().toISOString().split('T')[0]}.csv`,
        },
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
