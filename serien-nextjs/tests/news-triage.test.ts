import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClassificationInput, classifyContent, validateClassification, CLASSIFICATION_SCHEMA } from '../lib/content-classifier';
import { checkForDuplicate, validateDuplicateDecision, DUPLICATE_SCHEMA, type ExistingArticle } from '../lib/duplicate-checker';
import { parseTriageResponse, type TriageCompletion, type TriageDependencies } from '../lib/news-triage-request';

const classification = {
  content_type: 'SINGLE_SERIES_NEWS', confidence: 0.97, primary_series: 'Example Show',
  series_candidates: ['Example Show'], signals: { title: ['Example Show'], text: ['new season'] },
  reasoning: 'The source announces a new season.',
};
const decision = {
  is_duplicate: false, topic_category: 'PRODUKTION', core_event: 'Example Show starts filming',
  duplicate_of_index: null, reason: 'Filming is a new event, not the earlier renewal.', confidence: 0.94,
};
const existing: ExistingArticle[] = [{ slug: 'renewed', title: 'Example Show renewed', excerpt: 'A new season was commissioned.' }];
function completion(value: unknown): TriageCompletion { return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] }; }
const wait = async () => {};
function requestGuard(request: Parameters<NonNullable<TriageDependencies['complete']>>[0], role: 'classification' | 'deduplication') {
  assert.equal(request.model, 'gpt-6-astra');
  assert.equal(request.reasoning_effort, 'low');
  assert.equal(request.max_completion_tokens, 4096);
  for (const field of ['temperature', 'top_p', 'logprobs', 'top_logprobs', 'tools', 'tool_choice']) assert.equal(field in request, false);
  assert.equal(request.response_format?.type, 'json_schema');
  if (request.response_format?.type === 'json_schema') {
    assert.equal(request.response_format.json_schema.strict, true);
    assert.equal(request.response_format.json_schema.name, `news_${role}`);
  }
}

test('classification passes complete source through Astra without sampling or request tools', async () => {
  const source = 'Context. '.repeat(600) + 'Example Show announces a new season.';
  const result = await classifyContent('Example Show renewed', 'https://example.com/news', source, {
    wait,
    complete: async (request) => {
      requestGuard(request, 'classification');
      const user = JSON.parse(String(request.messages[1].content));
      assert.equal(user.text, source); assert.ok(user.text.length > 4000);
      assert.equal(user.text.endsWith('new season.'), true);
      return completion(classification);
    },
  });
  assert.deepEqual(result, classification);
  assert.equal(buildClassificationInput('Title', 'https://example.com', 'a'.repeat(60_000)).text.length, 60_000);
  assert.throws(() => buildClassificationInput('Title', 'https://example.com', 'a'.repeat(60_001)), /budget/);
});

test('quoted names, commas and Top 10 do not silently pre-reject a news milestone', async () => {
  let calls = 0;
  const result = await classifyContent('Example Show beats "Show One", "Show Two", "Show Three" in Top 10', 'https://example.com/chart', 'Example Show sets a new season chart record.', {
    wait, complete: async () => { calls++; return completion(classification); },
  });
  assert.equal(calls, 1); assert.equal(result.content_type, 'SINGLE_SERIES_NEWS');
});

test('classifier asks for Germany relevance and preserves UNKNOWN for foreign-local-only programming', async () => {
  const result = await classifyContent('Example Show changes its UK morning slot', 'https://example.com/local', 'Example Show is a British-only local talk show.', {
    wait, complete: async (request) => {
      const system = String(request.messages[0].content);
      assert.match(system, /Germany relevance is mandatory/);
      assert.match(system, /foreign local talk show/);
      assert.match(system, /Germany relevance unconfirmed/);
      return completion({ ...classification, content_type: 'UNKNOWN', primary_series: null, series_candidates: [],
        signals: { title: ['UK morning slot'], text: ['British-only local talk show'] },
        reasoning: 'Foreign-local-only scheduling with no concrete German audience connection.' });
    },
  });
  assert.equal(result.content_type, 'UNKNOWN');
});

test('classification refuses guessed series names and invented evidence snippets', async () => {
  for (const invalid of [
    { ...classification, primary_series: 'Unstated Adaptation', series_candidates: ['Unstated Adaptation'] },
    { ...classification, signals: { title: ['Invented title quote'], text: ['new season'] } },
  ]) {
    let calls = 0;
    await assert.rejects(classifyContent('Example Show', 'https://example.com', 'Example Show begins a new season.', {
      wait, complete: async () => { calls++; return completion(invalid); },
    }), /schema/);
    assert.equal(calls, 2);
  }
});

test('strict classification schema rejects malformed, coerced and partial payloads', () => {
  assert.equal(CLASSIFICATION_SCHEMA.additionalProperties, false);
  for (const invalid of [
    {}, null, [], { ...classification, confidence: '0.9' }, { ...classification, confidence: 2 },
    { ...classification, content_type: 'made-up' }, { ...classification, primary_series: null },
    { ...classification, series_candidates: [] }, { ...classification, reasoning: '' },
    { ...classification, signals: { title: ['okay'] } }, { ...classification, extra: 'not allowed' },
  ]) assert.throws(() => validateClassification(invalid));
  const unknown = validateClassification({ ...classification, content_type: 'UNKNOWN', primary_series: null, series_candidates: [] });
  assert.equal(unknown.primary_series, undefined);
});

