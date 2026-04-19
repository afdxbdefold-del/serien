/**
 * Verifies that the classifier retry logic survives transient proxy errors
 * and correctly classifies real-world article stubs.
 *
 * Run: npx tsx scripts/test-classifier-retry.ts
 */

import { classifyContent, shouldSkipArticle } from '../lib/content-classifier';

type Case = {
  name: string;
  title: string;
  url: string;
  text: string;
  expect: string[]; // allowed content_types
};

const CASES: Case[] = [
  {
    name: 'Single-series news (Stranger Things)',
    title: 'Stranger Things Season 5: Netflix reveals official release date',
    url: 'https://example.com/stranger-things-s5',
    text: 'Netflix has officially announced that Stranger Things Season 5 will premiere in 2025. The streamer confirmed the news during a press event, also revealing that the final season will consist of eight episodes. Creators the Duffer Brothers promise an epic conclusion to the Hawkins saga.',
    expect: ['SINGLE_SERIES_NEWS'],
  },
  {
    name: 'Multi-series listicle',
    title: 'Top 10 Netflix Crime Series You Must Watch in 2025',
    url: 'https://example.com/top-10-crime',
    text: 'From Ozark to Mindhunter, Narcos to The Watcher, Netflix has built a formidable catalogue of crime dramas. Here are our top ten picks that every true crime fan should binge this year. Breaking Bad veterans will also enjoy Better Call Saul.',
    expect: ['MULTI_SERIES_EDITORIAL'],
  },
  {
    name: 'Celebrity favourites (multi-series)',
    title: "Steven Spielberg's All-Time Favorite TV Shows Revealed",
    url: 'https://example.com/spielberg-favs',
    text: 'In a recent interview, Steven Spielberg named Mad Men, Band of Brothers and The Sopranos as the three TV series that shaped his taste in modern storytelling. He also praised Breaking Bad for its cinematic ambition.',
    expect: ['MULTI_SERIES_EDITORIAL'],
  },
  {
    name: 'Movie (must be rejected)',
    title: 'Dune Part Three: Denis Villeneuve confirms start of production',
    url: 'https://example.com/dune-3',
    text: 'Director Denis Villeneuve has confirmed that production on Dune Part Three will start next year. The film will adapt Frank Herbert\'s novel Dune Messiah and reunite Timothée Chalamet and Zendaya.',
    expect: ['MOVIE', 'MIXED'],
  },
  {
    name: 'Generic title with series name in text',
    title: "Netflix's New Crime Thriller Is Already a Global Hit",
    url: 'https://example.com/harry-hole',
    text: 'Based on Jo Nesbø\'s Harry Hole novels, the show follows detective Harry Hole as he hunts a serial killer in Oslo. It has already topped Netflix\'s global top 10 in its first week.',
    expect: ['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL'],
  },
];

async function main() {
  console.log('🧪 Classifier retry verification');
  console.log(`   Running ${CASES.length} real-world cases…\n`);

  const started = Date.now();
  let passed = 0;
  let failed = 0;

  for (const c of CASES) {
    const t0 = Date.now();
    try {
      const res = await classifyContent(c.title, c.url, c.text);
      const dur = Date.now() - t0;
      const ok = c.expect.includes(res.content_type);
      const skip = shouldSkipArticle(res);

      console.log(`${ok ? '✅' : '❌'} [${dur}ms] ${c.name}`);
      console.log(`   got=${res.content_type}  conf=${res.confidence}  primary=${res.primary_series || '—'}  skip=${skip}`);
      if (!ok) {
        console.log(`   expected: ${c.expect.join(' | ')}`);
        console.log(`   reason:   ${res.reasoning}`);
        failed++;
      } else {
        passed++;
      }
    } catch (err: any) {
      console.log(`❌ [err]  ${c.name} — ${err?.message}`);
      failed++;
    }
    console.log('');
  }

  const dur = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n📊 Summary: ${passed}/${CASES.length} passed  (${dur}s total)`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
