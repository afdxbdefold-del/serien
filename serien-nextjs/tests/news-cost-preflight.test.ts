import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasPotentialOriginalGermanyEvidence, shouldRejectNewsBeforeWriting } from '../lib/news-pipeline-policy';
import { getTVWatchProvidersEvidence } from '../lib/tmdb-watch-providers';

test('preflight saves writing only when both evidence channels are confirmed empty', () => {
  const base = { title: 'Example Show begins filming', sourceText: 'The series starts production next month.', germanProviders: [] };
  assert.equal(shouldRejectNewsBeforeWriting({ ...base, germanCatalogConfirmed: true }), true);
  assert.equal(shouldRejectNewsBeforeWriting({ ...base, germanCatalogConfirmed: false }), false,
    'a TMDB outage is not proof of absent German distribution');
  assert.equal(shouldRejectNewsBeforeWriting({ ...base, germanCatalogConfirmed: true, germanProviders: ['Netflix'] }), false);
  assert.equal(shouldRejectNewsBeforeWriting({ ...base, sourceText: 'The series starts production in Germany.', germanCatalogConfirmed: true }), false);
  assert.equal(shouldRejectNewsBeforeWriting({ ...base, sourceText: 'The series will premiere worldwide.', germanCatalogConfirmed: true }), false);
});

test('automatic Germany preflight precedes all expensive creation and review calls', () => {
  const source = readFileSync(new URL('../scripts/pipeline-v2.ts', import.meta.url), 'utf8');
  const preflight = source.indexOf("shouldRejectNewsBeforeWriting({");
  assert.ok(preflight > 0);
  for (const call of ['await extractFacts(', 'await generateStructuredContent(', 'await reviewAndRepairArticle(']) {
    assert.ok(source.indexOf(call) > preflight, `${call} must follow the preflight`);
  }
  assert.match(source.slice(preflight - 100, preflight), /trigger !== 'manual'/);
});

test('a platform brand or generic global claim is not a Germany-release signal', () => {
  assert.equal(hasPotentialOriginalGermanyEvidence('Netflix unveils Example Show', 'Netflix is a global company. UK release only.'), false);
  assert.equal(hasPotentialOriginalGermanyEvidence('Example Show', 'The show will launch globally next month.'), false,
    'global alone is not the worldwide release wording accepted by final review');
  assert.equal(hasPotentialOriginalGermanyEvidence('Example Show', 'The show will be available worldwide next month.'), true);
  assert.equal(hasPotentialOriginalGermanyEvidence('Example Show', 'Für Deutschland ist ein Start angekündigt.'), true);
});

test('a missing DE catalogue result differs from an unavailable TMDB lookup', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.TMDB_API_KEY;
  process.env.TMDB_API_KEY = 'test-only';
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ id: 123, results: { US: { link: 'https://example.com' } } }), { status: 200 });
    assert.deepEqual(await getTVWatchProvidersEvidence(123), { confirmed: true, providers: null });

    globalThis.fetch = async () => new Response(JSON.stringify({ id: 123, results: { DE: { link: 'https://example.com', flatrate: [] } } }), { status: 200 });
    const found = await getTVWatchProvidersEvidence(123);
    assert.equal(found.confirmed, true);
    assert.ok(found.providers);

    globalThis.fetch = async () => new Response('{}', { status: 503 });
    assert.deepEqual(await getTVWatchProvidersEvidence(123), { confirmed: false, providers: null });
    globalThis.fetch = async () => new Response('{', { status: 200 });
    assert.deepEqual(await getTVWatchProvidersEvidence(123), { confirmed: false, providers: null });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.TMDB_API_KEY;
    else process.env.TMDB_API_KEY = originalKey;
  }
});
