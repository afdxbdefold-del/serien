import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { candidateRetryReason } from './news-import-reliability';

export type DraftPipeline = 'p3-trends' | 'p4-youtube';
export type DraftSkipReason = 'pipeline.cron.paused' | 'already-running' | 'existing-article' | 'retry-cooldown' | 'source-too-old' | 'time-budget';
export const DRAFT_SOURCE_WINDOW_MS = 24 * 60 * 60_000;
export const DRAFT_BATCH_BUDGET_MS = 210_000;
const scope = new AsyncLocalStorage<{ pipeline: DraftPipeline; assertHeld: () => Promise<void>; deadline: number }>();

export function draftPipelineDeadline(): number {
  return scope.getStore()?.deadline ?? Date.now() + DRAFT_BATCH_BUDGET_MS;
}

/** Discovery and manual/admin batch paths share the operator pause switch. */
export async function withDraftPipelineLease<T>(
  prisma: PrismaClient,
  pipeline: DraftPipeline,
  work: () => Promise<T>,
  skipped: (reason: DraftSkipReason) => T,
): Promise<T> {
  const paused = await prisma.app_settings.findUnique({ where: { key: 'pipeline.cron.paused' }, select: { value: true } });
  if (paused?.value === 'true' || paused?.value === '1') return skipped('pipeline.cron.paused');
  const parent = scope.getStore();
  if (parent?.pipeline === pipeline) {
    await parent.assertHeld();
    if (Date.now() >= parent.deadline) return skipped('time-budget');
    return work();
  }

  // Independent pipelines may run together; two workers of the same pipeline
  // may not. Acquisition and renewal are atomic across server processes.
  const key = `pipeline.${pipeline}.import.lease`;
  const owner = randomUUID();
  const acquired = await prisma.$executeRaw`
    INSERT INTO app_settings (key, value, "updatedAt", "updatedBy")
    VALUES (${key}, ${owner}, NOW(), 'draft-pipeline')
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, "updatedAt" = NOW(), "updatedBy" = 'draft-pipeline'
      WHERE app_settings."updatedAt" < NOW() - INTERVAL '30 minutes'
  `;
  if (acquired !== 1) return skipped('already-running');
  let lost = false;
  let pending: Promise<void> | undefined;
  const renew = (): Promise<void> => {
    if (pending) return pending;
    pending = (async () => {
      const renewed = await prisma.$executeRaw`
        UPDATE app_settings SET "updatedAt" = NOW() WHERE key = ${key} AND value = ${owner}
      `;
      if (renewed !== 1) throw new Error('Draft pipeline lease lost');
    })().catch((error) => { lost = true; throw error; }).finally(() => { pending = undefined; });
    return pending;
  };
  const assertHeld = async () => {
    if (lost) throw new Error('Draft pipeline lease lost');
    await renew();
  };
  const heartbeat = setInterval(() => { void renew().catch(() => {}); }, 30_000);
  heartbeat.unref?.();
  try {
    return await scope.run({ pipeline, assertHeld, deadline: Date.now() + DRAFT_BATCH_BUDGET_MS }, work);
  } finally {
    clearInterval(heartbeat);
    if (pending) await pending.catch(() => {});
    await prisma.$executeRaw`DELETE FROM app_settings WHERE key = ${key} AND value = ${owner}`;
  }
}

/** Recheck immediately before persisting; a lost lease must not save a duplicate. */
export async function assertDraftPipelineMayContinue(prisma: PrismaClient, pipeline: DraftPipeline): Promise<void> {
  const current = scope.getStore();
  if (current?.pipeline !== pipeline) throw new Error('Draft pipeline lease missing');
  await current.assertHeld();
  const paused = await prisma.app_settings.findUnique({ where: { key: 'pipeline.cron.paused' }, select: { value: true } });
  if (paused?.value === 'true' || paused?.value === '1') throw new Error('Draft pipeline paused during work');
}

export function isFreshDraftSource(date: Date | null | undefined, now = Date.now()): boolean {
  if (!date || !Number.isFinite(date.getTime())) return false;
  const age = now - date.getTime();
  return age >= -5 * 60_000 && age <= DRAFT_SOURCE_WINDOW_MS;
}

export function stableTrendSourceUrl(sourceUrl: string | null, trendId: string): string | null {
  return sourceUrl ? `${sourceUrl.split('#')[0]}#trend-${encodeURIComponent(trendId)}` : null;
}

/** Read before any paid generation. Also recognises legacy drafts whose queue
 * relation was not stored, by their previous pipeline run or YouTube source. */
export async function draftSourcePreflight(prisma: PrismaClient, pipeline: DraftPipeline, sourceId: string) {
  const queue = pipeline === 'p3-trends'
    ? await prisma.trending_topics.findUnique({ where: { id: sourceId }, select: { articleId: true, date: true } })
    : await prisma.youtube_videos.findUnique({ where: { videoId: sourceId }, select: { articleId: true, publishedAt: true } });
  const history = await prisma.pipeline_runs.findMany({
    where: { pipeline, ...(pipeline === 'p3-trends' ? { inputSource: `trend-${sourceId}` } : { inputVideoId: sourceId }) },
    orderBy: { startedAt: 'desc' }, take: 30,
    select: { articleId: true, status: true, errorStep: true, errorMessage: true, startedAt: true, completedAt: true },
  });
  const articleIds = [queue?.articleId, ...history.map((run) => run.articleId)].filter((id): id is string => Boolean(id));
  const existing = await prisma.articles.findFirst({
    where: { OR: [
      { id: { in: articleIds } },
      ...(pipeline === 'p4-youtube' ? [{ sourceUrl: `https://www.youtube.com/watch?v=${sourceId}` }] : [{ sourceUrl: { endsWith: `#trend-${encodeURIComponent(sourceId)}` } }]),
    ] },
    select: { id: true, slug: true, title: true, status: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    // A saved draft is a completed generation job, not a published article.
    // Re-link legacy rows now, so the next capped batch reaches new candidates.
    if (pipeline === 'p3-trends') {
      await prisma.trending_topics.updateMany({ where: { id: sourceId }, data: { processed: true, articleId: existing.id, processedAt: new Date() } });
    } else {
      await prisma.youtube_videos.updateMany({ where: { videoId: sourceId }, data: { processed: true, articleId: existing.id, articleSlug: existing.slug, processedAt: new Date() } });
    }
  }
  // Legacy age-check bugs must not suppress correctly dated candidates forever.
  const retry = candidateRetryReason(history.filter((run) => !['topic-age-check', 'source-age-check'].includes(run.errorStep || '')));
  return { existing, queue, retry: retry ? 'retry-cooldown' as const : null };
}

export interface DraftOutcome {
  success: boolean;
  status?: 'draft' | 'published';
  skipReason?: string;
  error?: string;
  publicationVerified?: boolean;
}

/** Generation success is deliberately not publication success. */
export function summarizeDraftOutcomes(results: DraftOutcome[]) {
  const published = results.filter((result) => result.status === 'published' && result.publicationVerified === true && !result.skipReason).length;
  const drafts = results.filter((result) => result.status === 'draft' && !result.skipReason).length;
  const skipped = results.filter((result) => Boolean(result.skipReason)).length;
  const failed = results.filter((result) => !result.skipReason && result.status !== 'draft' && !(result.status === 'published' && result.publicationVerified)).length;
  const status = failed ? 'failed' : drafts ? 'drafts-ready' : published ? 'published' : skipped ? 'skipped' : 'idle';
  return { success: failed === 0 && drafts === 0 && skipped === 0, status, processed: results.length, articlesCreated: drafts + published, published, drafts, skipped, failed };
}
