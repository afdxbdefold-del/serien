import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import {
  automaticNewsSpendUsd, configuredNewsCostLimits, dayStartUtc, estimateNewsCostUsd, mayStartNewsCandidate,
  recordNewsCompletionUsage, withAutomaticNewsAccounting,
  monthStartUtc, NEWS_DAILY_ATTEMPT_LIMIT, NEWS_MONTHLY_BUDGET_USD,
} from '../lib/news-cost-control';

test('meter prices uncached, cached, cache-write and output tokens per role model', () => {
  const usage = { prompt_tokens: 1_000_000, completion_tokens: 100_000,
    prompt_tokens_details: { cached_tokens: 100_000, cache_write_tokens: 100_000 } };
  assert.equal(estimateNewsCostUsd('gpt-6-astra', usage), 14.35);
  assert.equal(estimateNewsCostUsd('gpt-6.1-sol', usage), 2.86);
  assert.equal(estimateNewsCostUsd('unknown', usage), null);
  assert.equal(estimateNewsCostUsd('gpt-6-astra', undefined), null);
  assert.equal(estimateNewsCostUsd('gpt-6-astra', { ...usage, prompt_tokens: 100 }), null);
});

test('monthly USD estimate and daily candidate cap stop new automatic attempts', () => {
  assert.equal(NEWS_MONTHLY_BUDGET_USD, 25);
  assert.equal(NEWS_DAILY_ATTEMPT_LIMIT, 3);
  assert.equal(mayStartNewsCandidate(10, 0), null);
  assert.equal(mayStartNewsCandidate(21, 2), null);
  assert.equal(mayStartNewsCandidate(21.01, 2), 'monthly-cost-limit');
  assert.equal(mayStartNewsCandidate(0, 3), 'daily-attempt-limit');
  assert.equal(mayStartNewsCandidate(NaN, 0), 'monthly-cost-limit');
  assert.equal(monthStartUtc(new Date('2026-10-19T13:00:00Z')).toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(dayStartUtc(new Date('2026-10-19T13:00:00Z')).toISOString(), '2026-10-19T00:00:00.000Z');
  const november = new Date('2026-11-01T00:00:00Z');
  assert.deepEqual(configuredNewsCostLimits({ NEWS_MONTHLY_BUDGET_USD: '25', NEWS_DAILY_ATTEMPT_LIMIT: '3' }, november),
    { monthlyUsd: 25, dailyAttempts: 3, openingSpendUsd: 0 });
  assert.deepEqual(configuredNewsCostLimits({ NEWS_MONTHLY_BUDGET_USD: 'infinite', NEWS_DAILY_ATTEMPT_LIMIT: '0' }, november),
    { monthlyUsd: 25, dailyAttempts: 3, openingSpendUsd: 0 });
  const october = new Date('2026-10-19T12:00:00Z');
  assert.equal(configuredNewsCostLimits({}, october).openingSpendUsd, Infinity);
  assert.equal(configuredNewsCostLimits({ NEWS_COST_BASELINE_USD: '52.23' }, october).openingSpendUsd, 52.23);
});

test('missing or malformed accounting is a stop, never free usage', async () => {
  let where: any;
  const db = { pipeline_runs: { findMany: async (query: any) => {
    where = query.where;
    return [{ metadata: '{"estimatedUsd":1.25}' }, { metadata: '{"estimatedUsd":2.5}' }];
  } } } as unknown as PrismaClient;
  assert.equal(await automaticNewsSpendUsd(db, new Date('2026-10-19T13:00:00Z')), 3.75);
  assert.equal(where.pipeline, 'news-llm-usage');
  assert.equal(where.startedAt.gte.toISOString(), '2026-10-01T00:00:00.000Z');
  const badDb = { pipeline_runs: { findMany: async () => [{ metadata: '{"estimatedUsd":"unknown"}' }] } } as unknown as PrismaClient;
  await assert.rejects(automaticNewsSpendUsd(badDb), /accounting unavailable/i);
});

test('automatic usage rows contain only anonymous accounting fields and fail closed', async () => {
  const rows: any[] = [];
  const db = { pipeline_runs: { create: async (query: any) => { rows.push(query.data); return query.data; } } } as unknown as PrismaClient;
  const usage = { prompt_tokens: 1000, completion_tokens: 100,
    prompt_tokens_details: { cached_tokens: 100, cache_write_tokens: 0 } };
  await recordNewsCompletionUsage('classification', 'gpt-6.1-sol', usage, db);
  assert.equal(rows.length, 0, 'manual and unrelated calls are not counted as cron news');
  await withAutomaticNewsAccounting(() => recordNewsCompletionUsage('classification', 'gpt-6.1-sol', usage, db));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pipeline, 'news-llm-usage');
  assert.equal(rows[0].trigger, 'cron');
  assert.deepEqual(Object.keys(JSON.parse(rows[0].metadata)).sort(),
    ['role', 'model', 'estimatedUsd', 'inputTokens', 'outputTokens', 'cachedTokens', 'cacheWriteTokens'].sort());
  await assert.rejects(withAutomaticNewsAccounting(() => recordNewsCompletionUsage('writing', 'gpt-6-astra', undefined, db)),
    /accounting unavailable/i);
});
