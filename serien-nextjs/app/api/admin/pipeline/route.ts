import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cron schedules (UTC times) - alle 6 Stunden
const CRON_SCHEDULES = {
  'p3-trends': { schedule: '*/15 * * * *', name: 'P3-Trends', intervalMinutes: 15 },
  'p4-youtube': { schedule: '*/15 * * * *', name: 'P4-YouTube', intervalMinutes: 15 },
  'cron-news': { schedule: '*/15 * * * *', name: 'News Import', intervalMinutes: 15 },
  'cron-releases': { schedule: '*/15 * * * *', name: 'Releases', intervalMinutes: 15 },
};

function getNextCronRun(intervalMinutes: number): Date {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  
  // Calculate next run time based on interval
  const nextIntervalMinute = Math.ceil(currentMinutes / intervalMinutes) * intervalMinutes;
  
  const nextRun = new Date(now);
  if (nextIntervalMinute >= 60) {
    // Next hour
    nextRun.setHours(nextRun.getHours() + 1);
    nextRun.setMinutes(nextIntervalMinute - 60, 0, 0);
  } else if (nextIntervalMinute === currentMinutes) {
    // Currently at interval, next is in intervalMinutes
    nextRun.setMinutes(currentMinutes + intervalMinutes, 0, 0);
    if (nextRun.getMinutes() >= 60) {
      nextRun.setHours(nextRun.getHours() + 1);
      nextRun.setMinutes(nextRun.getMinutes() - 60);
    }
  } else {
    nextRun.setMinutes(nextIntervalMinute, 0, 0);
  }
  
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
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // Auto-cleanup: Mark stuck "running" runs as failed (prevents endless loops)
    await prisma.pipeline_runs.updateMany({
      where: {
        status: 'running',
        startedAt: { lt: tenMinutesAgo }
      },
      data: {
        status: 'failed',
        errorMessage: 'Timeout: Automatisch nach 10 Minuten abgebrochen',
        completedAt: now
      }
    });

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
        _count: { select: { youtube_videos: true } }
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
        youtube_channels: { select: { name: true } }
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
      const rawMessage = run.errorMessage || 'Unknown';
      let errorKey = String(rawMessage)
        .replace(/\d{10,}/g, '[ID]')
        .replace(/https?:\/\/[^\s]+/g, '[URL]');
      errorKey = errorKey.length > 100 ? errorKey.substring(0, 100) : errorKey;
      
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
        date: dayStart.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric' }),
        success: dayRuns.filter((r: any) => r.status === 'success').length,
        failed: dayRuns.filter((r: any) => r.status === 'failed').length,
        partial: dayRuns.filter((r: any) => r.status === 'partial').length,
      });
    }

    // Cron status - next runs, last run status, and detailed stats
    const cronStatus: Record<string, { 
      nextRun: string; 
      lastRun?: string; 
      lastStatus?: string;
      schedule: string;
      successCount: number;
      failCount: number;
      avgDuration: number;
      lastError?: string;
      articlesCreated: number;
    }> = {};
    
    // Remove p3-trends from schedules
    const activeSchedules = Object.entries(CRON_SCHEDULES).filter(([key]) => key !== 'p3-trends');
    
    for (const [pipeline, config] of activeSchedules) {
      // Get all runs for this pipeline in the last 7 days
      const pipelineRuns7d = pipelineRunsArray.filter((r: any) => r.pipeline === pipeline);
      const lastRun = pipelineRuns7d[0]; // Most recent
      
      // Count successes and failures
      const successCount = pipelineRuns7d.filter((r: any) => r.status === 'success').length;
      const failCount = pipelineRuns7d.filter((r: any) => r.status === 'failed').length;
      
      // Calculate average duration of successful runs
      const successfulRuns = pipelineRuns7d.filter((r: any) => r.status === 'success' && r.completedAt);
      const avgDuration = successfulRuns.length > 0
        ? successfulRuns.reduce((acc: number, r: any) => {
            const duration = new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime();
            return acc + duration;
          }, 0) / successfulRuns.length
        : 0;
      
      // Get last error message
      const lastFailedRun = pipelineRuns7d.find((r: any) => r.status === 'failed');
      
      // Count articles created by this pipeline
      const articlesCreated = await prisma.articles.count({
        where: {
          id: { startsWith: pipeline === 'p4-youtube' ? 'yt-' : pipeline === 'cron-news' ? 'v2-' : '' },
          createdAt: { gte: sevenDaysAgo }
        }
      });
      
      cronStatus[pipeline] = {
        nextRun: getNextCronRun(config.intervalMinutes).toISOString(),
        lastRun: lastRun?.startedAt,
        lastStatus: lastRun?.status,
        schedule: config.schedule,
        successCount,
        failCount,
        avgDuration: Math.round(avgDuration),
        lastError: lastFailedRun?.errorMessage?.substring(0, 150),
        articlesCreated,
      };
    }
    
    // Add cron-videos status
    const videoRuns = pipelineRunsArray.filter((r: any) => r.pipeline === 'cron-videos' || r.pipeline === 'video-download');
    const videoSuccessCount = videoRuns.filter((r: any) => r.status === 'success').length;
    const videoFailCount = videoRuns.filter((r: any) => r.status === 'failed').length;
    
    cronStatus['cron-videos'] = {
      nextRun: getNextCronRun(15).toISOString(), // Every 15 minutes
      lastRun: videoRuns[0]?.startedAt,
      lastStatus: videoRuns[0]?.status,
      schedule: '*/15 * * * *',
      successCount: videoSuccessCount,
      failCount: videoFailCount,
      avgDuration: 0,
      articlesCreated: 0,
    };

    // Get last 10 created articles with more details including word counts and scores
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
        sourceUrl: true,
        contentHtml: true, // For word count
        publishMode: true, // DISCOVER or SEARCH_ONLY
        users: { select: { name: true } },
        series: { select: { name: true, tmdbId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20 // Increased to 20
    });

    // Get pipeline runs for these articles to get source word counts and anti-ai scores
    const articleIds = lastCreatedArticles.map(a => a.id);
    const relatedPipelineRuns = await prisma.pipeline_runs.findMany({
      where: {
        articleId: { in: articleIds }
      },
      select: {
        articleId: true,
        wordsCollected: true,
        antiAiScore: true,
      }
    });

    // Get discover scores for these articles
    const discoverScores = await prisma.discover_score_dashboards.findMany({
      where: {
        articleId: { in: articleIds }
      },
      select: {
        articleId: true,
        discoverScore: true,
        finalVerdict: true,
      }
    });

    // Enrich articles with additional data
    const enrichedArticles = lastCreatedArticles.map(article => {
      const pipelineRun = relatedPipelineRuns.find(r => r.articleId === article.id);
      const discoverData = discoverScores.find(d => d.articleId === article.id);
      
      // Calculate generated word count from HTML
      const generatedWordCount = article.contentHtml 
        ? article.contentHtml.replace(/<[^>]*>/g, ' ').split(/\s+/).filter((w: string) => w.length > 0).length
        : 0;

      return {
        id: article.id,
        title: article.title,
        slug: article.slug,
        category: article.category,
        createdAt: article.createdAt,
        publishedAt: article.publishedAt,
        status: article.status,
        heroVideoUrl: article.heroVideoUrl,
        sourceUrl: article.sourceUrl,
        publishMode: article.publishMode,
        users: article.users,
        series: article.series,
        // New fields
        sourceWordCount: pipelineRun?.wordsCollected || 0,
        generatedWordCount,
        antiAiScore: pipelineRun?.antiAiScore || null,
        discoverScore: discoverData?.discoverScore || null,
        discoverVerdict: discoverData?.finalVerdict || null,
      };
    });

    // Check if any pipeline is currently running
    const hasRunningPipeline = pipelineRunsArray.some((r: any) => r.status === 'running');

    return NextResponse.json({
      recentArticles,
      lastCreatedArticles: enrichedArticles,
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
      const sevenDaysAgo = new Date(Date.now() - 168 * 60 * 60 * 1000);
      const runs = await prisma.pipeline_runs.findMany({
        where: { startedAt: { gte: sevenDaysAgo } },
        orderBy: { startedAt: 'desc' },
        take: 500
      });
      
      const csvHeader = 'Zeit,Pipeline,Status,Input,Artikel,Quellen,Wörter,Fakten,Anti-AI,Dauer,Fehler\n';
      const csvRows = runs.map((r: any) => [
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

    // Add new YouTube channel
    if (action === 'add-channel') {
      const { channelUrl, channelName } = body;
      if (!channelUrl) {
        return NextResponse.json({ error: 'channelUrl required' }, { status: 400 });
      }
      
      // Extract channel ID from URL
      // Formats: 
      // - https://www.youtube.com/@ChannelName
      // - https://www.youtube.com/channel/UCxxxxxx
      // - https://www.youtube.com/c/ChannelName
      let extractedChannelId: string | null = null;
      let extractedName = channelName || '';
      
      try {
        const url = new URL(channelUrl);
        const pathname = url.pathname;
        
        if (pathname.startsWith('/@')) {
          // Handle @username format - need to fetch channel page to get ID
          const response = await fetch(channelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });
          const html = await response.text();
          
          // Extract channel ID from page
          const channelIdMatch = html.match(/channel_id=([^"&]+)/);
          if (channelIdMatch) {
            extractedChannelId = channelIdMatch[1];
          }
          
          // Extract name if not provided
          if (!extractedName) {
            const nameMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
            if (nameMatch) {
              extractedName = nameMatch[1];
            } else {
              extractedName = pathname.substring(2); // Remove /@
            }
          }
        } else if (pathname.startsWith('/channel/')) {
          extractedChannelId = pathname.split('/channel/')[1].split('/')[0];
          extractedName = extractedName || extractedChannelId;
        } else if (pathname.startsWith('/c/')) {
          // Custom URL - need to fetch page
          const response = await fetch(channelUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(10000)
          });
          const html = await response.text();
          const channelIdMatch = html.match(/channel_id=([^"&]+)/);
          if (channelIdMatch) {
            extractedChannelId = channelIdMatch[1];
          }
          if (!extractedName) {
            extractedName = pathname.split('/c/')[1];
          }
        }
      } catch (e) {
        return NextResponse.json({ 
          error: 'Konnte Channel-ID nicht extrahieren. Bitte direkte Channel-URL verwenden.' 
        }, { status: 400 });
      }
      
      if (!extractedChannelId) {
        return NextResponse.json({ 
          error: 'Konnte Channel-ID nicht extrahieren. Bitte URL im Format youtube.com/channel/UCxxxx verwenden.' 
        }, { status: 400 });
      }
      
      // Check if already exists
      const existing = await prisma.youtube_channels.findUnique({
        where: { channelId: extractedChannelId }
      });
      
      if (existing) {
        return NextResponse.json({ 
          error: `Kanal "${existing.name}" existiert bereits` 
        }, { status: 400 });
      }
      
      // Create channel
      const newChannel = await prisma.youtube_channels.create({
        data: {
          channelId: extractedChannelId,
          name: extractedName,
          url: channelUrl,
          isActive: true,
        }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Kanal "${newChannel.name}" hinzugefügt`,
        channel: newChannel
      });
    }

    // Delete YouTube channel
    if (action === 'delete-channel') {
      const { channelId } = body;
      if (!channelId) {
        return NextResponse.json({ error: 'channelId required' }, { status: 400 });
      }
      
      // First delete all videos from this channel
      await prisma.youtube_videos.deleteMany({
        where: { channelId }
      });
      
      // Then delete the channel
      const deleted = await prisma.youtube_channels.delete({
        where: { channelId }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `Kanal "${deleted.name}" und alle Videos gelöscht`
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

    // Delete ALL unprocessed videos (cleanup)
    if (action === 'delete-all-videos') {
      const deleted = await prisma.youtube_videos.deleteMany({
        where: { processed: false }
      });
      
      return NextResponse.json({ 
        success: true, 
        message: `${deleted.count} Videos gelöscht`,
        count: deleted.count
      });
    }

    // Delete ALL videos (full reset)
    if (action === 'reset-all-videos') {
      const deleted = await prisma.youtube_videos.deleteMany({});
      
      return NextResponse.json({ 
        success: true, 
        message: `${deleted.count} Videos gelöscht (Full Reset)`,
        count: deleted.count
      });
    }

    // ========== MANUAL CRON TRIGGERS ==========
    // Diese rufen die Cron-Endpoints auf (haben 5 Min Timeout auf Vercel)
    // trigger=manual umgeht den 6-Stunden-Altersfilter
    
    const getBaseUrl = () => {
      if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
      if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
      return 'http://localhost:3000';
    };
    const cronSecret = process.env.CRON_SECRET || 'serien-cron-secret-2024';
    
    // Trigger P3-Trends Cron
    if (action === 'trigger-cron-trends') {
      try {
        const baseUrl = getBaseUrl();
        
        // Fire and forget - don't await
        fetch(`${baseUrl}/api/cron/trends?secret=${cronSecret}&trigger=manual`)
          .then(res => res.json())
          .then(data => console.log('[Manual Trigger] P3-Trends result:', data))
          .catch(err => console.error('[Manual Trigger] P3-Trends error:', err));
        
        return NextResponse.json({ 
          success: true, 
          message: 'P3-Trends gestartet (manuell, Altersfilter deaktiviert)'
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false, 
          error: `P3-Trends Start fehlgeschlagen: ${error.message}`
        });
      }
    }

    // Trigger P4-YouTube Cron
    if (action === 'trigger-cron-youtube') {
      try {
        const baseUrl = getBaseUrl();
        
        // Fire and forget - don't await
        fetch(`${baseUrl}/api/cron/youtube?secret=${cronSecret}&trigger=manual`)
          .then(res => res.json())
          .then(data => console.log('[Manual Trigger] P4-YouTube result:', data))
          .catch(err => console.error('[Manual Trigger] P4-YouTube error:', err));
        
        return NextResponse.json({ 
          success: true, 
          message: 'P4-YouTube gestartet (manuell, Altersfilter deaktiviert)'
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false, 
          error: `P4-YouTube Start fehlgeschlagen: ${error.message}`
        });
      }
    }

    // Trigger News Cron
    if (action === 'trigger-cron-news') {
      try {
        const baseUrl = getBaseUrl();
        
        fetch(`${baseUrl}/api/cron/news?secret=${cronSecret}`)
          .then(res => res.json())
          .then(data => console.log('[Manual Trigger] News result:', data))
          .catch(err => console.error('[Manual Trigger] News error:', err));
        
        return NextResponse.json({ 
          success: true, 
          message: 'News Import gestartet'
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false, 
          error: `News Import Start fehlgeschlagen: ${error.message}`
        });
      }
    }

    // Trigger Releases Cron
    if (action === 'trigger-cron-releases') {
      try {
        const baseUrl = getBaseUrl();
        
        fetch(`${baseUrl}/api/cron/releases?secret=${cronSecret}`)
          .then(res => res.json())
          .then(data => console.log('[Manual Trigger] Releases result:', data))
          .catch(err => console.error('[Manual Trigger] Releases error:', err));
        
        return NextResponse.json({ 
          success: true, 
          message: 'Releases Import gestartet'
        });
      } catch (error: any) {
        return NextResponse.json({ 
          success: false, 
          error: `Releases Import Start fehlgeschlagen: ${error.message}`
        });
      }
    }

    // ========== P2 NEWS LISTE ABRUFEN ==========
    // Holt bis zu 20 News (bis 3 Tage alt) zur Vorschau
    if (action === 'fetch-p2-news') {
      try {
        console.log('[P2 Fetch] Fetching news list...');
        const { fetchNewsFromSource, NEWS_SOURCES } = await import('@/scripts/news-scraper');
        
        const allNews: Array<{
          title: string;
          url: string;
          timeAgo: string;
          source: string;
          publishedAt?: Date;
        }> = [];
        
        // Fetch from all sources
        for (const [sourceKey, sourceConfig] of Object.entries(NEWS_SOURCES)) {
          try {
            const articles = await fetchNewsFromSource(sourceKey as any);
            allNews.push(...articles.map(a => ({
              ...a,
              source: sourceConfig.name
            })));
          } catch (err) {
            console.error(`[P2 Fetch] Error from ${sourceKey}:`, err);
          }
        }
        
        // Filter: max 3 Tage alt
        const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
        const filteredNews = allNews.filter(n => {
          if (n.publishedAt) {
            return n.publishedAt.getTime() > threeDaysAgo;
          }
          // Fallback: timeAgo parsing
          const timeAgo = n.timeAgo.toLowerCase();
          if (timeAgo.includes('second') || timeAgo.includes('minute') || timeAgo.includes('hour')) return true;
          if (timeAgo.includes('day')) {
            const days = parseInt(timeAgo) || 1;
            return days <= 3;
          }
          return false;
        });
        
        // Check which URLs are already imported
        const urls = filteredNews.map(n => n.url);
        const existingArticles = await prisma.articles.findMany({
          where: { sourceUrl: { in: urls } },
          select: { sourceUrl: true }
        });
        const importedUrls = new Set(existingArticles.map(a => a.sourceUrl));
        
        // Mark imported articles
        const newsWithStatus = filteredNews.map(n => ({
          ...n,
          isImported: importedUrls.has(n.url)
        }));
        
        // Sort by recency and limit to 20
        const sortedNews = newsWithStatus
          .sort((a, b) => {
            // Prioritize non-imported
            if (a.isImported !== b.isImported) return a.isImported ? 1 : -1;
            return 0;
          })
          .slice(0, 20);
        
        return NextResponse.json({
          success: true,
          news: sortedNews,
          total: filteredNews.length,
          imported: importedUrls.size
        });
      } catch (error: any) {
        console.error('[P2 Fetch] Error:', error);
        return NextResponse.json({
          success: false,
          error: `News-Abruf fehlgeschlagen: ${error.message}`
        });
      }
    }

    // ========== P2 EINZELNEN ARTIKEL IMPORTIEREN ==========
    // Importiert einen spezifischen Artikel anhand der URL
    if (action === 'import-p2-article') {
      try {
        const { url } = body;
        if (!url) {
          return NextResponse.json({ success: false, error: 'URL erforderlich' });
        }
        
        console.log('[P2 Import] Importing:', url);
        const startTime = Date.now();
        const debugLog: string[] = [];
        
        debugLog.push(`📰 URL: ${url}`);
        debugLog.push(`⏱️ Start: ${new Date().toISOString()}`);
        
        // Check if already imported
        const existing = await prisma.articles.findFirst({
          where: { sourceUrl: url }
        });
        
        if (existing) {
          return NextResponse.json({
            success: false,
            error: 'Artikel bereits importiert',
            articleSlug: existing.slug,
            debug: [...debugLog, `⚠️ Bereits vorhanden: /${existing.slug}`]
          });
        }
        
        // Fetch full text first
        const { fetchFullText } = await import('@/lib/full-text-fetcher');
        debugLog.push(`🔄 Hole Volltext...`);
        
        const fullText = await fetchFullText(url);
        if (!fullText || fullText.length < 200) {
          debugLog.push(`❌ Volltext zu kurz: ${fullText?.length || 0} Zeichen`);
          return NextResponse.json({
            success: false,
            error: 'Volltext konnte nicht geladen werden',
            debug: debugLog
          });
        }
        
        debugLog.push(`✓ Volltext: ${fullText.length} Zeichen`);
        
        // Import pipeline-v2 and process
        const { runPipelineV2 } = await import('@/scripts/pipeline-v2');
        
        // Extract title from URL or use a placeholder
        const urlParts = url.split('/');
        const titleFromUrl = urlParts[urlParts.length - 2] || urlParts[urlParts.length - 1] || 'News Article';
        const cleanTitle = titleFromUrl.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        
        debugLog.push(`🚀 Starte Pipeline...`);
        
        const result = await runPipelineV2({
          title: cleanTitle,
          url: url,
          text: fullText,
          useFullTextMode: true,
          trigger: 'manual'
        });
        
        const duration = Date.now() - startTime;
        debugLog.push(`⏱️ Dauer: ${Math.round(duration / 1000)}s`);
        
        if (result.success) {
          debugLog.push(`✅ Artikel erstellt: /${result.slug}`);
          return NextResponse.json({
            success: true,
            message: `✅ Artikel importiert (${Math.round(duration / 1000)}s)`,
            articleSlug: result.slug,
            articleTitle: result.title,
            debug: debugLog
          });
        } else {
          debugLog.push(`❌ Fehler: ${result.error}`);
          return NextResponse.json({
            success: false,
            error: result.error || 'Import fehlgeschlagen',
            debug: debugLog
          });
        }
      } catch (error: any) {
        console.error('[P2 Import] Error:', error);
        return NextResponse.json({
          success: false,
          error: `Import fehlgeschlagen: ${error.message}`,
          debug: [`❌ Exception: ${error.message}`]
        });
      }
    }

    // ========== P2 SINGLE ARTICLE GENERATOR (Legacy) ==========
    // Erstellt EINEN Artikel pro Klick (sucht frischeste News und verarbeitet sie)
    if (action === 'generate-single-p2') {
      try {
        console.log('[P2 Single] Starting single article generation...');
        const startTime = Date.now();
        const debugLog: string[] = [];
        
        debugLog.push(`⏱️ Start: ${new Date().toISOString()}`);
        
        // Import news scraper
        const { processAllNews, NEWS_SOURCES } = await import('@/scripts/news-scraper');
        debugLog.push(`📰 Quellen: ${Object.keys(NEWS_SOURCES).join(', ')}`);
        
        // Process only 1 article (the freshest one) from ALL 7 sources
        const result = await processAllNews({
          sources: ['screenrant', 'collider', 'cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'tvinsider', 'netflixTudum'],
          limit: 1, // NUR 1 Artikel
          dryRun: false,
          onlyNew: true,
        });
        
        const duration = Date.now() - startTime;
        debugLog.push(`⏱️ Dauer: ${Math.round(duration / 1000)}s`);
        
        // Add source stats to debug
        Object.entries(result.bySource || {}).forEach(([source, count]) => {
          debugLog.push(`   ${source}: ${count} Artikel gefunden`);
        });
        
        debugLog.push(`📊 Verarbeitet: ${result.processed}`);
        debugLog.push(`⏭️ Übersprungen: ${result.skipped}`);
        debugLog.push(`❌ Fehlgeschlagen: ${result.failed}`);
        
        if (result.processed > 0) {
          return NextResponse.json({ 
            success: true, 
            message: `✅ 1 Artikel erstellt (${Math.round(duration / 1000)}s)`,
            debug: debugLog,
            result
          });
        } else if (result.skipped > 0) {
          return NextResponse.json({ 
            success: true, 
            message: `⏭️ Keine neuen Artikel - alle ${result.skipped} bereits importiert`,
            debug: debugLog,
            result
          });
        } else {
          debugLog.push(`⚠️ Mögliche Ursachen:`);
          debugLog.push(`   - Keine News ≤6h alt`);
          debugLog.push(`   - Scraper-Fehler (HTML-Struktur geändert?)`);
          debugLog.push(`   - Netzwerk-Timeout`);
          
          return NextResponse.json({ 
            success: false, 
            message: `❌ Keine passenden News gefunden`,
            debug: debugLog,
            result
          });
        }
      } catch (error: any) {
        console.error('[P2 Single] Error:', error);
        return NextResponse.json({ 
          success: false, 
          error: `P2 Artikel-Erstellung fehlgeschlagen: ${error.message}`,
          debug: [
            `❌ Exception: ${error.message}`,
            `📍 Stack: ${(error.stack || '').split('\n').slice(0, 3).join(' → ')}`
          ]
        });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('Pipeline POST error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
