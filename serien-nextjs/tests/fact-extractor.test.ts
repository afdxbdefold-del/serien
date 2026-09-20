import assert from 'node:assert/strict';
import { buildFactExtractionInput, FACT_EXTRACTION_SCHEMA, parseFactExtractionResponse, safeFactExtractionError, validateExtractedFacts } from '../lib/fact-extractor';

const facts = {
  series_names: ['Example Show'], season_numbers: [3], episode_numbers: [], people_names: ['A. B. Example'],
  key_statements: ['The third season starts on September 21 in the Benelux.'],
  release_dates: ['September 21'], networks_platforms: ['HBO Max'],
};
assert.deepEqual(validateExtractedFacts(facts), facts);
assert.equal(FACT_EXTRACTION_SCHEMA.additionalProperties, false);
assert.equal(FACT_EXTRACTION_SCHEMA.required.length, 7);

const source = 'Opening context. '.repeat(300) + 'Final paragraph: the date applies only to the Benelux.';
const input = buildFactExtractionInput('The real headline', source);
assert.equal(input.title, 'The real headline', 'title and full source are distinct fields');
assert.equal(input.text, source, 'facts beyond the old 3000-character cutoff survive');
assert.ok(input.text.endsWith('only to the Benelux.'));
assert.equal(buildFactExtractionInput('Headline', 'a'.repeat(60_000)).text.length, 60_000);
assert.throws(() => buildFactExtractionInput('Headline', 'a'.repeat(60_001)), /budget/);
assert.throws(() => buildFactExtractionInput('Headline', '  '), /nonempty/);

const validChoice = { finish_reason: 'stop', message: { content: JSON.stringify(facts) } };
assert.deepEqual(parseFactExtractionResponse(validChoice), facts);
assert.throws(() => parseFactExtractionResponse({ ...validChoice, finish_reason: 'length' }), /incomplete/);
assert.throws(() => parseFactExtractionResponse({ ...validChoice, finish_reason: 'content_filter' }), /refused/);
assert.throws(() => parseFactExtractionResponse({ ...validChoice, message: { ...validChoice.message, refusal: 'No' } }), /refused/);
assert.throws(() => parseFactExtractionResponse(undefined), /empty/);
assert.throws(() => parseFactExtractionResponse({ finish_reason: 'stop', message: { content: '{"series_names":["Partial"]' } }), /invalid JSON/);
assert.throws(() => parseFactExtractionResponse({ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify(facts) + '\n```' } }), /invalid JSON/, 'native structured output is not repaired or guessed');

for (const bad of [
  null, [], {}, { ...facts, key_statements: [] }, { ...facts, key_statements: [''] },
  { ...facts, season_numbers: ['3'] }, { ...facts, season_numbers: [3.5] },
  { ...facts, episode_numbers: [-1] }, { ...facts, episode_numbers: [Infinity] },
  { ...facts, people_names: [null] }, { ...facts, release_dates: null }, { ...facts, unexpected: 'extra' },
]) assert.throws(() => validateExtractedFacts(bad));

const upstream = { status: 403, message: 'Bearer PRIVATE_TEST_KEY connection failed for postgres://PRIVATE_TEST_DB' };
assert.equal(safeFactExtractionError(upstream).message, 'Fact extraction dependency failed (HTTP 403)');
assert.equal(safeFactExtractionError(new Error(upstream.message)).message, 'Fact extraction dependency failed');
assert.ok(!safeFactExtractionError(upstream).message.includes('PRIVATE_TEST'));
assert.equal(safeFactExtractionError({ status: '403 secret' }).message, 'Fact extraction dependency failed');
console.log('✅ Fact extraction full-source, schema, fail-closed and safe-error tests passed');
