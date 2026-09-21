import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import { draftPipelineActionOutcome, draftPipelineBatchOutcome } from '../lib/draft-pipeline-action-outcome';
import {
  assertDraftPipelineMayContinue, draftSourcePreflight, isFreshDraftSource,
  stableTrendSourceUrl, summarizeDraftOutcomes, withDraftPipelineLease,
} from '../lib/draft-pipeline-reliability';

function fakeRuntime() {
  const leases = new Map<string, string>();
  let paused = false;
  const writes: string[] = [];
  const db = {
    app_settings: { findUnique: async () => ({ value: paused ? 'true' : 'false' }) },
    $executeRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
      const operation = sql.join('?').trim().split(/\s+/)[0];
      const [key, owner] = values as string[];
      writes.push(operation);
      if (operation === 'INSERT') {
        if (leases.has(key)) return 0;
        leases.set(key, owner); return 1;
      }
      if (operation === 'UPDATE') return leases.get(key) === owner ? 1 : 0;
      if (operation === 'DELETE' && leases.get(key) === owner) { leases.delete(key); return 1; }
      return 0;
    },
  } as unknown as PrismaClient;
  return { db, leases, writes, pause: () => { paused = true; } };
}

test('pause prevents discovery/generation and even lease acquisition; settings errors fail closed', async () => {
  const runtime = fakeRuntime();
  runtime.pause();
  let providerCalls = 0;
  const result = await withDraftPipelineLease(runtime.db, 'p3-trends', async () => { providerCalls++; return 'work'; }, (reason) => reason);
  assert.equal(result, 'pipeline.cron.paused');
  assert.equal(providerCalls, 0);
  assert.equal(runtime.writes.length, 0);
  Object.assign(runtime.db.app_settings, { findUnique: async () => { throw new Error('DB unavailable'); } });
  await assert.rejects(withDraftPipelineLease(runtime.db, 'p4-youtube', async () => { providerCalls++; return ''; }, String));
  assert.equal(providerCalls, 0);
});

test('different pipelines run independently, one pipeline is exclusive, nested batch work reuses lease', async () => {
  const runtime = fakeRuntime();
  let unlock!: () => void;
  const blocked = new Promise<void>((resolve) => { unlock = resolve; });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const first = withDraftPipelineLease(runtime.db, 'p3-trends', async () => {
    started();
    assert.equal(await withDraftPipelineLease(runtime.db, 'p3-trends', async () => 'nested', String), 'nested');
    await blocked; return 'first';
  }, String);
  await ready;
  assert.equal(await withDraftPipelineLease(runtime.db, 'p3-trends', async () => 'duplicate', String), 'already-running');
  assert.equal(await withDraftPipelineLease(runtime.db, 'p4-youtube', async () => 'parallel', String), 'parallel');
  unlock();
  assert.equal(await first, 'first');
  assert.equal(runtime.leases.size, 0);
  assert.equal(runtime.writes.filter((operation) => operation === 'INSERT').length, 3);
});

test('failure releases lease; loss or operator pause blocks final persistence', async () => {
  const runtime = fakeRuntime();
  await assert.rejects(withDraftPipelineLease(runtime.db, 'p3-trends', async () => { throw new Error('provider down'); }, String));
  assert.equal(runtime.leases.size, 0);
  await withDraftPipelineLease(runtime.db, 'p3-trends', async () => {
    runtime.leases.set('pipeline.p3-trends.import.lease', 'replacement-owner');
    await assert.rejects(assertDraftPipelineMayContinue(runtime.db, 'p3-trends'), /lease lost/);
  }, () => undefined);
  assert.equal(runtime.leases.get('pipeline.p3-trends.import.lease'), 'replacement-owner');
  await withDraftPipelineLease(runtime.db, 'p4-youtube', async () => {
    runtime.pause();
    await assert.rejects(assertDraftPipelineMayContinue(runtime.db, 'p4-youtube'), /paused/);
  }, () => undefined);
});

test('day bucket trends remain eligible through their discovery day, not just 30 minutes', () => {
  const now = Date.parse('2026-09-21T18:00:00Z');
  assert.equal(isFreshDraftSource(new Date('2026-09-21T00:00:00Z'), now), true);
  assert.equal(isFreshDraftSource(new Date(now - 24 * 3600_000), now), true);
  assert.equal(isFreshDraftSource(new Date(now - 24 * 3600_000 - 1), now), false);
  assert.equal(isFreshDraftSource(new Date(now + 60 * 60_000), now), false);
  assert.equal(isFreshDraftSource(new Date(NaN), now), false);
  assert.equal(isFreshDraftSource(null, now), false);
});

test('trend source identity is stable across retries and preserves actual original URL', () => {
  assert.equal(stableTrendSourceUrl('https://example.com/story#old', 'trend/1'), 'https://example.com/story#trend-trend%2F1');
  assert.equal(stableTrendSourceUrl('https://example.com/story', 'trend/1'), stableTrendSourceUrl('https://example.com/story#other', 'trend/1'));
  assert.equal(stableTrendSourceUrl(null, 'id'), null);
});

