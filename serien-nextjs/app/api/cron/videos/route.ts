import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { downloadYouTubeTrailer, findTrailerYouTubeId } from '@/lib/trailer-downloader';

const prisma = new PrismaClient();

export const maxDuration = 60; // 60 seconds max

/**
 * Video Download Cron - Improved with Queue System
 * 
 * Features:
 * - Status tracking (pending → downloading → completed/failed)
 * - Retry logic (max 3 attempts)
 * - Priority system
 * - Dashboard-ready stats
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const action = searchParams.get('action') || 'process';
  
  // Verify secret
  if (secret !== 'serien-video-download-2024' && 
      secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Action: stats - Return queue statistics
    if (action === 'stats') {
      return await getQueueStats();
    }
    
    // Action: enqueue - Add new articles to queue
    if (action === 'enqueue') {
      return await enqueueNewArticles();
    }
    
    // Action: process (default) - Process queue items
    return await processQueue();
    
  } catch (error: any) {
    console.error('Video cron error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * Get queue statistics for dashboard
 */
async function getQueueStats() {
  const stats = await prisma.video_download_queue.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  
  const recentCompleted = await prisma.video_download_queue.findMany({
    where: { status: 'completed' },
    orderBy: { completedAt: 'desc' },
    take: 5,
    select: { articleId: true, seriesName: true, completedAt: true, resultPath: true }
  });
  
  const recentFailed = await prisma.video_download_queue.findMany({
    where: { status: 'failed' },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: { articleId: true, seriesName: true, lastError: true, attempts: true }
  });
  
  return NextResponse.json({
    success: true,
    stats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    recentCompleted,
    recentFailed,
    timestamp: new Date().toISOString()
  });
}

/**
 * Enqueue new articles that need video downloads
 */
async function enqueueNewArticles() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  // Find articles without videos that aren't in queue
  const articlesWithoutVideo = await prisma.articles.findMany({
    where: {
      heroVideoUrl: null,
      createdAt: { gte: sevenDaysAgo },
      series: { isNot: null },
      // Not already in queue
      NOT: {
        id: {
          in: (await prisma.video_download_queue.findMany({
            select: { articleId: true }
          })).map(q => q.articleId)
        }
      }
    },
    include: {
      series: {
        select: { name: true, trailers: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  
  const enqueued: string[] = [];
  const skipped: string[] = [];
  
  for (const article of articlesWithoutVideo) {
    if (!article.series?.trailers) {
      skipped.push(article.slug);
      continue;
    }
    
    const trailerId = findTrailerYouTubeId(article.series.trailers);
    if (!trailerId) {
      skipped.push(article.slug);
      continue;
    }
    
    // Add to queue
    await prisma.video_download_queue.create({
      data: {
        articleId: article.id,
        seriesName: article.series.name || 'Unknown',
        youtubeId: trailerId,
        status: 'pending',
        priority: 0
      }
    });
    
    enqueued.push(article.slug);
  }
  
  return NextResponse.json({
    success: true,
    enqueued: enqueued.length,
    skipped: skipped.length,
    enqueuedSlugs: enqueued,
    timestamp: new Date().toISOString()
  });
}

/**
 * Process queue items (main download logic)
 */
async function processQueue() {
  // Get pending items (prioritize by priority, then oldest first)
  const pendingItems = await prisma.video_download_queue.findMany({
    where: {
      OR: [
        { status: 'pending' },
        // Retry failed items with attempts < maxAttempts
        {
          status: 'failed',
          attempts: { lt: 3 }
        }
      ]
    },
    orderBy: [
      { priority: 'desc' },
      { createdAt: 'asc' }
    ],
    take: 2 // Process max 2 per run (60s limit)
  });
  
  console.log(`Processing ${pendingItems.length} items from queue`);
  
  const results: any[] = [];
  
  for (const item of pendingItems) {
    // Mark as downloading
    await prisma.video_download_queue.update({
      where: { id: item.id },
      data: { 
        status: 'downloading',
        attempts: { increment: 1 },
        updatedAt: new Date()
      }
    });
    
    console.log(`[${item.attempts + 1}/3] Downloading trailer for: ${item.seriesName}`);
    
    try {
      const downloadResult = await downloadYouTubeTrailer(
        item.youtubeId,
        item.seriesName
      );
      
      if (downloadResult.success && downloadResult.localPath) {
        // Update article
        await prisma.articles.update({
          where: { id: item.articleId },
          data: { heroVideoUrl: downloadResult.localPath }
        });
        
        // Mark as completed
        await prisma.video_download_queue.update({
          where: { id: item.id },
          data: { 
            status: 'completed',
            resultPath: downloadResult.localPath,
            completedAt: new Date(),
            lastError: null
          }
        });
        
        results.push({ 
          articleId: item.articleId,
          seriesName: item.seriesName,
          status: 'completed', 
          videoUrl: downloadResult.localPath,
          attempts: item.attempts + 1
        });
      } else {
        // Mark as failed
        const newAttempts = item.attempts + 1;
        await prisma.video_download_queue.update({
          where: { id: item.id },
          data: { 
            status: newAttempts >= 3 ? 'failed' : 'pending', // Retry if < 3 attempts
            lastError: downloadResult.error || 'Unknown error'
          }
        });
        
        results.push({ 
          articleId: item.articleId,
          seriesName: item.seriesName,
          status: newAttempts >= 3 ? 'failed' : 'retry_scheduled',
          error: downloadResult.error,
          attempts: newAttempts
        });
      }
    } catch (error: any) {
      const newAttempts = item.attempts + 1;
      await prisma.video_download_queue.update({
        where: { id: item.id },
        data: { 
          status: newAttempts >= 3 ? 'failed' : 'pending',
          lastError: error.message
        }
      });
      
      results.push({ 
        articleId: item.articleId,
        seriesName: item.seriesName,
        status: 'error',
        error: error.message,
        attempts: newAttempts
      });
    }
  }
  
  // Get updated stats
  const stats = await prisma.video_download_queue.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  
  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
    queueStats: stats.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {}),
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
