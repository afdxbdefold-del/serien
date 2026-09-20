/** Coolify scheduled news import, authenticated through the cron bearer token. */
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import prisma from '@/lib/prisma';
import { requireCronAuth } from '@/lib/cron-auth';
import {
  DEFAULT_NEWS_BUDGET_MS, DEFAULT_NEWS_LIMIT, positiveInteger, safeNewsError,
} from '@/lib/news-import-reliability';

// The soft import budget stops NEW work after 210s; finish an in-flight article
// safely instead of racing a timeout that could still publish in the background.
export const maxDuration = 900;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authFailure = requireCronAuth(request);
  if (authFailure) return authFailure;
  const startTime = Date.now();
  const runId = `cron-news-${randomUUID()}`;

  try {
    // processAllNews enforces both the pause flag and the shared DB lease for
    // HTTP cron, CLI imports and the optional daemon. Settings failures stop it.
    const { processAllNews } = await import('@/scripts/news-scraper');
    const result = await processAllNews({
      sources: ['cinemaholic', 'deadline', 'variety', 'hollywoodreporter', 'netflixTudum', 'tvline'],
      limit: positiveInteger(process.env.NEWS_LIMIT, DEFAULT_NEWS_LIMIT, 20),
      maxRunMs: positiveInteger(process.env.NEWS_RUN_BUDGET_MS, DEFAULT_NEWS_BUDGET_MS, 600_000),
      dryRun: false,
      onlyNew: true,
      invalidatePublicationCaches: (paths, tags) => {
        for (const tag of tags) revalidateTag(tag);
        for (const path of paths) revalidatePath(path, 'page');
      },
    });
    const durationMs = Date.now() - startTime;
    if (result.skipReason && result.processed === 0 && result.publicationRecovered === 0 && result.publicationPending === 0) {
      // An overlapping invocation did no work; don't inflate success metrics.
      return NextResponse.json({ skipped: true, reason: result.skipReason, durationMs, result });
    }

    const sourceCount = Object.keys(result.bySource).length;
    const allSourcesFailed = sourceCount > 0 && result.sourceErrors === sourceCount;
    const automatedPublishingEnabled = process.env.AUTOMATED_NEWS_PUBLISHING_ENABLED === 'true';
    let stalePublication = false;
    if (automatedPublishingEnabled && result.published === 0) {
      const since = new Date(Date.now() - 36 * 60 * 60_000);
      // Manual posts must not make a broken automatic pipeline look healthy.
      // Also verify that the corresponding article really remains published.
      const recentAutomaticRuns = await prisma.pipeline_runs.findMany({
        where: { pipeline: 'pipeline-v2', trigger: 'cron', status: 'success',
          articleId: { not: null }, completedAt: { gte: since } },
        select: { articleId: true },
      });
      const lastAutomaticPublication = await prisma.articles.findFirst({
        where: { id: { in: recentAutomaticRuns.map((run) => run.articleId).filter((id): id is string => Boolean(id)) },
          status: { in: ['published', 'PUBLISHED'] }, publishedAt: { gte: since } },
        select: { id: true },
      });
      stalePublication = !lastAutomaticPublication;
    }
    const runStatus = allSourcesFailed || stalePublication || result.providerUnavailable
      || (result.failed > 0 && result.published === 0 && result.drafted === 0)
      ? 'failed'
      : result.failed > 0 || result.sourceErrors > 0 || result.drafted > 0
        || result.budgetExhausted || result.skipReason || result.publicationPending > 0
        ? 'partial'
        : 'success';
    const message = stalePublication
      ? 'Seit mehr als 36 Stunden kein automatisch publizierter Artikel'
      : result.providerUnavailable
        ? 'Anbieter nicht erreichbar; weitere Kandidaten werden später versucht'
        : result.publicationPending > 0 ? 'Artikel gespeichert; öffentliche Anzeige noch nicht vollständig bestätigt'
          : result.published === 0 ? 'Keine neuen Artikel publiziert' : undefined;

    await prisma.pipeline_runs.create({
      data: {
        id: runId, pipeline: 'cron-news', trigger: 'cron', status: runStatus,
        startedAt: new Date(startTime), completedAt: new Date(), durationMs,
        errorStep: runStatus === 'failed' ? 'news-import-health' : null,
        errorMessage: runStatus === 'failed' ? message || 'News import failed' : null,
        metadata: JSON.stringify({ ...result, attempted: result.processed,
          stalePublication, automatedPublishingEnabled, durationMs, message }),
      },
    });
    console.log(`[CRON] News: ${result.published} published, ${result.drafted} drafts, ${result.processed} attempted, ${result.failed} failed, ${result.deferred} deferred (${runStatus})`);
    return NextResponse.json({ success: runStatus !== 'failed', status: runStatus,
      timestamp: new Date().toISOString(), durationMs,
      result: { ...result, attempted: result.processed, message },
    }, { status: runStatus === 'failed' ? 503 : 200 });
  } catch (error: unknown) {
    const message = safeNewsError(error);
    const durationMs = Date.now() - startTime;
    console.error(`[CRON] ${message}`);
    // An unavailable DB must not mask the original response or leak its URL.
    await prisma.pipeline_runs.create({
      data: { id: runId, pipeline: 'cron-news', trigger: 'cron', status: 'failed',
        startedAt: new Date(startTime), completedAt: new Date(), durationMs,
        errorStep: 'news-import', errorMessage: message },
    }).catch(() => console.error('[CRON] Could not persist news import failure'));
    return NextResponse.json({ success: false, status: 'failed', error: message }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
