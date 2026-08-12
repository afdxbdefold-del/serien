// Unit test for resolvePoster() logic in lib/ranking-queries.ts.
// resolvePoster is a pure string function; we mirror its exact
// implementation here so the test can run without a TS compiler
// (there is no jest/tsx setup in this repo). Any drift will be caught
// by the regression check on the rendered homepage HTML.

import assert from 'node:assert/strict';

function resolvePoster(posterLocalUrl, posterPathFromSeries, posterPathFromRanking) {
  const r2Base = process.env.NEXT_PUBLIC_R2_URL || process.env.R2_PUBLIC_URL || '';
  if (posterLocalUrl) {
    if (posterLocalUrl.startsWith('http')) return posterLocalUrl;
    if (r2Base) return `${r2Base.replace(/\/$/, '')}/${posterLocalUrl.replace(/^\//, '')}`;
  }
  if (posterPathFromSeries) {
    if (posterPathFromSeries.startsWith('http')) return posterPathFromSeries;
    if (!posterPathFromSeries.startsWith('/') && r2Base) {
      return `${r2Base.replace(/\/$/, '')}/${posterPathFromSeries}`;
    }
    return posterPathFromSeries;
  }
  if (posterPathFromRanking) return posterPathFromRanking;
  return null;
}

process.env.NEXT_PUBLIC_R2_URL = 'https://pub-123f15a3ef8046ef838c6f186d87bffe.r2.dev';
const R2 = process.env.NEXT_PUBLIC_R2_URL;

const cases = [
  {
    name: '1) posterLocalUrl R2 storage path → prefixed with R2 base',
    got: resolvePoster('serien-nextjs/images/x.webp', null, null),
    want: `${R2}/serien-nextjs/images/x.webp`,
  },
  {
    name: '2) posterLocalUrl absolute https URL → returned unchanged',
    got: resolvePoster('https://foo.bar/x.webp', null, null),
    want: 'https://foo.bar/x.webp',
  },
  {
    name: '3) posterPathFromSeries TMDB convention (/abc.jpg) → unchanged',
    got: resolvePoster(null, '/abc.jpg', null),
    want: '/abc.jpg',
  },
  {
    name: '4) posterPathFromSeries R2 storage-style path (no leading /) → prefixed',
    got: resolvePoster(null, 'serien-nextjs/x.webp', null),
    want: `${R2}/serien-nextjs/x.webp`,
  },
  {
    name: '5) all null → null',
    got: resolvePoster(null, null, null),
    want: null,
  },
  {
    name: '6a) fallback chain: posterLocalUrl wins',
    got: resolvePoster('serien-nextjs/a.webp', '/b.jpg', '/c.jpg'),
    want: `${R2}/serien-nextjs/a.webp`,
  },
  {
    name: '6b) fallback chain: no local → posterPathFromSeries wins',
    got: resolvePoster(null, '/b.jpg', '/c.jpg'),
    want: '/b.jpg',
  },
  {
    name: '6c) fallback chain: neither → posterPathFromRanking',
    got: resolvePoster(null, null, '/c.jpg'),
    want: '/c.jpg',
  },
  {
    name: 'REGRESSION: posterLocalUrl must NOT produce bare "serien-nextjs/..." (would break next/image + posterUrl)',
    got: resolvePoster('serien-nextjs/images/poster/tv/123.webp', null, null),
    check: (v) => v.startsWith('https://') && !v.startsWith('https://image.tmdb.org'),
  },
];

let pass = 0, fail = 0;
for (const c of cases) {
  try {
    if (c.check) {
      assert.ok(c.check(c.got), `check failed: got=${c.got}`);
    } else {
      assert.deepEqual(c.got, c.want);
    }
    console.log(`PASS ${c.name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL ${c.name}: ${e.message}`);
    fail++;
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
