/**
 * Tests for NewsArticle Schema fixes (Feb 2026 — Schema.org Critical Errors):
 *  - `about` inlined as full TVSeries entity (not dangling @id reference)
 *  - `image.author` inlined as Organization (not bare @id)
 *  - `dateModified` suppressed when within 60 s of datePublished
 *
 * Run: npx tsx scripts/test-schema-newsarticle-fixes.ts
 */
import { generateArticleSchema } from '../lib/schema-generator';

interface Case { name: string; fn: () => boolean }

const base = {
  title: 'X',
  description: 'd',
  imageUrl: 'https://example.com/x.jpg',
  imageDimensions: { width: 1920, height: 1080 },
  slug: 'x',
};

const CASES: Case[] = [
  {
    name: 'about: inlined TVSeries entity with @type + name + url',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:00Z',
        aboutSeriesSlug: 'severance',
        aboutSeriesName: 'Severance',
      });
      return s.about?.['@type'] === 'TVSeries'
        && s.about?.name === 'Severance'
        && s.about?.url === 'https://serien.de/serie/severance'
        && s.about?.['@id'] === 'https://serien.de/serie/severance#tvseries';
    },
  },
  {
    name: 'about: falls back to slug when aboutSeriesName missing',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:00Z',
        aboutSeriesSlug: 'fallback-slug',
      });
      return s.about?.name === 'fallback-slug';
    },
  },
  {
    name: 'about: omitted when aboutSeriesSlug missing',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:00Z',
      });
      return !('about' in s);
    },
  },
  {
    name: 'image.author: inlined Organization (not bare @id)',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:00Z',
        publisher: { name: 'serien.de' },
      });
      const author = s.image?.author;
      return author?.['@type'] === 'Organization'
        && author?.name === 'serien.de'
        && author?.['@id'] === 'https://serien.de#organization';
    },
  },
  {
    name: 'dateModified: SUPPRESSED when identical to datePublished',
    fn: () => {
      const ts = '2026-02-27T10:00:00Z';
      const s = generateArticleSchema({
        ...base,
        datePublished: ts,
        dateModified: ts,
      });
      return !('dateModified' in s);
    },
  },
  {
    name: 'dateModified: SUPPRESSED when within 60 s of datePublished',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:30Z', // +30 s
      });
      return !('dateModified' in s);
    },
  },
  {
    name: 'dateModified: EMITTED when > 60 s after datePublished',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:05:00Z', // +5 min
      });
      return s.dateModified === '2026-02-27T10:05:00Z';
    },
  },
  {
    name: 'dateModified: EMITTED unchanged when dates are unparseable',
    fn: () => {
      const s = generateArticleSchema({
        ...base,
        datePublished: 'not-a-date',
        dateModified: 'also-not-a-date',
      });
      return s.dateModified === 'also-not-a-date';
    },
  },
];

let passed = 0, failed = 0;
for (const c of CASES) {
  const ok = c.fn();
  if (ok) { console.log(`✅ ${c.name}`); passed++; }
  else { console.log(`❌ ${c.name}`); failed++; }
}
console.log(`\n${passed}/${CASES.length} passed`);
if (failed > 0) process.exit(1);
