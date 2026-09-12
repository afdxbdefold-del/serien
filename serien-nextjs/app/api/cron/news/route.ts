/**
 * NEWS IMPORT CRON ENDPOINT
 * 
 * Called by Vercel Cron with Authorization header
 * Fallback: URL parameter for manual testing
 * 
 * GET /api/cron/news
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { requireCronAuth } from '@/lib/cron-auth';

const prisma = new PrismaClient();

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;

  // Kill-switch: if pipeline.cron.paused = true in app_settings, skip run
  try {
    const { getBoolSetting, SETTINGS } = await import('@/lib/app-settings');
    const paused = await getBoolSetting(SETTINGS.PIPELINE_CRON_PAUSED, false);
    if (paused) {
      console.log('[CRON] Skipped: pipeline.cron.paused = true');
      return NextResponse.json({
        skipped: true,
        reason: 'pipeline.cron.paused',
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[CRON] Kill-switch check failed, continuing:', message);
  }

  try {
    // Dynamic import to avoid bundling issues
    const { processAllNews } = await import('@/scripts/news-scraper');
    
    console.log('[CRON] Starting news import...');
    
    // Scrape from active sources only. Removed (Juni 2026, Anti-HCU):
    //   - screenrant, collider, whats-on-netflix → schwache DACH-Discover-
    //     Performance, Volume-Verschmutzung.
    //   - tvinsider → Cloudflare-JS-Challenge, kein verlässlicher Full-Text.
    // Premium-Quellen (Deadline, Variety, THR, TVLine, Cinemaholic) + Netflix
    // Tudum als Canonical-First-Party-Streamer-Quelle bilden den aktuellen Pool.
    const result = await processAllNews({
      sources: ['cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'netflixTudum', 'tvline'],
      limit: 4, // 4 per source × 6 = up to 24 candidates per cron run
      dryRun: false,
      onlyNew: true,
    });

    const duration = Date.now() - startTime;
    const sourceCount = Object.keys(result.bySource).length;
    const allSourcesFailed = sourceCount > 0 && result.sourceErrors === sourceCount;
    const automatedPublishingEnabled = process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED === 'true';
    const latestPublished = automatedPublishingEnabled && result.published === 0
      ? await prisma.articles.findFirst({
          where: { status: { in: ['published', 'PUBLISHED'] }, publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true },
        })
      : null;
    const stalePublication = Boolean(
      automatedPublishingEnabled
      && result.published === 0
      && (!latestPublished?.publishedAt
        || Date.now() - latestPublished.publishedAt.getTime() > 36 * 60 * 60 * 1000),
    );
    const runStatus = allSourcesFailed || stalePublication
      ? 'failed'
      : result.failed > 0 || result.sourceErrors > 0 || result.drafted > 0
        ? 'partial'
        : 'success';
    
    // Log the run - auch wenn keine News
    if (result.processed === 0 && result.failed === 0 && result.sourceErrors === 0) {
      console.log(`[CRON] News import: Keine neuen News gefunden (${result.skipped || 0} übersprungen, ${Math.round(duration/1000)}s)`);
      
      // Log to pipeline_runs for dashboard visibility
      await prisma.pipeline_runs.create({
        data: {
          id: `cron-news-${Date.now()}`,
          pipeline: 'cron-news',
          trigger: 'cron',
          status: runStatus,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          metadata: JSON.stringify({
            message: 'Keine neuen News gefunden',
            published: 0,
            attempted: 0,
            drafted: result.drafted,
            sourceErrors: result.sourceErrors,
            skipped: result.skipped || 0,
            stalePublication,
            automatedPublishingEnabled,
            duration,
          })
        }
      });
    } else {
      console.log(`[CRON] News import: ${result.published} publiziert / ${result.drafted} Drafts / ${result.processed} versucht, ${result.failed} fehlgeschlagen, ${result.sourceErrors} Quellfehler (${Math.round(duration/1000)}s)`);
      
      // Log successful run with articles
      await prisma.pipeline_runs.create({
        data: {
          id: `cron-news-${Date.now()}`,
          pipeline: 'cron-news',
          trigger: 'cron',
          status: runStatus,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          metadata: JSON.stringify({
            published: result.published,
            attempted: result.processed,
            drafted: result.drafted,
            failed: result.failed,
            sourceErrors: result.sourceErrors,
            skipped: result.skipped || 0,
            bySource: result.bySource,
            stalePublication,
            automatedPublishingEnabled,
            duration,
          })
        }
      });
    }

    return NextResponse.json({
      success: runStatus !== 'failed',
      status: runStatus,
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration/1000)}s`,
      result: {
        published: result.published,
        attempted: result.processed,
        drafted: result.drafted,
        failed: result.failed,
        sourceErrors: result.sourceErrors,
        skipped: result.skipped,
        bySource: result.bySource,
        message: stalePublication
          ? 'Seit mehr als 36 Stunden wurde trotz aktiver Automatik nichts publiziert'
          : result.published === 0
            ? 'Keine neuen Artikel publiziert'
            : undefined,
      },
    }, { status: runStatus === 'failed' ? 503 : 200 });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.error('[CRON] News import error:', message);
    
    // Log failed run
    await prisma.pipeline_runs.create({
      data: {
        id: `cron-news-${Date.now()}`,
        pipeline: 'cron-news',
        trigger: 'cron',
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        errorMessage: message,
        metadata: JSON.stringify({ duration })
      }
    });
    
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
