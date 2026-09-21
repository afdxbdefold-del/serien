import assert from 'node:assert/strict';
import { resolveImportSourceTitle } from '../lib/import-source-title';

const url = 'https://www.netflix.com/tudum/articles/neue-staffel';

assert.equal(
  resolveImportSourceTitle(url, { headline: 'Die echte Überschrift', title: 'Seitentitel | Netflix' }),
  'Die echte Überschrift',
  'the fetched article headline must take precedence over page title and URL',
);
assert.equal(
  resolveImportSourceTitle(url, { headline: ' \n ', title: 'Der echte Seitentitel' }),
  'Der echte Seitentitel',
  'an empty headline must fall back to the fetched page title',
);
assert.equal(
  resolveImportSourceTitle(url, { headline: '  Eine\n neue   Staffel  ' }),
  'Eine neue Staffel',
  'publisher wording and case must survive whitespace normalization',
);
assert.equal(resolveImportSourceTitle(url, {}), 'neue staffel');
assert.equal(
  resolveImportSourceTitle(`${url}/`, {}),
  'neue staffel',
  'trailing and non-trailing slash URLs must choose the same last path segment, not articles',
);
assert.equal(
  resolveImportSourceTitle('https://press-benelux.wbd.eu/post/neue-serie?utm_source=feed#details', {}),
  'neue serie',
  'query strings and fragments must not become part of the article title',
);
assert.equal(
  resolveImportSourceTitle('https://example.com/news/%C3%9Cber-die-neue_Staffel/', {}),
  'Über die neue Staffel',
  'URL fallback must decode encoded letters without artificial title casing',
);
assert.equal(
  resolveImportSourceTitle(url, { headline: 'Article', title: 'Article' }),
  'neue staffel',
  'the fetcher placeholder must not hide a usable URL slug',
);
assert.equal(
  resolveImportSourceTitle(url, { headline: 'Article', title: 'Tatsächlicher Titel' }),
  'Tatsächlicher Titel',
);
assert.equal(resolveImportSourceTitle('https://example.com/', {}), 'News Article');
assert.equal(resolveImportSourceTitle('not a URL', {}), 'News Article');
assert.equal(resolveImportSourceTitle('https://example.com/news/bad%escape', {}), 'bad%escape');

console.log('✅ import-source-title tests passed');
