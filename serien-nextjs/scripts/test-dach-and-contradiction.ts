/**
 * Smoke tests for DACH gate + headline contradiction.
 * Run: npx ts-node --transpile-only scripts/test-dach-and-contradiction.ts
 */
import { checkDachAvailability } from '../lib/dach-availability';
import { detectHeadlineContradiction } from '../lib/headline-contradiction';

let pass = 0;
let fail = 0;

function expect(label: string, condition: boolean, hint?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${hint ? ' — ' + hint : ''}`);
    fail++;
  }
}

console.log('\n=== DACH-Availability Gate ===\n');

{
  const r = checkDachAvailability(['ABC'], 'https://www.deadline.com/abc-renewed');
  expect(`ABC-only series → blocked`, !r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['NBC', 'Peacock']);
  expect(`NBC+Peacock (no DACH home) → blocked`, !r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['ABC', 'Hulu']);
  // Hulu isn't on our DACH list, but ABC will trigger US-linear block. Should block.
  expect(`ABC+Hulu (US only) → blocked`, !r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['Netflix']);
  expect(`Netflix → available`, r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['HBO', 'HBO Max']);
  expect(`HBO Max → available`, r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['ABC', 'Disney+']);
  // Disney+ should win (DACH match comes first in the loop)
  expect(`ABC + Disney+ → available (Disney+ wins)`, r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability([], 'https://tvline.com/abc-pickup-shifting-gears', 'ABC renewal');
  expect(`empty networks + ABC URL → blocked`, !r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability([], 'https://variety.com/netflix-orders-something', 'Netflix orders');
  expect(`empty networks + Netflix URL → available`, r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['ARD']);
  expect(`ARD → available`, r.available, JSON.stringify(r));
}
{
  const r = checkDachAvailability(['BBC One']);
  // BBC One is not in our US_LINEAR_ONLY list; UK-only is handled elsewhere.
  expect(`BBC One → passes DACH check (UK handled by SKIP_KEYWORDS)`, r.available, JSON.stringify(r));
}

console.log('\n=== Headline ↔ Body Contradiction ===\n');

{
  const r = detectHeadlineContradiction(
    'Shifting Gears überrascht mit ABC-Renewal',
    'Die Verlängerung kommt nicht überraschend, sie war seit Wochen erwartet worden.',
  );
  expect(`"überrascht" vs "war erwartet" → contradicted`, r.contradicted, JSON.stringify(r));
}
{
  const r = detectHeadlineContradiction(
    'Stranger Things kehrt zurück',
    'Die finale Staffel bekommt im November ihren Start auf Netflix.',
  );
  expect(`"kehrt zurück" + neutral body → no contradiction`, !r.contradicted, JSON.stringify(r));
}
{
  const r = detectHeadlineContradiction(
    'Wednesday abgesetzt nach Staffel 2',
    'Netflix hat Wednesday offiziell um eine dritte Staffel verlängert.',
  );
  expect(`"abgesetzt" vs "verlängert" → contradicted`, r.contradicted, JSON.stringify(r));
}
{
  const r = detectHeadlineContradiction(
    'Plötzliche Wende bei The Bear Staffel 4',
    'Die Wendung wurde bereits in der vergangenen Staffel angedeutet und galt als sicher.',
  );
  expect(`"plötzlich" vs "galt als sicher" → contradicted`, r.contradicted, JSON.stringify(r));
}
{
  const r = detectHeadlineContradiction(
    'House of the Dragon: Staffel 3 bestätigt',
    'HBO hat den Start der Produktion offiziell verkündet.',
  );
  expect(`"bestätigt" + offizielle Bestätigung im Body → no contradiction`, !r.contradicted, JSON.stringify(r));
}
{
  const r = detectHeadlineContradiction(
    'Rückkehr von Walter White angekündigt',
    'Bryan Cranston bestätigte: er kehrt nicht zurück, das Kapitel ist abgeschlossen.',
  );
  expect(`"Rückkehr" vs "kehrt nicht zurück" → contradicted`, r.contradicted, JSON.stringify(r));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
