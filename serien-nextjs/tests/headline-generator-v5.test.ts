/**
 * Tests for Headline Generator v5.1
 * Integration tests against the real v5.1 scorer.
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
  const input: HeadlineGeneratorInput = {
    primarySeries: 'The Boys',
    platform: 'Prime Video',
    event: 'abgesetzt',
    eventDetail: 'Staffel 6 verliert grünes Licht',
    context: 'Rekordquoten',
    sentiment: 'negativ',
    surprise: true,
  };

  const result = generateHeadlineCandidatesV51(input);

  assert(result.rawCandidates.length >= 8, `Raw candidates: ${result.rawCandidates.length} >= 8`);
  assert(result.filteredCandidates.length >= 5, `Filtered candidates: ${result.filteredCandidates.length} >= 5`);

  // No banned phrases
  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases in filtered candidates');

  // Visible entity present in most
  const withEntity = result.filteredCandidates.filter(c => c.toLowerCase().includes('the boys'));
  assert(withEntity.length >= result.filteredCandidates.length * 0.7,
    `Entity visible in ${withEntity.length}/${result.filteredCandidates.length} (>= 70%)`);

  // Explicit event present
  const withEvent = result.filteredCandidates.filter(c =>
    /abgesetzt|gestrichen/.test(c.toLowerCase())
  );
  assert(withEvent.length >= 3, `Event words in ${withEvent.length} candidates (>= 3)`);

  // Contrast candidate exists
  const hasContrast = result.filteredCandidates.some(c =>
    /trotz|erst.*jetzt|niemand|gegen alle/i.test(c)
  );
  assert(hasContrast, 'At least one contrast candidate exists');

  // Top candidates score solidly
  assert(result.topCandidates.length >= 3, `Top candidates: ${result.topCandidates.length} >= 3`);
  
  const bestScore = result.topCandidates[0]?.finalScore || 0;
  assert(bestScore >= 55, `Best score: ${bestScore} >= 55 (solid range)`);

  // Winner exists
  assert(result.recommendedWinner !== null, 'Recommended winner exists');
  if (result.recommendedWinner) {
    assert(result.recommendedWinner.finalScore >= 50, `Winner score: ${result.recommendedWinner.finalScore} >= 50`);
  }

  console.log(`  📊 Top 3:`);
  result.topCandidates.slice(0, 3).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 2: Positive renewal
// ============================================================
console.log('\n━━━ TEST 2: Positive renewal (Wednesday verlängert) ━━━');
{
  const input: HeadlineGeneratorInput = {
    primarySeries: 'Wednesday',
    platform: 'Netflix',
    event: 'verlängert',
    eventDetail: 'Staffel 3 kommt doch noch',
    sentiment: 'positiv',
    surprise: true,
  };

  const result = generateHeadlineCandidatesV51(input);

  assert(result.rawCandidates.length >= 5, `Raw candidates: ${result.rawCandidates.length} >= 5`);
  assert(result.filteredCandidates.length >= 3, `Filtered candidates: ${result.filteredCandidates.length} >= 3`);

  // No banned phrases
  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases');

  // Entity visible
  const withEntity = result.filteredCandidates.filter(c => c.toLowerCase().includes('wednesday'));
  assert(withEntity.length >= result.filteredCandidates.length * 0.6,
    `Entity visible in ${withEntity.length}/${result.filteredCandidates.length}`);

  // Positive event present
  const withEvent = result.filteredCandidates.filter(c =>
    /verlängert|bestätigt|bekommt/.test(c.toLowerCase())
  );
  assert(withEvent.length >= 2, `Positive event in ${withEvent.length} candidates (>= 2)`);

  console.log(`  📊 Top 3:`);
  result.topCandidates.slice(0, 3).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 3: Delay case
// ============================================================
console.log('\n━━━ TEST 3: Delay (House of the Dragon verschoben) ━━━');
{
  const input: HeadlineGeneratorInput = {
    primarySeries: 'House of the Dragon',
    platform: 'HBO',
    event: 'verschoben',
    eventDetail: 'Staffel 3 startet später',
    sentiment: 'negativ',
  };

  const result = generateHeadlineCandidatesV51(input);

  assert(result.rawCandidates.length >= 4, `Raw candidates: ${result.rawCandidates.length} >= 4`);

  // No banned phrases
  const hasBanned = result.filteredCandidates.some(c =>
    BANNED_PHRASES.some(bp => c.toLowerCase().includes(bp))
  );
  assert(!hasBanned, 'No banned phrases');

  // Delay event present
  const withDelay = result.filteredCandidates.filter(c =>
    /verschoben|verzögert|später/.test(c.toLowerCase())
  );
  assert(withDelay.length >= 2, `Delay event in ${withDelay.length} candidates (>= 2)`);

  console.log(`  📊 Top 3:`);
  result.topCandidates.slice(0, 3).forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}"`);
  });
}

// ============================================================
// TEST 4: Weak/generic input rejection
// ============================================================
console.log('\n━━━ TEST 4: Weak input (no event, vague context) ━━━');
{
  const input: HeadlineGeneratorInput = {
    primarySeries: 'Stranger Things',
    context: 'Gerüchte',
    sentiment: 'neutral',
  };

  const result = generateHeadlineCandidatesV51(input);

  // Should not produce tons of junk
  assert(result.rawCandidates.length <= 15, `Raw candidates: ${result.rawCandidates.length} <= 15 (not flooded)`);

  // Most should get filtered
  const weakOnes = result.scoredCandidates.filter(c => c.finalScore < 55);
  assert(weakOnes.length >= result.scoredCandidates.length * 0.5,
    `${weakOnes.length}/${result.scoredCandidates.length} score below 55 (weak input = weak output)`);

  console.log(`  📊 All scored:`);
  result.scoredCandidates.forEach((c, i) => {
    console.log(`     ${i + 1}. [${c.finalScore}] "${c.headline}" ${c.passedMinimum ? '' : '[⊘]'}`);
  });
}

// ============================================================
// TEST 5: Filtered-out reasons are populated
// ============================================================
console.log('\n━━━ TEST 5: Filter reasons populated ━━━');
{
  const input: HeadlineGeneratorInput = {
    primarySeries: 'The Boys',
    event: 'abgesetzt',
    sentiment: 'negativ',
    surprise: true,
  };

  const result = generateHeadlineCandidatesV51(input);

  // filteredOut should have entries with reasons
  if (result.filteredOut.length > 0) {
    assert(result.filteredOut.every(f => f.reason.length > 0), 'All filtered-out entries have reasons');
    console.log(`  📋 Filtered out (${result.filteredOut.length}):`);
    result.filteredOut.slice(0, 5).forEach(f => {
      console.log(`     ✗ "${f.headline}" — ${f.reason}`);
    });
  } else {
    assert(true, 'No candidates filtered out (all passed)');
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`${'═'.repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
