/**
 * Tests for lib/sammel-recap-detector.ts
 * Run: npx tsx scripts/test-sammel-recap.ts
 */
import { detectSammelRecap } from '../lib/sammel-recap-detector';

interface Case {
  name: string;
  title: string;
  url: string;
  expectedSkip: boolean;
}

const CASES: Case[] = [
  {
    name: 'TVInsider Multi-Show-Roundup with Season Finales (Plural)',
    title: '9-1-1, Grey\'s Anatomy, The Hunting Party Season Finales & The Terror Season Premiere',
    url: 'https://www.tvinsider.com/1262667/9-1-1-greys-anatomy-the-hunting-party-season-finales-the-terror-season-premiere/',
    expectedSkip: true,
  },
  {
    name: 'Single show — The Terror Season 3 Premiere',
    title: 'The Terror Season 3 Premieres on AMC',
    url: 'https://example.com/the-terror-season-3-premiere/',
    expectedSkip: false,
  },
  {
    name: 'Single show — Wednesday Staffel 3 startet',
    title: 'Wednesday Staffel 3 startet im November bei Netflix',
    url: 'https://example.com/wednesday-staffel-3-netflix-november/',
    expectedSkip: false,
  },
  {
    name: 'TVInsider Tonight\'s TV listing',
    title: 'Tonight\'s TV: 5 Shows You Don\'t Want to Miss',
    url: 'https://www.tvinsider.com/tonights-tv-monday/',
    expectedSkip: true,
  },
  {
    name: 'Weekly recap roundup',
    title: 'TV Weekend Recap: What You Missed on Sunday Night',
    url: 'https://example.com/weekend-recap/',
    expectedSkip: true,
  },
  {
    name: 'New shows this week roundup',
    title: 'New Shows This Week: 12 Premieres on Netflix, Disney+ and Apple TV+',
    url: 'https://example.com/new-shows-this-week/',
    expectedSkip: true,
  },
  {
    name: '3+ comma/ampersand show-tokens',
    title: 'Stranger Things, Wednesday & The Witcher: Netflix Top Picks',
    url: 'https://example.com/netflix-top-picks/',
    expectedSkip: true,
  },
  {
    name: 'Two-show comparison (NOT a roundup)',
    title: 'The Bear vs The Studio: Welche FX-Comedy lohnt sich?',
    url: 'https://example.com/the-bear-vs-the-studio/',
    expectedSkip: false,
  },
  {
    name: 'German "Staffelpremieren" (plural, future-proof)',
    title: 'Diese Staffel-Premieren laufen jetzt im Herbst 2026',
    url: 'https://example.com/staffel-premieren-herbst-2026/',
    expectedSkip: true,
  },
  {
    name: 'Single show finale (singular — pass)',
    title: 'Severance Season 2 Finale: Was bedeutet das Ende?',
    url: 'https://example.com/severance-season-2-finale/',
    expectedSkip: false,
  },
  {
    name: 'Series Premieres (plural)',
    title: 'Fall 2026 Series Premieres: 10 New Shows to Watch',
    url: 'https://example.com/fall-series-premieres/',
    expectedSkip: true,
  },
  {
    name: 'Short title with comma — not a roundup',
    title: 'Hacks Staffel 4 startet, Sky bestätigt',
    url: 'https://example.com/hacks-sky/',
    expectedSkip: false,
  },
];

let passed = 0, failed = 0;
for (const c of CASES) {
  const r = detectSammelRecap(c.title, c.url);
  const ok = r.isSammelRecap === c.expectedSkip;
  if (ok) {
    console.log(`✅ ${c.name}`);
    if (r.isSammelRecap) console.log(`   → reason="${r.reason}", hit="${r.hit}"`);
    passed++;
  } else {
    console.log(`❌ ${c.name}`);
    console.log(`   expected skip=${c.expectedSkip}, got skip=${r.isSammelRecap}`);
    if (r.reason) console.log(`   reason: ${r.reason}`);
    failed++;
  }
}
console.log(`\n${passed}/${CASES.length} passed`);
if (failed > 0) process.exit(1);
