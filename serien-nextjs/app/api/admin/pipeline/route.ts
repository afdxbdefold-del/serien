import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Cron schedules (UTC times) - alle 6 Stunden
const CRON_SCHEDULES = {
  'p3-trends': { schedule: '0 */6 * * *', name: 'P3-Trends', hours: [0, 6, 12, 18] },
  'p4-youtube': { schedule: '0 */6 * * *', name: 'P4-YouTube', hours: [0, 6, 12, 18] },
  'cron-news': { schedule: '0 */6 * * *', name: 'News Import', hours: [0, 6, 12, 18] },
  'cron-releases': { schedule: '0 */6 * * *', name: 'Releases', hours: [0, 6, 12, 18] },
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

    // ========== P2 SINGLE ARTICLE GENERATOR ==========
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
        
        // Process only 1 article (the freshest one)
        const result = await processAllNews({
          sources: ['screenrant', 'collider', 'cinemaholic'],
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
