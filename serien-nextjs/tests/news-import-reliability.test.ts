import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { acquireNewsImportLease } from '../lib/news-import-lease';
import { recoverPendingNewsPublications } from '../lib/news-publication-recovery';
import type { PublishedArticleInput } from '../lib/publication-verification';
import {
  candidateRetryReason, isProviderFailure, positiveInteger, safeNewsError, selectNewsCandidates,
  type PreviousNewsAttempt,
} from '../lib/news-import-reliability';

const now = Date.parse('2026-09-20T12:00:00Z');
function attempt(minutesAgo: number, errorStep = 'generation', errorMessage = 'Network timeout'): PreviousNewsAttempt {
  return { status: 'failed', errorStep, errorMessage, startedAt: new Date(now - minutesAgo * 60_000) };
}

test('invalid scheduler values fall back instead of creating tight loops or unlimited work', () => {
  for (const value of [undefined, '', 0, -1, NaN, Infinity, '1garbage', '0.5']) {
    assert.equal(positiveInteger(value, 5, 20), 5);
  }
  assert.equal(positiveInteger('6', 5, 20), 6);
  assert.equal(positiveInteger(1000, 5, 20), 20);
});

test('new candidates behind rejected/known feed entries remain selectable', () => {
  const discovered = [
    { source: 'A', url: 'known' }, { source: 'A', url: 'rejected' },
    { source: 'A', url: 'fresh-A' }, { source: 'A', url: 'fresh-A-2' },
    { source: 'B', url: 'fresh-B' }, { source: 'B', url: 'fresh-A' },
  ];
  const eligible = discovered.filter((article) => !['known', 'rejected'].includes(article.url));
  assert.deepEqual(selectNewsCandidates(eligible, 2).map((article) => article.url), ['fresh-A', 'fresh-B']);
  assert.deepEqual(selectNewsCandidates(eligible, 10).map((article) => article.url), ['fresh-A', 'fresh-B', 'fresh-A-2']);
  assert.deepEqual(selectNewsCandidates(eligible, 1, 1).map((article) => article.url), ['fresh-B']);
  assert.deepEqual(selectNewsCandidates([], 5), []);
});

test('temporary provider failure never creates permanent classification blacklist', () => {
  const oldFailures = [attempt(400, 'classification', '429 quota'), attempt(500, 'classification', '429 quota'), attempt(600)];
  assert.equal(candidateRetryReason(oldFailures, now), null);
  assert.equal(candidateRetryReason([attempt(2)], now), 'retry-cooldown');
  assert.equal(candidateRetryReason([attempt(16)], now), null);
  assert.equal(candidateRetryReason([attempt(40), attempt(120)], now), 'retry-cooldown');
  assert.equal(candidateRetryReason([attempt(61), attempt(120)], now), null);
  assert.equal(candidateRetryReason([attempt(300), attempt(400), attempt(500)], now), 'retry-cooldown');
  assert.equal(candidateRetryReason([attempt(361), attempt(400), attempt(500)], now), null);
});

test('cooldown begins at completion, not before an expensive attempt', () => {
  assert.equal(candidateRetryReason([{ ...attempt(30), completedAt: new Date(now - 60_000) }], now), 'retry-cooldown');
});

test('deterministic content rejection remains blocked but provider errors override that classification', () => {
  assert.equal(candidateRetryReason([attempt(500, 'blocklist-tmdb', 'Explicitly blocked series')], now), 'editorial-rejection');
  assert.equal(candidateRetryReason([attempt(30, 'topic-out-of-scope', 'API timeout')], now), null);
  assert.equal(candidateRetryReason([attempt(100, 'classification', 'Movie'), attempt(200, 'classification', 'Movie')], now), 'repeated-classification-rejection');
  assert.equal(candidateRetryReason([attempt(8 * 24 * 60, 'topic-out-of-scope', 'Not a series')], now), null);
  for (const oldGate of ['german-angle-coverage', 'dach-availability', 'us-context-only',
    'topic-out-of-scope', 'sammel-recap', 'genre-out-of-scope', 'unreleased-project', 'primary-series-mismatch',
    'per-series-cap', 'duplicate-jaccard-title', 'duplicate-core-event', 'duplicate-fingerprint',
    'us-streaming-only', 'plagiarism-similar-article']) {
    assert.equal(candidateRetryReason([attempt(30, oldGate, 'Legacy broad source filter')], now), null,
      `${oldGate}: an old broad filter must not permanently suppress a story now assessed by full source review`);
    assert.equal(candidateRetryReason([
      attempt(361, oldGate, 'Legacy broad source filter'),
      attempt(400, oldGate, 'Legacy broad source filter'),
      attempt(500, oldGate, 'Legacy broad source filter'),
    ], now), null, `${oldGate}: repeated old exclusions may cool down but must become retryable`);
  }
  assert.equal(candidateRetryReason([attempt(30, 'blocklist-source', 'URL-Pattern blockt (tv-ratings): old rule')], now), null);
  assert.equal(candidateRetryReason([attempt(2, 'blocklist-source', 'URL-Pattern blockt (tv-ratings): old rule')], now), 'retry-cooldown');
  assert.equal(candidateRetryReason([attempt(30, 'blocklist-source', 'Weak source domain blocked')], now), 'editorial-rejection');
});

