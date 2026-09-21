import assert from 'node:assert/strict';
import { allowsGenericSeriesTrailer } from '../lib/article-media-policy';

for (const type of [null, undefined, '', ' ', 'NEWS', 'news', ' News ', 'UNKNOWN', 'GENERATED', 'NEWS_SINGLE', 'SINGLE_SERIES_NEWS', 'TYPO']) {
  assert.equal(allowsGenericSeriesTrailer(type), false);
}
for (const type of ['REVIEW', 'TRAILER', 'PREVIEW', 'RANKING']) {
  assert.equal(allowsGenericSeriesTrailer(type), true);
}
console.log('Article media policy tests passed');
