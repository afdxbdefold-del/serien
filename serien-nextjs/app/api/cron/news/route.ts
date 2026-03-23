/**
 * NEWS IMPORT CRON ENDPOINT
 * 
 * Can be called by Vercel Cron or external cron services
 * to automatically import new news articles
 * 
 * GET /api/cron/news?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Secret to protect the endpoint
const CRON_SECRET = process.env.CRON_SECRET || 'serien-news-import-2024';

export async function GET(request: NextRequest) {
  // Verify secret
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Dynamic import to avoid bundling issues
    const { processScreenrantNews } = await import('@/scripts/screenrant-scraper');
    
    const result = await processScreenrantNews({
      limit: 5,
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