test('recent success and active processing protect against duplicate spending', () => {
  assert.equal(candidateRetryReason([{ ...attempt(20), status: 'success' }], now), 'recent-success');
  assert.equal(candidateRetryReason([{ ...attempt(20), status: 'running' }], now), 'already-running');
  assert.equal(candidateRetryReason([{ ...attempt(120), status: 'running' }], now), null);
});

test('scheduler diagnostics never reproduce credentials or DB URLs', () => {
  const secret = 'EXAMPLE_SECRET_NOT_REAL';
  for (const message of [
    `connect postgresql://user:${secret}@db.example/database failed`,
    `401 Authorization: Bearer ${secret}`, `https://example.com/?api_key=${secret}`,
  ]) {
    assert.ok(!safeNewsError(new Error(message)).includes(secret));
    assert.ok(!safeNewsError(new Error(message)).includes('://'));
  }
});

test('word counts and quality metrics are not HTTP failures', () => {
  assert.equal(isProviderFailure('Structure: 500 words but insufficient headings'), false);
  assert.equal(isProviderFailure('[generation] 429 Too many requests'), true);
  assert.equal(isProviderFailure('Response status: 503'), true);
  // The pipeline throws only the sanitized category; the scheduler must still
  // stop the batch instead of spending on the remaining candidates.
  assert.equal(isProviderFailure(safeNewsError(new Error('HTTP 429 quota exceeded'))), true);
  assert.equal(isProviderFailure(safeNewsError(new Error('HTTP 401 invalid API key'))), true);
});

function fakeLeaseDatabase() {
  let owner: string | null = null;
  let stale = false;
  const statements: string[] = [];
  const prisma = {
    async $executeRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join('?');
      statements.push(sql);
      if (sql.includes('INSERT INTO app_settings')) {
        if (owner && !stale) return 0;
        owner = values[1] as string;
        stale = false;
        return 1;
      }
      if (sql.includes('UPDATE app_settings')) return owner === values[1] ? 1 : 0;
      if (sql.includes('DELETE FROM app_settings')) {
        if (owner !== values[1]) return 0;
        owner = null;
        return 1;
      }
      throw new Error('Unexpected SQL');
    },
  } as unknown as PrismaClient;
  return { prisma, statements, expire: () => { stale = true; }, owner: () => owner };
}

test('only one concurrent worker acquires the migration-free lease', async () => {
  const db = fakeLeaseDatabase();
  const [first, second] = await Promise.all([acquireNewsImportLease(db.prisma), acquireNewsImportLease(db.prisma)]);
  assert.ok(first);
  assert.equal(second, null);
  try { await first.assertHeld(); } finally { await first.release(); }
  assert.equal(db.owner(), null);
  assert.ok(db.statements[0].includes('ON CONFLICT'));
  assert.ok(db.statements[0].includes('NOW()'));
  const later = await acquireNewsImportLease(db.prisma);
  assert.ok(later);
  await later.release();
});

test('a stale owner cannot delete a replacement lease or start more work', async () => {
  const db = fakeLeaseDatabase();
  const first = await acquireNewsImportLease(db.prisma);
  assert.ok(first);
  db.expire();
  const replacement = await acquireNewsImportLease(db.prisma);
  assert.ok(replacement);
  const replacementOwner = db.owner();
  try {
    await assert.rejects(first.assertHeld(), /lease lost/);
    await first.release();
    assert.equal(db.owner(), replacementOwner);
    await replacement.assertHeld();
  } finally {
    await first.release();
    await replacement.release();
  }
});