test('refusal and 4xx abort without heuristic rescue or secret-bearing logs', async () => {
  for (const status of [400, 401, 403, 429]) {
    let calls = 0;
    await assert.rejects(classifyContent('Example Show', 'https://example.com', 'Netflix drama Example Show new season.', {
      wait, complete: async () => { calls++; throw Object.assign(new Error('Bearer PRIVATE_TEST_KEY postgres://PRIVATE_TEST_DB'), { status }); },
    }), (error: Error) => {
      assert.equal(error.message, `News classification provider/network unavailable (HTTP ${status})`);
      assert.equal(error.message.includes('PRIVATE_TEST'), false); return true;
    });
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(classifyContent('Example Show', 'https://example.com', 'Netflix series Example Show new season.', {
    wait, complete: async () => { calls++; return { choices: [{ finish_reason: 'stop', message: { content: null, refusal: 'PRIVATE_TEST_REFUSAL' } }] }; },
  }), /refused/);
  assert.equal(calls, 1);
});

test('incomplete or malformed output gets one bounded retry; 5xx retries once', async () => {
  let calls = 0;
  const source = 'Example Show has a new season.';
  const result = await classifyContent('Example Show', 'https://example.com', source, {
    wait, complete: async () => ++calls === 1
      ? { choices: [{ finish_reason: 'length', message: { content: JSON.stringify(classification) } }] }
      : completion(classification),
  });
  assert.equal(result.content_type, 'SINGLE_SERIES_NEWS'); assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(classifyContent('Example Show', 'https://example.com', source, {
    wait, complete: async () => { calls++; return { choices: [{ finish_reason: 'stop', message: { content: '```json\n{}\n```' } }] }; },
  }), /schema/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(classifyContent('Example Show', 'https://example.com', source, {
    wait, complete: async () => { calls++; throw { status: 503, message: 'PRIVATE_TEST_BODY' }; },
  }), /HTTP 503/);
  assert.equal(calls, 2);
});

test('duplicate check skips provider only when DB confirms no comparable publications', async () => {
  const result = await checkForDuplicate('Example Show', 'Full source.', 1, 'Example Show', {
    loadRecentArticles: async () => [], complete: async () => { throw new Error('Provider must not be used'); },
  });
  assert.equal(result.isDuplicate, false); assert.equal(result.confidence, 1);
  await assert.rejects(checkForDuplicate('Example Show', 'Source.', 1, 'Example Show', {
    loadRecentArticles: async () => { throw new Error('postgres://PRIVATE_TEST_DB'); },
  }), (error: Error) => error.message === 'News deduplication provider/network unavailable');
});

test('duplicate request preserves whole source and stored excerpts, and maps only valid indices', async () => {
  const source = 'Series background. '.repeat(100) + 'The new event is filming, not renewal.';
  const previous = [{ ...existing[0], excerpt: 'Original context. '.repeat(100) }];
  const result = await checkForDuplicate('Example Show starts filming', source, 1, 'Example Show', {
    loadRecentArticles: async () => previous, wait,
    complete: async (request) => {
      requestGuard(request, 'deduplication');
      const input = JSON.parse(String(request.messages[1].content));
      assert.equal(input.newArticle.sourceText, source);
      assert.equal(input.existingArticles[0].excerpt, previous[0].excerpt);
      return completion(decision);
    },
  });
  assert.equal(result.isDuplicate, false); assert.equal(result.duplicateOf, null);
  const duplicate = validateDuplicateDecision({ ...decision, is_duplicate: true, duplicate_of_index: 1 }, existing);
  assert.equal(duplicate.duplicateOf, 'renewed');
});

test('invalid/refused dedupe is neither a publication permission nor a permanent duplicate rejection', async () => {
  assert.equal(DUPLICATE_SCHEMA.additionalProperties, false);
  for (const bad of [
    {}, { ...decision, is_duplicate: 'false' }, { ...decision, confidence: '0.8' },
    { ...decision, topic_category: 'made-up' }, { ...decision, duplicate_of_index: 1 },
    { ...decision, is_duplicate: true, duplicate_of_index: null },
    { ...decision, is_duplicate: true, duplicate_of_index: 2 },
    { ...decision, is_duplicate: true, duplicate_of_index: 0 },
    { ...decision, is_duplicate: true, duplicate_of_index: 1.5 },
    { ...decision, reason: '' }, { ...decision, confidence: Infinity },
  ]) assert.throws(() => validateDuplicateDecision(bad, existing));
  let calls = 0;
  await assert.rejects(checkForDuplicate('Example Show', 'Full source.', 1, 'Example Show', {
    loadRecentArticles: async () => existing, wait,
    complete: async () => { calls++; return completion({}); },
  }), /schema/);
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(checkForDuplicate('Example Show', 'Full source.', 1, 'Example Show', {
    loadRecentArticles: async () => existing, wait,
    complete: async () => { calls++; return { choices: [{ finish_reason: 'content_filter', message: { content: '' } }] }; },
  }), /refused/);
  assert.equal(calls, 1);
});

test('oversized inputs fail before touching a provider or database', async () => {
  const never = async () => { throw new Error('must not call'); };
  await assert.rejects(classifyContent('Title', 'https://example.com', 'x'.repeat(60_001), { complete: never }), /budget/);
  await assert.rejects(checkForDuplicate('Title', 'x'.repeat(60_001), 1, 'Title', { complete: never, loadRecentArticles: never }), /budget/);
  assert.throws(() => parseTriageResponse({}, 'classification'), /incomplete/);
});
