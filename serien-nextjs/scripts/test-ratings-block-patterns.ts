/* eslint-disable */
/**
 * Quick smoke for the Ratings-news URL-pattern blockers added in
 * scripts/pipeline-v2.ts (Step 2 — NON_TV_URL_PATTERNS).
 *
 * Run: npx tsx scripts/test-ratings-block-patterns.ts
 *
 * Verifies:
 *   1. Known-bad ratings/Nielsen URLs + headlines → BLOCKED (positive cases)
 *   2. Legitimate series news that *mentions* "Zuschauer", "Quote" etc.
 *      → NOT blocked (negative cases — guards against false positives that
 *      would kill the 240 legitimate "Zuschauer"-articles).
 */

const RATINGS_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(?:tv|television|cable|broadcast|streaming|primetime|weekly|nightly|sunday|monday|tuesday|wednesday|thursday|friday|saturday)[\s-]*ratings\b/i, label: 'tv-ratings' },
  { re: /\bratings[\s-]*(?:report|recap|roundup|winner|loser|drop|jump|surge|slide|breakdown|wrap|race|war|battle|king|queen|crown|champion|hit|dud|disaster|flop|update|day|news|tracker|tracker)/i, label: 'tv-ratings' },
  { re: /\b(?:live[\s-]*\+[\s-]*[37]|l\+sd|l\+3|l\+7|live[\s-]*plus[\s-]*(?:three|seven)|nielsen|household[\s-]*ratings?|key[\s-]*demo|adults?[\s-]*18[\s-]*-[\s-]*49|18[\s-]*-[\s-]*49[\s-]*demo|demo[\s-]*ratings?|total[\s-]*viewers?)\b/i, label: 'nielsen-ratings' },
  { re: /\b(?:einschaltquot|tv-quote|tv[\s-]*bilanz|quotensieger|quotenrekord|quoten[\s-]*(?:hit|flop|sieg|bombe|krone|krise|könig|king|queen|erfolg)|marktanteil)/i, label: 'de-einschaltquoten' },
  { re: /\b(?:tops?[\s-]+and[\s-]+flops?|top[\s-]+rated|rating[\s-]*report|how[\s-]*[a-z\s-]{1,30}[\s-]*performed[\s-]*(?:on|with|in)[\s-]*(?:tv|its[\s-]*premiere|the[\s-]*ratings))/i, label: 'tv-ratings' },
];

interface TestCase { input: string; shouldBlock: boolean; reason?: string }

const POSITIVES: TestCase[] = [
  { input: 'tvinsider.com/1234/tuesday-ratings-may-13-the-rookie-falls-amid-dancing-with-the-stars-finale/ Tuesday Ratings: The Rookie Falls', shouldBlock: true },
  { input: 'tvinsider.com/sunday-ratings-young-sheldon-thursday-nfl Sunday Ratings: Young Sheldon Dominates', shouldBlock: true },
  { input: 'deadline.com weekly ratings recap: tracker for the week', shouldBlock: true },
  { input: 'deadline.com ratings winner: matlock crowned drama king', shouldBlock: true },
  { input: 'variety.com nielsen ratings report: chicago fire surges', shouldBlock: true },
  { input: 'TV Ratings Race War: How NBC won the night', shouldBlock: true },
  { input: 'live+3 ratings: NCIS hits 7.5 million viewers', shouldBlock: true },
  { input: 'total viewers for grey\'s anatomy season finale', shouldBlock: true },
  { input: 'loki einschaltquoten: wie schlägt sich der gott des unheils', shouldBlock: true },
  { input: 'Marktanteil-Rekord für Tatort am Sonntagabend', shouldBlock: true },
  { input: 'Quoten-Hit: Dateline lässt 20/20 hinter sich', shouldBlock: true },
  { input: 'TV-Bilanz der Woche: Quotensieger im Überblick', shouldBlock: true },
  { input: 'How The Rookie performed in its premiere ratings', shouldBlock: true },
  { input: 'Sunday Ratings: 60 Minutes wins night with 4.5 million', shouldBlock: true },
];

const NEGATIVES: TestCase[] = [
  { input: 'Why the Es - Welcome to Derry finale stunned viewers', shouldBlock: false, reason: 'Zuschauer is legitimate German storytelling vocab' },
  { input: 'Warum das Ghosts-Finale Zuschauer so überrascht hat', shouldBlock: false },
  { input: 'Stranger Things season 5: when is it coming back', shouldBlock: false },
  { input: 'The Bachelor renewed for season 30', shouldBlock: false },
  { input: 'Why For All Mankind splits critics and audiences', shouldBlock: false },
  { input: 'Why The Pitt is HBO\'s strongest medical drama yet', shouldBlock: false },
  { input: 'Off Campus startet heute: Staffel 2 ist schon bestätigt', shouldBlock: false },
  { input: 'Cat\'s Eyes erreicht ein Publikum, das Anime-Fans vergessen hatten', shouldBlock: false, reason: '"Publikum" must not match' },
  { input: 'demo says new audiences are loving Hijack', shouldBlock: false, reason: '"demo" alone in marketing context — must not match' },
];

function check(s: string): { blocked: boolean; label?: string } {
  for (const { re, label } of RATINGS_PATTERNS) {
    if (re.test(s)) return { blocked: true, label };
  }
  return { blocked: false };
}

let pass = 0; let fail = 0;
console.log('\n--- POSITIVES (should block) ---');
for (const t of POSITIVES) {
  const r = check(t.input);
  const ok = r.blocked === t.shouldBlock;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  blocked=${r.blocked}${r.label ? `(${r.label})` : ''}  "${t.input.slice(0, 70)}"`);
}
console.log('\n--- NEGATIVES (should pass through) ---');
for (const t of NEGATIVES) {
  const r = check(t.input);
  const ok = r.blocked === t.shouldBlock;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  blocked=${r.blocked}${r.label ? `(${r.label})` : ''}  "${t.input.slice(0, 70)}"`);
}
console.log(`\nTotal: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