test('pending publication recovery verifies at most three existing rows without regenerating them', async () => {
  const updates: Array<{ where: { id: string }; data: { status: string; metadata: string } }> = [];
  const inputs: PublishedArticleInput[] = [];
  const invalidated: string[] = [];
  const db = {
    $queryRaw: async () => [{ count: BigInt(4 - updates.filter((update) => update.data.status === 'success').length) }],
    pipeline_runs: {
      findMany: async () => [1, 2, 3, 4].map((id) => ({ id: `run${id}`, articleId: `article${id}`, metadata: '{"preserved":true}' })),
      updateMany: async (args: typeof updates[number]) => { updates.push(args); return { count: 1 }; },
    },
    articles: {
      findMany: async () => [{ id: 'article2' }, { id: 'article3' }],
      findUnique: async ({ where }: { where: { id: string } }) => ({ id: where.id, status: 'published',
        slug: where.id, title: 'An actual series announcement', heroImageUrl: 'https://image.tmdb.org/t/p/w1280/test.jpg' }),
    },
  } as unknown as PrismaClient;
  const result = await recoverPendingNewsPublications(db, { now,
    refresh: async (slug) => { invalidated.push(slug); },
    verify: async (input) => { inputs.push(input); return {
      ok: input.slug !== 'article3', checks: {}, homepagePlacement: 'not-checked',
    }; },
  });
  assert.deepEqual(result, { recovered: 2, pending: 2, checked: 3 });
  assert.equal(inputs.length, 3);
  assert.equal(inputs[0].expectedCarousel, undefined, 'old articles must not require impossible carousel residency');
  assert.equal(inputs[0].expectedOnHomepage, false);
  assert.equal(inputs[1].expectedCarousel, 'present');
  assert.deepEqual(invalidated, ['article1', 'article2', 'article3']);
  assert.deepEqual(updates.map((update) => update.data.status), ['success', 'success', 'partial']);
  assert.ok(updates.every((update) => JSON.parse(update.data.metadata).preserved === true));
});

test('recovery respects cooldown and preserves pending status during network outage', async () => {
  const updates: Array<{ data: { status: string; metadata: string } }> = [];
  const db = {
    $queryRaw: async () => [{ count: BigInt(2) }],
    pipeline_runs: {
      findMany: async () => [
        { id: 'cooled', articleId: 'a', metadata: JSON.stringify({ publicationRecheckedAt: new Date(now - 60_000).toISOString() }) },
        { id: 'retry', articleId: 'b', metadata: '{malformed' },
      ],
      updateMany: async (args: typeof updates[number]) => { updates.push(args); return { count: 1 }; },
    },
    articles: {
      findMany: async () => [],
      findUnique: async () => ({ id: 'b', status: 'published', slug: 'b', title: 'B', heroImageUrl: '' }),
    },
  } as unknown as PrismaClient;
  const result = await recoverPendingNewsPublications(db, { now,
    refresh: async () => { throw new Error('A private dependency detail that must not reach logs'); },
    verify: async () => { throw new Error('Verification must not start when refresh throws'); },
  });
  assert.deepEqual(result, { recovered: 0, pending: 2, checked: 1 });
  assert.equal(updates[0].data.status, 'partial');
  assert.ok(!updates[0].data.metadata.includes('private dependency'));
});

test('pending count remains visible outside the retry window and excludes missing or unpublished articles', async () => {
  let aggregate = '';
  const db = {
    pipeline_runs: { findMany: async () => [] },
    $queryRaw: async (strings: TemplateStringsArray) => {
      aggregate = strings.join('?');
      return [{ count: BigInt(7) }];
    },
  } as unknown as PrismaClient;
  assert.deepEqual(await recoverPendingNewsPublications(db, { now }), { recovered: 0, pending: 7, checked: 0 });
  assert.match(aggregate, /COUNT\(DISTINCT run\."articleId"\)/);
  assert.match(aggregate, /INNER JOIN articles/);
  assert.match(aggregate, /article\.status IN \('published', 'PUBLISHED'\)/);
  assert.ok(!aggregate.includes('startedAt'), 'retry window must not hide unresolved older rows');
});
