import { NextResponse } from 'next/server';
import { runFullAudit, generateAiSummary } from '@/lib/seo-auditor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// GET /api/cron/seo - Daily SEO audit cron
export async function GET() {
  try {
    console.log('[SEO Cron] Starting daily audit...');
    const runId = await runFullAudit('cron');
    console.log(`[SEO Cron] Audit completed: ${runId}`);

    // Generate AI summary
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
