/**
 * Tests for lib/usd-to-eur-converter.ts
 * Run: npx tsx scripts/test-usd-to-eur.ts
 */
import { convertUsdMentions, niceRound, EUR_PER_USD } from '../lib/usd-to-eur-converter';

interface Case {
  name: string;
  input: string;
  expectedContains?: string[];
  expectedNotContains?: string[];
  expectedConversions?: number;
}

console.log(`Using EUR_PER_USD = ${EUR_PER_USD}\n`);

const CASES: Case[] = [
  {
    name: '300 Millionen Dollar → ~275 Millionen Euro',
    input: 'Die Serie kostete 300 Millionen Dollar.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: '50 Millionen Dollar → ~45 Millionen Euro',
    input: 'Pro Folge ca. 50 Millionen Dollar.',
    expectedContains: ['rund 45 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: '1 Milliarde Dollar → ~1 Milliarde Euro',
    input: 'Insgesamt mehr als 1 Milliarde Dollar.',
    expectedContains: ['rund 920 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: '1.2 Milliarden Dollar → ~1.1 Milliarden Euro',
    input: 'Apple zahlt 1,2 Milliarden Dollar.',
    expectedContains: ['rund 1,1 Milliarden Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: '$300M → ~275 Millionen Euro',
    input: 'Budget: $300M.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedNotContains: ['$'],
    expectedConversions: 1,
  },
  {
    name: '$1.5 billion → ~1.4 Milliarden Euro',
    input: 'Total budget: $1.5 billion across the franchise.',
    expectedContains: ['rund 1,4 Milliarden Euro'],
    expectedNotContains: ['$'],
    expectedConversions: 1,
  },
  {
    name: 'Multiple mentions in one text',
    input: 'Staffel 1 kostete 300 Millionen Dollar, Staffel 2 etwa 250 Millionen Dollar.',
    expectedContains: ['rund 275 Millionen Euro', 'rund 230 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 2,
  },
  {
    name: 'Approximator consumed (no doppel-rund)',
    input: 'Rund 300 Millionen Dollar verschlingt die Produktion.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedNotContains: ['Rund rund', 'rund rund'],
    expectedConversions: 1,
  },
  {
    name: 'No-mention text untouched',
    input: 'The Boys kehrt im Herbst zurück bei Prime Video.',
    expectedContains: ['Prime Video'],
    expectedNotContains: ['Euro', 'rund'],
    expectedConversions: 0,
  },
  {
    name: 'Idempotent: converted text passes through unchanged',
    input: 'Die Serie kostete rund 275 Millionen Euro.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedConversions: 0,
  },
  {
    name: 'US-Dollar variant',
    input: 'Insgesamt 50 Millionen US-Dollar pro Folge.',
    expectedContains: ['rund 45 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Mio. Abkürzung',
    input: 'Budget: 300 Mio. Dollar.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedConversions: 1,
  },
  {
    name: 'Citadel real-world sentence',
    input: 'Für eine Serie, deren erste Staffel rund 300 Millionen Dollar kostete, ist das ein weiteres Zeichen.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Approximator with umlaut: "über 50 Millionen Dollar"',
    input: 'Geschätzte Kosten von über 50 Millionen Dollar pro Folge.',
    expectedContains: ['rund 45 Millionen Euro'],
    expectedNotContains: ['über 50', 'Dollar', 'über rund'],
    expectedConversions: 1,
  },
  {
    name: '"eine Milliarde Dollar" → ~920 Millionen Euro',
    input: 'Amazon hat insgesamt mehr als eine Milliarde Dollar ausgegeben.',
    expectedContains: ['rund 920 Millionen Euro'],
    expectedNotContains: ['Dollar', 'Milliarde Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Hyphenated compound: "300-Millionen-Budget"',
    input: 'Kinoeinsatz und 300-Millionen-Budget inklusive.',
    expectedContains: ['275-Millionen-Euro-Budget'],
    expectedNotContains: ['Dollar', '300-Millionen'],
    expectedConversions: 1,
  },
  {
    name: 'Hyphenated compound: "50-Mio-Deal"',
    input: 'Apple unterzeichnete einen 50-Mio-Deal.',
    expectedContains: ['45-Millionen-Euro-Deal'],
    expectedConversions: 1,
  },
  {
    name: 'Cleanup residue: "über rund 45 Millionen Euro" (idempotent fix)',
    input: 'Kosten von über rund 45 Millionen Euro pro Folge.',
    expectedContains: ['rund 45 Millionen Euro'],
    expectedNotContains: ['über rund'],
    expectedConversions: 0,
  },
  {
    name: 'Approximator "schätzungsweise"',
    input: 'Schätzungsweise 300 Millionen Dollar.',
    expectedContains: ['rund 275 Millionen Euro'],
    expectedNotContains: ['Schätzungsweise', 'schätzungsweise rund'],
    expectedConversions: 1,
  },
  {
    name: 'German number-word: "sechs Millionen Dollar"',
    input: 'Aber Herschel will sechs Millionen Dollar.',
    expectedContains: ['rund 5,5 Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'German number-word: "drei Milliarden Dollar"',
    input: 'die drei Milliarden Dollar schwere Industrie',
    expectedContains: ['rund 2,8 Milliarden Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'German number-word: "acht Millionen US-Dollar"',
    input: 'Kasseneinnahmen von über acht Millionen US-Dollar',
    expectedContains: ['rund 7,5 Millionen Euro'],
    expectedNotContains: ['Dollar', 'über rund'],
    expectedConversions: 1,
  },
  {
    name: 'German compound number: "sechshunderttausend Dollar"',
    input: 'Carlton schuldet sechshunderttausend Dollar.',
    expectedContains: ['Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Hyphenated Dollar-compound: "200-Millionen-Dollar-Actionthriller"',
    input: 'einen weiteren 200-Millionen-Dollar-Actionthriller in der Pipeline',
    expectedContains: ['185-Millionen-Euro-Actionthriller'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Qualitative quantifier: "Hunderte von Millionen Dollar"',
    input: 'Filme spielen Hunderte von Millionen Dollar ein.',
    expectedContains: ['Hunderte Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
  {
    name: 'Qualitative quantifier: "mehreren Millionen Dollar"',
    input: 'Häuser im Wert von mehreren Millionen Dollar.',
    expectedContains: ['mehreren Millionen Euro'],
    expectedNotContains: ['Dollar'],
    expectedConversions: 1,
  },
];

let passed = 0, failed = 0;
for (const c of CASES) {
  const r = convertUsdMentions(c.input);
  let ok = true;
  const issues: string[] = [];

  if (c.expectedConversions !== undefined && r.report.conversions !== c.expectedConversions) {
    ok = false;
    issues.push(`expected ${c.expectedConversions} conversions, got ${r.report.conversions}`);
  }
  for (const need of c.expectedContains || []) {
    if (!r.clean.includes(need)) {
      ok = false;
      issues.push(`missing "${need}"`);
    }
  }
  for (const forbid of c.expectedNotContains || []) {
    if (r.clean.includes(forbid)) {
      ok = false;
      issues.push(`should not contain "${forbid}"`);
    }
  }

  if (ok) {
    console.log(`✅ ${c.name}`);
    if (r.report.conversions > 0) console.log(`   → "${r.clean}"`);
    passed++;
  } else {
    console.log(`❌ ${c.name}`);
    console.log(`   input:  "${c.input}"`);
    console.log(`   output: "${r.clean}"`);
    issues.forEach(i => console.log(`   - ${i}`));
    failed++;
  }
}

console.log(`\n${passed}/${CASES.length} passed`);
if (failed > 0) process.exit(1);
