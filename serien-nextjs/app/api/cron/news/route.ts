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

const prisma = new PrismaClient();

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  // Method 1: Vercel Cron sends Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  // Method 2: URL parameter fallback for manual testing
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === process.env.CRON_SECRET || secret === 'serien-news-import-2024') {
    return true;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Verify authorization
  if (!isAuthorized(request)) {
    console.log('[CRON] Unauthorized request to /api/cron/news');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  } catch (e: any) {
    console.warn('[CRON] Kill-switch check failed, continuing:', e.message);
  }

  try {
    // Dynamic import to avoid bundling issues
    const { processAllNews } = await import('@/scripts/news-scraper');
    
    console.log('[CRON] Starting news import...');
    
    // Scrape from all 9 configured sources: 3 HTML sites + 4 premium RSS feeds + Netflix Tudum + TVLine.
    // Premium sources (Deadline, Variety, HR, TVInsider, TVLine) bring journalistic industry
    // news; Netflix Tudum delivers canonical first-party Netflix headlines.
    const result = await processAllNews({
      sources: ['screenrant', 'collider', 'cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'tvinsider', 'netflixTudum', 'tvline', 'whatsOnNetflix'],
      limit: 4, // 4 per source × 10 = up to 40 candidates per cron run
      dryRun: false,
      onlyNew: true,
    });

    const duration = Date.now() - startTime;
    
    // Log the run - auch wenn keine News
    if (result.processed === 0 && result.failed === 0) {
      console.log(`[CRON] News import: Keine neuen News gefunden (${result.skipped || 0} übersprungen, ${Math.round(duration/1000)}s)`);
      
      // Log to pipeline_runs for dashboard visibility
      await prisma.pipeline_runs.create({
        data: {
          id: `cron-news-${Date.now()}`,
          pipeline: 'cron-news',
          trigger: 'cron',
          status: 'success',
          startedAt: new Date(startTime),
          completedAt: new Date(),
          metadata: JSON.stringify({
            message: 'Keine neuen News gefunden',
            published: 0,
            attempted: 0,
            skipped: result.skipped || 0,
            duration,
          })
        }
      });
    } else {
      console.log(`[CRON] News import: ${result.published} publiziert / ${result.processed} versucht, ${result.failed} fehlgeschlagen (${Math.round(duration/1000)}s)`);
      
      // Log successful run with articles
      await prisma.pipeline_runs.create({
        data: {
          id: `cron-news-${Date.now()}`,
          pipeline: 'cron-news',
          trigger: 'cron',
          status: result.published > 0 ? 'success' : (result.failed > 0 ? 'partial' : 'success'),
          startedAt: new Date(startTime),
          completedAt: new Date(),
          metadata: JSON.stringify({
            published: result.published,
            attempted: result.processed,
            failed: result.failed,
            skipped: result.skipped || 0,
            bySource: result.bySource,
            duration,
          })
        }
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration/1000)}s`,
      result: {
        published: result.published,
        attempted: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        bySource: result.bySource,
        message: result.published === 0 ? 'Keine neuen Artikel publiziert' : undefined,
      },
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('[CRON] News import error:', error.message);
    
    // Log failed run
    await prisma.pipeline_runs.create({
      data: {
        id: `cron-news-${Date.now()}`,
        pipeline: 'cron-news',
        trigger: 'cron',
        status: 'failed',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        errorMessage: error.message,
        metadata: JSON.stringify({ duration })
      }
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request);
}
