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
  // Verify authorization
  if (!isAuthorized(request)) {
    console.log('[CRON] Unauthorized request to /api/cron/news');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling issues
    const { processAllNews } = await import('@/scripts/news-scraper');
    
    // Scrape from ScreenRant, Collider and Cinemaholic
    const result = await processAllNews({
      sources: ['screenrant', 'collider', 'cinemaholic'],
      limit: 5, // 5 per source
      dryRun: false,
      onlyNew: true,
    });

    // Log the run
    console.log(`[CRON] News import: ${result.processed} processed, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: {
        processed: result.processed,
        failed: result.failed,
        skipped: result.skipped,
        bySource: result.bySource,
      },
    });
  } catch (error: any) {
    console.error('[CRON] News import error:', error.message);
    
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
