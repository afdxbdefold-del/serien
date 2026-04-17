/**
 * Tests for Headline Generator v5.1 (with semantic deduping + delay upgrade)
 * 
 * Run: npx tsx tests/headline-generator-v5.test.ts
 */

import { generateHeadlineCandidatesV51, type HeadlineGeneratorInput } from '../lib/headline-generator-v5';

const BANNED_PHRASES = [
  'neue details', 'erste infos', 'das musst du wissen', 'so geht es weiter',
  'das steckt dahinter', 'sorgt für aufsehen', 'fans dürfen sich freuen',
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
  }
}

// ============================================================
// TEST 1: Negative cancellation
// ============================================================
console.log('\n━━━ TEST 1: Negative cancellation (The Boys abgesetzt) ━━━');
{
  const result = generateHeadlineCandidatesV51({
    primarySeries: 'The Boys',
    platform: 'Prime Video',
    event: 'abgesetzt',
    eventDetail: 'Staffel 6 verliert grünes Licht',
    context: 'Rekordquoten',
    sentiment: 'negativ',
    surprise: true,
  });

  assert(result.rawCandidates.length >= 8, `Raw candidates: ${result.rawCandidates.length} >= 8`);
  assert(result.filteredCandidates.length >= 5, `Filtered candidates: ${result.filteredCandidates.length} >= 5`);

  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases');

  const withEntity = result.filteredCandidates.filter(c => c.toLowerCase().includes('the boys'));
  assert(withEntity.length >= result.filteredCandidates.length * 0.7,
    `Entity visible: ${withEntity.length}/${result.filteredCandidates.length}`);

  const withEvent = result.filteredCandidates.filter(c => /abgesetzt|gestrichen/.test(c.toLowerCase()));
  assert(withEvent.length >= 3, `Event words: ${withEvent.length} >= 3`);

  const hasContrast = result.filteredCandidates.some(c => /trotz|erst.*jetzt|niemand|gegen alle/i.test(c));
  assert(hasContrast, 'Contrast candidate exists');

  // Cancel specificity preserved: "verliert Staffel 6" or similar detail survives
  const hasSpecificDetail = result.filteredCandidates.some(c =>
    /staffel\s*6|verliert staffel/i.test(c)
  );
  assert(hasSpecificDetail, 'Cancel specificity preserved (Staffel 6)');

  // No cancel double-expression like "gestrichen: The Boys wird gestrichen"
  const hasCancelDupe = result.filteredCandidates.some(c => {
    const lower = c.toLowerCase();
    const cancelWords = ['abgesetzt', 'gestrichen', 'eingestellt'];
    const hits = cancelWords.filter(w => {
      const first = lower.indexOf(w);
      const last = lower.lastIndexOf(w);
      return first !== -1 && first !== last; // Same word appears twice
    });
    return hits.length > 0;
  });
  assert(!hasCancelDupe, 'No cancel double-expression');

  const bestScore = result.topCandidates[0]?.finalScore || 0;
  assert(bestScore >= 55, `Best score: ${bestScore} >= 55`);

  console.log(`  📊 Top 3:`);
  result.topCandidates.slice(0, 3).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 2: Positive renewal — semantic deduping
// ============================================================
console.log('\n━━━ TEST 2: Renewal deduping (Wednesday verlängert) ━━━');
{
  const result = generateHeadlineCandidatesV51({
    primarySeries: 'Wednesday',
    platform: 'Netflix',
    event: 'verlängert',
    eventDetail: 'Staffel 3 kommt doch noch',
    sentiment: 'positiv',
    surprise: true,
  });

  assert(result.filteredCandidates.length >= 3, `Filtered: ${result.filteredCandidates.length} >= 3`);

  // KEY TEST: No candidate has "doch noch" appearing twice
  const hasDoubleDochNoch = result.filteredCandidates.some(c => {
    const lower = c.toLowerCase();
    const first = lower.indexOf('doch noch');
    if (first === -1) return false;
    const second = lower.indexOf('doch noch', first + 9);
    return second !== -1;
  });
  assert(!hasDoubleDochNoch, 'No double "doch noch" in any candidate');

  // Should have compact renewal candidates
  const compactRenewal = result.filteredCandidates.filter(c =>
    /doch noch.*verlängert|verlängert.*doch noch|bekommt staffel/i.test(c.toLowerCase())
  );
  assert(compactRenewal.length >= 1, `Compact renewal candidates: ${compactRenewal.length} >= 1`);

  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases');

  console.log(`  📊 Top 3:`);
  result.topCandidates.slice(0, 3).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 3: Delay — upgraded templates
// ============================================================
console.log('\n━━━ TEST 3: Delay upgrade (House of the Dragon verschoben) ━━━');
{
  const result = generateHeadlineCandidatesV51({
    primarySeries: 'House of the Dragon',
    platform: 'HBO',
    event: 'verschoben',
    eventDetail: 'Staffel 3 startet später',
    sentiment: 'negativ',
  });

  assert(result.filteredCandidates.length >= 5, `Filtered: ${result.filteredCandidates.length} >= 5`);

  // KEY TEST: No candidate redundantly combines "verschoben" + "startet später"
  const hasDelayDupe = result.filteredCandidates.some(c => {
    const lower = c.toLowerCase();
    return lower.includes('verschoben') && lower.includes('startet später');
  });
  assert(!hasDelayDupe, 'No "verschoben + startet später" double-expression');

  // Delay candidates are clear and not broken
  const delayCount = result.filteredCandidates.filter(c => /verschoben|später/.test(c.toLowerCase()));
  assert(delayCount.length >= 4, `Delay candidates: ${delayCount.length} >= 4`);

  // Has variety: entity-first + hook-first + platform
  const entityFirst = result.filteredCandidates.some(c => c.startsWith('House of the Dragon:'));
  const hookFirst = result.filteredCandidates.some(c => /^(plötzlich|überraschend|ausgerechnet)/i.test(c));
  const platformAngle = result.filteredCandidates.some(c => c.toLowerCase().includes('hbo'));
  assert(entityFirst, 'Has entity-first delay candidate');
  assert(hookFirst, 'Has hook-first delay candidate');
  assert(platformAngle, 'Has platform delay candidate');

  // Has Staffel reference (from eventDetail normalization)
  const hasStaffelRef = result.filteredCandidates.some(c => /staffel\s*3/i.test(c));
  assert(hasStaffelRef, 'Staffel 3 reference preserved');

  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases');

  console.log(`  📊 Top 5:`);
  result.topCandidates.slice(0, 5).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 4: Weak input — no junk flooding
// ============================================================
console.log('\n━━━ TEST 4: Weak input (no event) ━━━');
{
  const result = generateHeadlineCandidatesV51({
    primarySeries: 'Stranger Things',
    context: 'Gerüchte',
    sentiment: 'neutral',
  });

  assert(result.rawCandidates.length <= 15, `Raw: ${result.rawCandidates.length} <= 15`);

  const weakOnes = result.scoredCandidates.filter(c => c.finalScore < 55);
  const ratio = result.scoredCandidates.length > 0
    ? weakOnes.length / result.scoredCandidates.length
    : 1;
  assert(ratio >= 0.5 || result.scoredCandidates.length === 0,
    `Weak ratio: ${weakOnes.length}/${result.scoredCandidates.length}`);
}

// ============================================================
// TEST 5: No broken cleanup output
// ============================================================
console.log('\n━━━ TEST 5: No broken headlines ━━━');
{
  // Run all test cases and check for artifacts
  const inputs: HeadlineGeneratorInput[] = [
    { primarySeries: 'The Boys', event: 'abgesetzt', sentiment: 'negativ', surprise: true },
    { primarySeries: 'Wednesday', event: 'verlängert', eventDetail: 'Staffel 3 kommt doch noch', sentiment: 'positiv', surprise: true },
    { primarySeries: 'House of the Dragon', event: 'verschoben', eventDetail: 'Staffel 3 startet später', platform: 'HBO', sentiment: 'negativ' },
  ];

  let brokenCount = 0;
  let totalChecked = 0;

  for (const input of inputs) {
    const result = generateHeadlineCandidatesV51(input);
    for (const c of result.filteredCandidates) {
      totalChecked++;
      // Check for artifacts
      if (/:\s*$/.test(c)) { brokenCount++; console.log(`     BROKEN trailing colon: "${c}"`); }
      if (/–\s*$/.test(c)) { brokenCount++; console.log(`     BROKEN trailing dash: "${c}"`); }
      if (/\s{2,}/.test(c)) { brokenCount++; console.log(`     BROKEN double space: "${c}"`); }
      if (/:{2,}/.test(c)) { brokenCount++; console.log(`     BROKEN double colon: "${c}"`); }
      if (c.length < 15) { brokenCount++; console.log(`     BROKEN too short: "${c}"`); }
    }
  }

  assert(brokenCount === 0, `No broken headlines in ${totalChecked} candidates`);
}

// ============================================================
// TEST 6: Filter reasons populated
// ============================================================
console.log('\n━━━ TEST 6: Filter reasons populated ━━━');
{
  const result = generateHeadlineCandidatesV51({
    primarySeries: 'The Boys',
    event: 'abgesetzt',
    sentiment: 'negativ',
    surprise: true,
  });

  if (result.filteredOut.length > 0) {
    assert(result.filteredOut.every(f => f.reason.length > 0), 'All filtered-out have reasons');
    console.log(`  📋 Filtered (${result.filteredOut.length}):`);
    result.filteredOut.slice(0, 3).forEach(f => console.log(`     ✗ "${f.headline}" — ${f.reason}`));
  } else {
    assert(true, 'No candidates filtered (all passed)');
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
