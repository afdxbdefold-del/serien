import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { shouldSkipByGenre } from '../lib/genre-filter';
import { checkShowAgeCutoff } from '../lib/show-age-cutoff';
import { checkUnreleasedProject } from '../lib/unreleased-project-filter';
import { computeStoryFingerprint } from '../lib/story-fingerprint';

// Never import an executable pipeline here: it owns provider and DB clients.
const p2 = readFileSync(new URL('../scripts/pipeline-v2.ts', import.meta.url), 'utf8');
const p4 = readFileSync(new URL('../scripts/p4-yt.ts', import.meta.url), 'utf8');
const file = ts.createSourceFile('pipeline-v2.ts', p2, ts.ScriptTarget.Latest, true);
const calls: ts.CallExpression[] = [];
function visit(node: ts.Node): void {
  if (ts.isCallExpression(node)) calls.push(node);
  ts.forEachChild(node, visit);
}
visit(file);

function hasNonNewsGuard(node: ts.Node): boolean {
  for (let child = node, parent = node.parent; parent; child = parent, parent = parent.parent) {
    if (ts.isIfStatement(parent) && parent.thenStatement === child
      && parent.expression.getText(file).replace(/\s+/g, '') === "contentType!=='NEWS'") return true;
  }
  return false;
}

test('legacy genre, show-age and placeholder checks cannot veto current NEWS', () => {
  for (const name of ['shouldSkipByGenre', 'checkShowAgeCutoff', 'checkUnreleasedProject']) {
    const matches = calls.filter(call => call.expression.getText(file) === name);
    assert.equal(matches.length, 1, `${name} remains available for legacy non-news formats`);
    assert(hasNonNewsGuard(matches[0]), `${name} must not override full-source Germany relevance review`);
  }
  assert.match(p2, /await reviewAndRepairArticle\(/);
  assert.match(p2, /germanyCatalog:\s*\{\s*country: 'DE'/);
  assert.match(p2, /requiredGates: \['source-grounding'/);
  assert.match(p2, /sourceMentionsSeries\(classification\.primary_series, source\.title, fullSourceText\)/);
  assert.match(p2, /matchesResolvedSeries\(classification\.primary_series,/);
  assert.match(p2, /await checkForDuplicate\(/);
  assert.match(p2, /newsSourceIsFresh\(articleDate\)/);
});

test('fixtures explain why genre and catalogue age are not a current news verdict', () => {
  assert(shouldSkipByGenre(['Soap'], 35, { title: 'Deutsche Beispielserie' }).skip,
    'old filter has no territory input and cannot recognize German soap relevance');
  assert(shouldSkipByGenre([], 35, { title: 'Deutsche Beispielserie' }).skip,
    'missing genre metadata is not evidence of a foreign-local show');
  const fullText = 'Production background and archive context. '.repeat(30) + 'A revival is officially announced.';
  const series = { name: 'Example Show', status: 'Ended', lastAirDate: new Date('2000-01-01') };
  assert(checkShowAgeCutoff(series, 'Example Show returns', fullText.slice(0, 800)).skip);
  assert.equal(checkShowAgeCutoff(series, 'Example Show returns', fullText).skip, false,
    'old 800-character truncation could hide the actual new event');
  const untitled = { name: 'Untitled Example Series', status: 'Planned' };
  const titleReveal = 'Production background. '.repeat(50) + 'The show is now titled Example Show.';
  assert(checkUnreleasedProject(untitled, 'New series announced', titleReveal.slice(0, 800)).skip);
  assert.equal(checkUnreleasedProject(untitled, 'New series announced', titleReveal).skip, false);
});

test('lossy historical fingerprints remain diagnostic for NEWS', () => {
  const common = 'actors announce berlin camera cast confirmed drama filming location netflix production season';
  const facts = {
    series_names: ['Example Show'], people_names: [], networks_platforms: ['Netflix'],
    season_numbers: [3], episode_numbers: [], release_dates: [], key_statements: [],
  };
  const begins = computeStoryFingerprint({ ...facts, key_statements: [common + ' starts tomorrow'] });
  const ends = computeStoryFingerprint({ ...facts, key_statements: [common + ' wraps tomorrow'] });
  assert(begins && ends);
  assert.equal(begins.fingerprint, ends.fingerprint, 'top-12 alphabetic tokens discard the changed event');
  assert.match(p2, /const fingerprintHit = contentType === 'NEWS' \? null : await preFilterDuplicate/);
  assert.match(p2, /contentType === 'NEWS' \? '4\.5_fingerprint_metadata' : '4\.5_fingerprint_gate'/);
});

test('lexical overlap is visible as metadata, not an independent NEWS rejection', () => {
  const rejections = calls.filter(call => call.expression.getText(file) === 'logger.fail'
    && call.arguments.some(argument => ts.isStringLiteral(argument) && argument.text === 'plagiarism-similar-article'));
  assert.equal(rejections.length, 1);
  assert(hasNonNewsGuard(rejections[0]));
  assert.match(p2, /mode: contentType === 'NEWS' \? 'diagnostic-only' : 'legacy-hard-gate'/);
  assert.match(p2, /Textähnlichkeit allein ist kein Ereignisduplikat/);
});

test('P4 permits a fresh revival trailer draft but preserves date and release safeguards', () => {
  assert.doesNotMatch(p4, /twoYearsAgo|Serie bereits beendet/);
  assert.match(p4, /!isFreshDraftSource\(video\.publishedAt\)/);
  assert.match(p4, /sourcePublishedAt: video\.publishedAt/);
  assert.match(p4, /const releaseModeEnabled = false/);
  assert.match(p4, /gate: 'source-grounding',\s+status: 'fail'/);
  for (const [name, source] of [['p2', p2], ['p4', p4]]) {
    const compiled = ts.transpileModule(source, { fileName: `${name}.ts`, reportDiagnostics: true });
    assert.deepEqual(compiled.diagnostics, [], `${name} must parse without side effects`);
  }
});
