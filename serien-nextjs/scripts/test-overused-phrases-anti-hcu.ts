/**
 * Tests for Anti-HCU OVERUSED_PHRASES expansion (Juni 2026).
 * Verifies that the new buzz markers from comeback/quality_praise/etc. are
 * detected by countOverusedPhrases() so the cooldown can ban them site-wide.
 *
 * Run: npx tsx scripts/test-overused-phrases-anti-hcu.ts
 */
import { OVERUSED_PHRASES, countOverusedPhrases, DISCOVER_PATTERNS } from '../lib/headline-patterns';

interface Case { headline: string; expectedLabels: string[] }

const CASES: Case[] = [
  // The exact buzz headline from production that triggered the user complaint
  { headline: 'Seit Staffel 3 reden Fans wieder über Foundation, und das aus gutem Grund', expectedLabels: ['reden wieder alle'] },

  // Comeback Buzz
  { headline: 'Kaum jemand sah das kommen: Foundation meldet sich zurück', expectedLabels: ['kaum jemand sah das kommen', 'meldet sich zurück'] },
  { headline: 'Ausgerechnet jetzt sorgt Severance wieder für Gesprächsstoff', expectedLabels: ['ausgerechnet', 'sorgt wieder für Gesprächsstoff'] },
  { headline: 'Niemand rechnete damit – doch The Bear ist wieder da', expectedLabels: ['niemand rechnete damit', 'doch noch', 'ist wieder da'].filter(l => l !== 'doch noch') },
  { headline: 'Plötzlich reden wieder alle über The Last of Us', expectedLabels: ['plötzlich', 'reden wieder alle'] },

  // Quality-Praise Buzz
  { headline: 'Warum Severance gerade so stark ankommt', expectedLabels: ['warum X gerade so stark'] },
  { headline: 'The Pitt überzeugt aktuell selbst Skeptiker', expectedLabels: ['überzeugt selbst Skeptiker'] },
  { headline: 'Kritiker feiern Foundation – und das hat Gründe', expectedLabels: ['Kritiker feiern'] },
  { headline: 'Severance trifft gerade genau den Nerv vieler Zuschauer', expectedLabels: ['trifft den Nerv'] },

  // Underrated Buzz
  { headline: 'Foundation könnte der unterschätzteste Hit des Jahres sein', expectedLabels: ['unterschätzteste Hit'] },

  // Star-Power
  { headline: 'Mark Harmon macht Navy CIS plötzlich noch interessanter', expectedLabels: ['plötzlich', 'noch interessanter'] },

  // Nostalgia Buzz
  { headline: 'Was viele über Mark Harmon bis heute nicht wissen', expectedLabels: ['was viele bis heute nicht wissen'] },
  { headline: 'Was viele über Nick Robinson und Kennedy bis heute nicht wissen', expectedLabels: ['was viele bis heute nicht wissen'] },
  { headline: 'Niemand rechnete damit – später wurde Mark Harmon Kult', expectedLabels: ['niemand rechnete damit', 'später wurde X Kult'] },
  { headline: 'Kaum zu glauben, wie lange Mark Harmon schon TV-Geschichte schreibt', expectedLabels: ['schreibt TV-Geschichte'] },
  { headline: 'Jahre später wurde Mark Harmon TV-Legende', expectedLabels: ['TV-Legende'] },

  // SOBER headlines that should NOT trigger any ban
  { headline: 'Foundation Staffel 3: Apple TV+ veröffentlicht erstes Bildmaterial', expectedLabels: [] },
  { headline: 'David Shore übernimmt Showrunner-Rolle bei Conviction', expectedLabels: [] },
  { headline: 'Achtsam Morden bekommt zweite Staffel auf Netflix', expectedLabels: [] },
];

let passed = 0, failed = 0;
for (const c of CASES) {
  const got = countOverusedPhrases(c.headline).sort();
  const exp = [...c.expectedLabels].sort();
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (ok) { console.log(`✅ "${c.headline.slice(0, 60)}..." → [${got.join(', ')}]`); passed++; }
  else {
    console.log(`❌ "${c.headline}"`);
    console.log(`   expected: [${exp.join(', ')}]`);
    console.log(`   got:      [${got.join(', ')}]`);
    failed++;
  }
}
console.log(`\n${passed}/${CASES.length} passed`);
console.log(`OVERUSED_PHRASES patterns: ${OVERUSED_PHRASES.length}`);
console.log(`DISCOVER_PATTERNS active templates: ${DISCOVER_PATTERNS.length}`);
if (failed > 0) process.exit(1);
