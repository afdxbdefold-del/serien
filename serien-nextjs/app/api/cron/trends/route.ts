import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireCronAuth } from '@/lib/cron-auth';
import { summarizeDraftOutcomes, withDraftPipelineLease } from '@/lib/draft-pipeline-reliability';
import { safeNewsError } from '@/lib/news-import-reliability';

// 210s start budget; allow an already-started article to finish safely.
export const maxDuration = 900;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;
  // Cron never accepts a query-string override of source freshness.
  const started = Date.now();
  try {
    return await withDraftPipelineLease<NextResponse>(prisma, 'p3-trends', async () => {
      const { fetchGoogleTrends } = await import('@/scripts/google-trends-scraper');
      const { processAllTrends } = await import('@/scripts/p3-trends');
      let discovered = 0;
      let discoveryError: string | undefined;
      try {
        discovered = (await fetchGoogleTrends()).trends.length;
      } catch (error) {
        discoveryError = safeNewsError(error);
      }
      // Process queued candidates even when discovery is empty or unavailable.
      // A discovery outage remains a failure, never a false green empty run.
      const results = await processAllTrends('cron', 3);
      const summary = summarizeDraftOutcomes(results);
      const failed = summary.failed > 0 || Boolean(discoveryError);
      return NextResponse.json({
        success: summary.success && !discoveryError,
        status: failed ? 'failed' : summary.status,
        trigger: 'cron',
        stats: { ...summary, trendsFound: discovered, trendsProcessed: summary.processed, durationMs: Date.now() - started },
        results,
        ...(discoveryError ? { discoveryError } : {}),
        timestamp: new Date().toISOString(),
      }, { status: failed ? 503 : 200 });
    }, (skipReason) => NextResponse.json({ success: false, status: 'skipped', skipReason, results: [], timestamp: new Date().toISOString() }));
  } catch (error) {
    const message = safeNewsError(error);
    console.error('trends cron failed:', message);
    return NextResponse.json({ success: false, status: 'failed', error: message }, { status: 503 });
  }
}

export const POST = GET;
