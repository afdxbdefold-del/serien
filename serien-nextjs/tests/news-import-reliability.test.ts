import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
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
  assert.deepEqual(selectNewsCandidates(eligible, 1, 'A').map((article) => article.url), ['fresh-B']);
  assert.deepEqual(selectNewsCandidates([], 5), []);
});

test('one-candidate hourly and same-quarter manual runs visit every source with 6, 4 or 2 queues', (context) => {
  for (const queueCount of [6, 4, 2]) {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, queueCount);
    const candidates = names.map(source => ({ source, url: `https://example.test/${source}` }));
    for (const spacingMs of [3_600_000, 1000]) {
      let clock = now;
      const clockMock = context.mock.method(Date, 'now', () => clock);
      let cursor: string | undefined;
      const attempted: string[] = [];
      for (let index = 0; index < queueCount * 2; index++) {
        const selected = selectNewsCandidates(candidates, 1, cursor, names);
        cursor = selected[0].source;
        attempted.push(cursor);
        clock += spacingMs;
      }
      clockMock.mock.restore();
      assert.deepEqual(attempted, [...names, ...names]);
      assert.deepEqual(candidates.map(candidate => candidate.source), names, 'input queues are not consumed');
    }
  }
});

test('source-name cursor survives empty, returning and removed queues without numeric reinterpretation', () => {
  const ring = ['A', 'B', 'C', 'D', 'E', 'F'];
  const candidates = (names: string[]) => names.map(source => ({ source, url: source }));
  assert.equal(selectNewsCandidates(candidates(['A', 'C', 'F']), 1, 'B', ring)[0].source, 'C');
  assert.equal(selectNewsCandidates(candidates(['A', 'C', 'F']), 1, 'E', ring)[0].source, 'F');
  assert.equal(selectNewsCandidates(candidates(['A', 'B', 'C', 'F']), 1, 'F', ring)[0].source, 'A');
  assert.equal(selectNewsCandidates(candidates(['A', 'B', 'C', 'F']), 1, 'A', ring)[0].source, 'B');
  assert.equal(selectNewsCandidates(candidates(['A', 'C']), 1, 'retired-source', ['A', 'C'])[0].source, 'A');
  assert.deepEqual(selectNewsCandidates([], 1, 'B', ring), []);
  assert.deepEqual(selectNewsCandidates([
    { source: 'A', url: 'shared' }, { source: 'B', url: 'shared' }, { source: 'B', url: 'unique' },
  ], 5, null, ['A', 'A', 'B']).map(article => article.url), ['shared', 'unique']);
});

test('interrupted multi-candidate batch resumes after the last attempted source, not the last selected source', () => {
  const candidates = ['A', 'B', 'C'].map(source => ({ source, url: source }));
  const selected = selectNewsCandidates(candidates, 3, null, ['A', 'B', 'C']);
  assert.deepEqual(selected.map(article => article.source), ['A', 'B', 'C']);
  // A was attempted; B/C remained deferred when the run budget or pause intervened.
  assert.equal(selectNewsCandidates(candidates, 1, selected[0].source, ['A', 'B', 'C'])[0].source, 'B');
});

test('actual scraper advances its persistent cursor only after attempt guards and fails closed on DB errors', () => {
  // Do not import this executable scraper: it owns live DB/provider clients.
  const source = readFileSync(new URL('../scripts/news-scraper.ts', import.meta.url), 'utf8');
  const file = ts.createSourceFile('news-scraper.ts', source, ts.ScriptTarget.Latest, true);
  const functions = file.statements.filter(ts.isFunctionDeclaration);
  const batch = functions.find(node => node.name?.text === 'processNewsBatch');
  const entry = functions.find(node => node.name?.text === 'processAllNews');
  assert(batch?.body && entry?.body);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(batch.body);
  const outerTry = batch.body.statements.find(ts.isTryStatement);
  assert(outerTry?.catchClause);
  assert(outerTry.catchClause.block.statements.some(ts.isThrowStatement), 'cursor DB failures escape the whole batch');
  const loop = outerTry.tryBlock.statements.find((node): node is ts.ForOfStatement =>
    ts.isForOfStatement(node) && node.expression.getText(file) === 'articlesToProcess.entries()');
  assert(loop && ts.isBlock(loop.statement));
  const statements = [...loop.statement.statements];
  const advance = statements.findIndex(node => node.getText(file).includes('prisma.app_settings.upsert'));
  assert(advance > 0);
  assert.match(statements[advance].getText(file), /^await prisma\.app_settings\.upsert/);
  assert.match(statements[advance].getText(file), /value: article\.source/);
  assert.match(statements[advance].getText(file), /key: NEWS_SOURCE_CURSOR_KEY/);
  const before = statements.slice(0, advance).map(node => node.getText(file)).join('\n');
  assert.match(before, /if \(Date\.now\(\) >= deadline\)[\s\S]*?break;/);
  assert.match(before, /await assertLease\(\)/);
  assert.match(before, /if \(!dryRun\)[\s\S]*?key: 'pipeline\.cron\.paused'[\s\S]*?break;/);
  assert.match(before, /if \(dryRun\)[\s\S]*?continue;/);
  const attemptTry = statements.slice(advance + 1).find(ts.isTryStatement);
  assert(attemptTry && /await runPipelineV2\(/.test(attemptTry.tryBlock.getText(file)),
    'cursor write is outside the per-article catch and before any provider attempt');
  const cursor = nodes.find((node): node is ts.VariableDeclaration =>
    ts.isVariableDeclaration(node) && node.name.getText(file) === 'cursor');
  assert(cursor?.initializer && ts.isConditionalExpression(cursor.initializer));
  assert.equal(cursor.initializer.condition.getText(file), 'dryRun');
  assert.equal(cursor.initializer.whenTrue.kind, ts.SyntaxKind.NullKeyword);
  assert.match(cursor.initializer.whenFalse.getText(file), /^await prisma\.app_settings\.findUnique/);
  const preCursor = source.slice(batch.pos, cursor.pos);
  assert.match(preCursor, /if \(articlesToProcess\.length === 0\)[\s\S]*?return stats;/);
  assert.match(entry.getText(file), /if \(options\.dryRun\) return processNewsBatch/);
  assert.match(entry.getText(file), /if \(!lease\) return/);
  assert.match(entry.getText(file), /processNewsBatch\(options, lease\.assertHeld\)/);
  assert.match(source, /sources\.map\(source => NEWS_SOURCES\[source\]\.name\)/);
  assert.doesNotMatch(source, /selectNewsCandidates\([^;]*Date\.now/);
  assert.deepEqual(ts.transpileModule(source, { fileName: 'news-scraper.ts', reportDiagnostics: true }).diagnostics, []);
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

test('bounded source rejection is not mistaken for network timeout', () => {
  const size = safeNewsError(new Error('source-response-too-large'));
  assert.equal(size, 'Original source read failed: source-response-too-large');
  assert.equal(isProviderFailure(size), false);
  const aborted = safeNewsError(new Error('source-response-aborted'));
  assert.equal(isProviderFailure(aborted), true);
  assert.doesNotMatch(aborted, /timed out|timeout/);
  assert.equal(isProviderFailure(safeNewsError(new Error('source-request-timeout'))), true);
  assert.doesNotMatch(safeNewsError(new Error('source-unknown-private-value')), /private-value/);
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
