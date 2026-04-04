import { NextResponse } from 'next/server';
import { runFullAudit, runHttpAudit, generateAiSummary } from '@/lib/seo-auditor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET /api/cron/seo - Daily SEO audit: DB + HTTP + AI
export async function GET() {
  try {
    console.log('[SEO Cron] Starting daily DB audit...');
    const runId = await runFullAudit('cron');
    console.log(`[SEO Cron] DB audit completed: ${runId}`);

    // HTTP crawl (sample of 30 pages for cron)
    try {
      console.log('[SEO Cron] Starting HTTP crawl...');
      await runHttpAudit(runId, 30);
      console.log('[SEO Cron] HTTP crawl completed');
    } catch (e) {
      console.error('[SEO Cron] HTTP crawl failed:', e);
    }

    // AI summary
    try {
      await generateAiSummary(runId);
      console.log('[SEO Cron] AI summary generated');
    } catch (e) {
      console.error('[SEO Cron] AI summary failed:', e);
    }

    return NextResponse.json({ success: true, runId });
  } catch (error: any) {
    console.error('[SEO Cron] Audit failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
