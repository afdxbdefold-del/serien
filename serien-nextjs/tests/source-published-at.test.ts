import { findJsonLdPublishedAt, parseSourcePublishedAt } from '../lib/source-published-at';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-12T12:00:00Z');

assert(
  parseSourcePublishedAt('2026-09-12T08:30:00Z', now)?.toISOString() === '2026-09-12T08:30:00.000Z',
  'valid RSS timestamp should parse',
);
assert(parseSourcePublishedAt('not-a-date', now) === null, 'invalid timestamp should fail');
assert(parseSourcePublishedAt('1999-12-31T23:59:59Z', now) === null, 'implausibly old timestamp should fail');
assert(parseSourcePublishedAt('2026-09-12T14:00:00Z', now) === null, 'future timestamp beyond skew should fail');

const jsonLdDate = findJsonLdPublishedAt({
  '@graph': [
    { '@type': 'WebSite', name: 'Example' },
    { '@type': 'NewsArticle', datePublished: '2026-09-12T07:00:00Z' },
  ],
}, now);
assert(jsonLdDate?.toISOString() === '2026-09-12T07:00:00.000Z', 'nested JSON-LD date should parse');

const articleDateWins = findJsonLdPublishedAt({
  '@graph': [
    { '@type': 'WebPage', datePublished: '2026-09-10T06:00:00Z' },
    { '@type': 'NewsArticle', datePublished: '2026-09-12T07:00:00Z' },
  ],
}, now);
assert(
  articleDateWins?.toISOString() === '2026-09-12T07:00:00.000Z',
  'datePublished from a non-article JSON-LD node must be ignored',
);

console.log('✅ source-published-at tests passed');