test('legacy draft is found before generation and consumed without claiming publication', async () => {
  const existing = { id: 'article-1', slug: 'existing', title: 'Existing title', status: 'draft' };
  const queueWrites: unknown[] = [];
  let articleQuery: any;
  const db = {
    trending_topics: { findUnique: async () => ({ articleId: null, date: new Date() }), updateMany: async (data: unknown) => { queueWrites.push(data); } },
    youtube_videos: { findUnique: async () => ({ articleId: null, publishedAt: new Date() }), updateMany: async (data: unknown) => { queueWrites.push(data); } },
    pipeline_runs: { findMany: async () => [{ articleId: 'article-1', status: 'partial', errorStep: null, startedAt: new Date(), completedAt: new Date() }] },
    articles: { findFirst: async (query: unknown) => { articleQuery = query; return existing; } },
  } as unknown as PrismaClient;
  for (const pipeline of ['p3-trends', 'p4-youtube'] as const) {
    assert.equal((await draftSourcePreflight(db, pipeline, 'source-id')).existing?.id, 'article-1');
    assert.deepEqual(articleQuery.where.OR[0], { id: { in: ['article-1'] } });
  }
  assert.equal(queueWrites.length, 2);
  for (const mutation of queueWrites as any[]) {
    assert.equal(mutation.data.processed, true);
    assert.equal(mutation.data.articleId, 'article-1');
    assert.equal(mutation.data.status, undefined);
  }
});

test('transient failures cool down before generation, old erroneous age blocks do not', async () => {
  let step = 'generation';
  const db = {
    youtube_videos: { findUnique: async () => ({ articleId: null, publishedAt: new Date() }) },
    pipeline_runs: { findMany: async () => [{ articleId: null, status: 'failed', errorStep: step, errorMessage: 'timeout', startedAt: new Date(), completedAt: new Date() }] },
    articles: { findFirst: async () => null },
  } as unknown as PrismaClient;
  assert.equal((await draftSourcePreflight(db, 'p4-youtube', 'id')).retry, 'retry-cooldown');
  step = 'source-age-check';
  assert.equal((await draftSourcePreflight(db, 'p4-youtube', 'id')).retry, null);
});

test('draft, duplicate and unverified publication cannot produce a green publication count', () => {
  const draft = summarizeDraftOutcomes([{ success: false, status: 'draft' }]);
  assert.equal(draft.status, 'drafts-ready'); assert.equal(draft.success, false);
  assert.equal(draft.failed, 0); assert.equal(draft.drafts, 1); assert.equal(draft.published, 0);
  const failed = summarizeDraftOutcomes([{ success: false, error: 'provider failed' }]);
  assert.equal(failed.status, 'failed'); assert.equal(failed.failed, 1);
  assert.equal(summarizeDraftOutcomes([{ success: true, status: 'published' }]).published, 0);
  assert.equal(summarizeDraftOutcomes([{ success: true, status: 'published', skipReason: 'existing-article' }]).published, 0);
  assert.equal(summarizeDraftOutcomes([]).status, 'idle');
});

test('all P3/P4 entrypoints remain guarded and writes atomically link review drafts', () => {
  for (const name of ['p3-trends', 'p4-yt']) {
    const source = readFileSync(new URL(`../scripts/${name}.ts`, import.meta.url), 'utf8');
    assert.match(source, /withDraftPipelineLease/);
    assert.match(source, /draftSourcePreflight/);
    assert.match(source, /const releaseModeEnabled = false/);
    assert.match(source, /prisma\.\$transaction/);
    assert.match(source, /assertDraftPipelineMayContinue/);
    assert.doesNotMatch(source, /30 \* 60 \* 1000/);
  }
  const trendSource = readFileSync(new URL('../scripts/p3-trends.ts', import.meta.url), 'utf8');
  assert.match(trendSource, /sourcePublishedAt: null/);
  assert.doesNotMatch(trendSource, /#trend-\$\{Date\.now/);
  assert.doesNotMatch(trendSource, /\$\{query\}.*2025/);
  const videoSource = readFileSync(new URL('../scripts/p4-yt.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(videoSource, /return discoverYouTubeVideos\(\)/);
  assert.match(videoSource, /if \(tmdbData\?\.backdropPath\) \{/);
  for (const route of ['trends', 'youtube']) {
    const source = readFileSync(new URL(`../app/api/cron/${route}/route.ts`, import.meta.url), 'utf8');
    assert.match(source, /withDraftPipelineLease/);
    assert.match(source, /failed \? 503 : 200/);
    assert.doesNotMatch(source, /searchParams\.get\('trigger'\)/);
  }
});

test('admin receives review/skip states instead of fake new publications or generic errors', () => {
  const draft = draftPipelineActionOutcome({ success: false, status: 'draft', articleId: 'a', slug: 'draft', title: 'Draft' });
  assert.equal(draft.success, false); assert.equal(draft.partial, true); assert.equal(draft.created, true);
  assert.equal('reviewUrl' in draft && draft.reviewUrl, '/admin/articles/a');
  const existing = draftPipelineActionOutcome({ success: false, status: 'published', articleId: 'a', slug: 'existing', title: 'Existing', skipReason: 'existing-article' });
  assert.equal(existing.success, false); assert.equal(existing.created, false);
  assert.equal('verificationPending' in existing && existing.verificationPending, true);
  const paused = draftPipelineActionOutcome({ success: false, skipReason: 'pipeline.cron.paused' });
  assert.equal(paused.success, false); assert.equal('skipped' in paused && paused.skipped, true);
  assert.match(paused.message, /pausiert/);
  const batch = draftPipelineBatchOutcome([
    { success: false, status: 'draft', articleId: 'a', skipReason: 'existing-article' },
    { success: false, skipReason: 'retry-cooldown' },
  ]);
  assert.equal(batch.failed, 0); assert.equal(batch.created, 0); assert.equal(batch.published, 0);
  assert.equal(batch.status, 'review'); assert.equal(batch.partial, true); assert.equal(batch.skippedCount, 2);
  assert.equal(draftPipelineBatchOutcome([]).status, 'idle');
});
