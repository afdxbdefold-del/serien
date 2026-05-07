/**
 * Tests for schema-generator.ts changes (Feb 2026):
 *  - articleBody, isBasedOn, name in NewsArticle
 *  - getImageDimensions: TMDB sized URLs, Nano-Banana, defaults
 * Run: npx tsx scripts/test-schema-discover-fix.ts
 */
import { generateArticleSchema, getImageDimensions } from '../lib/schema-generator';

interface Case {
  name: string;
  fn: () => boolean;
}

const CASES: Case[] = [
  {
    name: 'NewsArticle: articleBody truncated to 5000 chars',
    fn: () => {
      const longBody = 'A'.repeat(7000);
      const s = generateArticleSchema({
        title: 'X',
        description: 'd',
        imageUrl: 'https://example.com/x.jpg',
        imageDimensions: { width: 1920, height: 1080 },
        datePublished: '2026-02-27T10:00:00Z',
        dateModified: '2026-02-27T10:00:00Z',
        slug: 'x',
        articleBody: longBody,
      });
      return s.articleBody === 'A'.repeat(5000);
    },
  },
  {
    name: 'NewsArticle: articleBody omitted when undefined',
    fn: () => {
      const s = generateArticleSchema({
        title: 'X', description: 'd', imageUrl: 'https://example.com/x.jpg',
        imageDimensions: { width: 1920, height: 1080 },
        datePublished: '2026-02-27T10:00:00Z', dateModified: '2026-02-27T10:00:00Z',
        slug: 'x',
      });
      return !('articleBody' in s);
    },
  },
  {
    name: 'NewsArticle: isBasedOn set when sourceUrl is http(s)',
    fn: () => {
      const s = generateArticleSchema({
        title: 'X', description: 'd', imageUrl: 'https://example.com/x.jpg',
        imageDimensions: { width: 1920, height: 1080 },
        datePublished: '2026-02-27T10:00:00Z', dateModified: '2026-02-27T10:00:00Z',
        slug: 'x',
        sourceUrl: 'https://variety.com/article/example',
      });
      return Array.isArray(s.isBasedOn)
        && s.isBasedOn.length === 1
        && s.isBasedOn[0]['@type'] === 'NewsArticle'
        && s.isBasedOn[0].url === 'https://variety.com/article/example';
    },
  },
  {
    name: 'NewsArticle: isBasedOn omitted for non-http sourceUrl',
    fn: () => {
      const s = generateArticleSchema({
        title: 'X', description: 'd', imageUrl: 'https://example.com/x.jpg',
        imageDimensions: { width: 1920, height: 1080 },
        datePublished: '2026-02-27T10:00:00Z', dateModified: '2026-02-27T10:00:00Z',
        slug: 'x',
        sourceUrl: 'invalid-url',
      });
      return !('isBasedOn' in s);
    },
  },
  {
    name: 'NewsArticle: name == headline (aggregator fallback)',
    fn: () => {
      const s = generateArticleSchema({
        title: 'My Headline', description: 'd', imageUrl: 'https://example.com/x.jpg',
        imageDimensions: { width: 1920, height: 1080 },
        datePublished: '2026-02-27T10:00:00Z', dateModified: '2026-02-27T10:00:00Z',
        slug: 'x',
      });
      return s.name === 'My Headline' && s.headline === 'My Headline';
    },
  },
  {
    name: 'getImageDimensions: TMDB w1280 → 1280×720',
    fn: () => {
      const d = getImageDimensions('https://image.tmdb.org/t/p/w1280/abc.jpg');
      return d.width === 1280 && d.height === 720;
    },
  },
  {
    name: 'getImageDimensions: TMDB original → 1920×1080',
    fn: () => {
      const d = getImageDimensions('https://image.tmdb.org/t/p/original/abc.jpg');
      return d.width === 1920 && d.height === 1080;
    },
  },
  {
    name: 'getImageDimensions: Nano-Banana blob → 1536×1024',
    fn: () => {
      const d = getImageDimensions('https://buf.public.blob.vercel-storage.com/nano-banana/12345-hero.jpg');
      return d.width === 1536 && d.height === 1024;
    },
  },
  {
    name: 'getImageDimensions: /img/og/ → 1200×630',
    fn: () => {
      const d = getImageDimensions('https://serien.de/img/og/tv/123');
      return d.width === 1200 && d.height === 630;
    },
  },
  {
    name: 'getImageDimensions: /img/hero/ → 1600×900',
    fn: () => {
      const d = getImageDimensions('https://serien.de/img/hero/tv/123');
      return d.width === 1600 && d.height === 900;
    },
  },
  {
    name: 'getImageDimensions: /img/processed/ → 1920×1080',
    fn: () => {
      const d = getImageDimensions('https://serien.de/img/processed/abc.jpg');
      return d.width === 1920 && d.height === 1080;
    },
  },
  {
    name: 'getImageDimensions: unknown URL → 1920×1080 (Discover-safe default)',
    fn: () => {
      const d = getImageDimensions('https://random.example.com/hero.jpg');
      return d.width === 1920 && d.height === 1080;
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
