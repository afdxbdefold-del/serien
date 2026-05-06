/**
 * Tests for lib/unreleased-project-filter.ts
 * Run: npx tsx scripts/test-unreleased-project.ts
 */
import { checkUnreleasedProject } from '../lib/unreleased-project-filter';

interface Case {
  name: string;
  series: any;
  sourceTitle: string;
  sourceLead: string;
  expectedSkip: boolean;
}

const CASES: Case[] = [
  {
    name: '307438 Untitled Las Vegas Casino Series — Planned, no air date',
    series: {
      name: 'Untitled Las Vegas Casino Series',
      title: 'Untitled Las Vegas Casino Series',
      status: 'Planned',
      firstAirDate: null,
      inProduction: null,
    },
    sourceTitle: 'Oscar Isaac to star in Untitled Las Vegas Casino Series for Netflix',
    sourceLead: 'Oscar Isaac is set to lead an upcoming series for Netflix...',
    expectedSkip: true,
  },
  {
    name: '289818 Untitled Berlin Noir — In Production (working title is real)',
    series: {
      name: 'Untitled Berlin Noir Series',
      title: 'Untitled Berlin Noir Series',
      status: 'In Production',
      firstAirDate: null,
      inProduction: true,
    },
    sourceTitle: 'Berlin Noir adds five new stars for Apple TV+',
    sourceLead: 'The Apple TV+ thriller Berlin Noir has cast five new actors...',
    expectedSkip: false,
  },
  {
    name: '321296 Untitled Black Rodeo Drama — Planned',
    series: {
      name: 'Untitled Black Rodeo Drama',
      status: 'Planned',
      firstAirDate: null,
    },
    sourceTitle: 'Untitled Black Rodeo Drama lands at Amazon',
    sourceLead: 'Amazon has greenlit a new drama project...',
    expectedSkip: true,
  },
  {
    name: 'Override: Source announces the official title',
    series: {
      name: 'Untitled Las Vegas Casino Series',
      status: 'Planned',
      firstAirDate: null,
    },
    sourceTitle: 'Oscar Isaac series officially titled "Sin City Stakes" — Netflix premiere',
    sourceLead: 'Netflix has officially titled the upcoming Oscar Isaac project...',
    expectedSkip: false,
  },
  {
    name: 'Normal series — pass through',
    series: {
      name: 'Stranger Things',
      status: 'Returning Series',
      firstAirDate: '2016-07-15',
    },
    sourceTitle: 'Stranger Things Staffel 5 startet im November',
    sourceLead: 'Netflix bestätigt den Termin der finalen Staffel...',
    expectedSkip: false,
  },
  {
    name: 'Untitled with firstAirDate set — series has aired',
    series: {
      name: 'Untitled NCIS Spinoff',
      status: 'Returning Series',
      firstAirDate: '2024-09-15',
    },
    sourceTitle: 'New cast announcement',
    sourceLead: 'The NCIS spinoff continues...',
    expectedSkip: false,
  },
];

let passed = 0;
let failed = 0;
for (const c of CASES) {
  const r = checkUnreleasedProject(c.series, c.sourceTitle, c.sourceLead);
  const ok = r.skip === c.expectedSkip;
  if (ok) {
    console.log(`✅ ${c.name}`);
    if (r.skip) console.log(`   → skip="${r.reason}" hit="${r.hit}"`);
    passed++;
  } else {
    console.log(`❌ ${c.name}`);
    console.log(`   expected skip=${c.expectedSkip}, got skip=${r.skip}`);
    if (r.reason) console.log(`   reason: ${r.reason}`);
    failed++;
  }
}

console.log(`\n${passed}/${CASES.length} passed`);
if (failed > 0) process.exit(1);
