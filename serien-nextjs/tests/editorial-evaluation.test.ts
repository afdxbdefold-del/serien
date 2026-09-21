import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { EditorialArticle, EditorialReviewDecision } from '../lib/editorial-review';
import {
  challengeWasCaught, checkFixtureText, evaluateEditorialFixture, mutateEditorialCandidate,
  parseEvaluationOptions, validateEditorialFixtures, withMutedEvaluationLogs,
} from '../scripts/evaluation/news-editorial-harness';
import { EDITORIAL_FIXTURES, EDITORIAL_HUMAN_RUBRIC } from './fixtures/news-editorial-cases';

const sampleArticle: EditorialArticle = {
  headline: 'Testhafen setzt die Dreharbeiten fort', excerpt: 'Sechs Folgen sind bestellt.',
  metaDescription: 'Eine synthetische Testmeldung, keine Nachricht.', contentHtml: '<p>Sechs Folgen sind bestellt.</p>',
};
const reviewDecision = (article: EditorialArticle, passed: boolean, issueQuote = ''): EditorialReviewDecision => ({
  passed, reasons: passed ? [] : ['Testbefund'], payloadHash: 'test-only',
  review: {
    complete: true, newsworthy: true, verdict: passed ? 'publish' : 'revise', clarity: 4, originality: 4,
    germanyRelevance: { relevant: true, basis: 'original', evidenceQuote: 'Synthetic available in Germany.', reason: 'Nur Test für Harness-Steuerung.', newsCategory: 'series-production', localOnly: false },
    coverage: { headline: true, excerpt: true, metaDescription: true, bodyParagraphIndexes: [1] },
    issues: issueQuote ? [{ code: 'facts', reason: 'Absichtlich verfälschte Aussage', articleQuote: issueQuote }] : [],
    claims: [{ articleQuote: article.excerpt, sourceQuote: 'A fictional source passage.', source: 'original', assessment: 'supported' }],
  },
});

async function run(): Promise<void> {
  assert.equal(parseEvaluationOptions([]).live, false);
  assert.equal(parseEvaluationOptions(['--live']).live, true);
  assert.deepEqual(parseEvaluationOptions(['--case', 'normal-production']).caseIds, ['normal-production']);
  for (const invalid of [['--live=true'], ['--case'], ['--case', '--live'], ['--output-dir', 'a', '--output-dir', 'b'], ['--publish']]) {
    assert.throws(() => parseEvaluationOptions(invalid));
  }
  validateEditorialFixtures(EDITORIAL_FIXTURES);
  assert.equal(EDITORIAL_FIXTURES.length, 7);
  assert.deepEqual(new Set(EDITORIAL_FIXTURES.map(fixture => fixture.kind)), new Set(['normal', 'edge', 'adversarial']));
  assert.throws(() => validateEditorialFixtures([]));
  assert.throws(() => validateEditorialFixtures([EDITORIAL_FIXTURES[0], EDITORIAL_FIXTURES[0]]));
  assert.throws(() => validateEditorialFixtures([{ ...EDITORIAL_FIXTURES[0], sourceUrl: 'https://serien.de/a-real-article' }]));
  assert.throws(() => validateEditorialFixtures([{ ...EDITORIAL_FIXTURES[0], sourceText: 'too short' }]));
  assert.equal(EDITORIAL_HUMAN_RUBRIC.required, true);
  assert.equal(EDITORIAL_HUMAN_RUBRIC.criteria.find(criterion => criterion.id === 'facts')?.minimum, 5);

  for (const fixture of EDITORIAL_FIXTURES) {
    for (const check of fixture.checks) {
      assert.equal(checkFixtureText({ ...fixture, checks: [check] }, check.passes).length, 0);
      assert.deepEqual(checkFixtureText({ ...fixture, checks: [check] }, check.fails), [check.category]);
    }
    const mutated = mutateEditorialCandidate(sampleArticle, fixture);
    if (fixture.challenge.field === 'contentHtml') {
      assert(mutated.contentHtml.startsWith(sampleArticle.contentHtml));
    } else assert.equal(mutated[fixture.challenge.field], fixture.challenge.text);
    for (const field of ['headline', 'excerpt', 'metaDescription', 'contentHtml'] as const) {
      if (field !== fixture.challenge.field) assert.equal(mutated[field], sampleArticle[field]);
    }
    assert.equal(challengeWasCaught(reviewDecision(mutated, true, fixture.challenge.text), fixture), false);
    assert.equal(challengeWasCaught(reviewDecision(mutated, false), fixture), false, 'a generic rejection is not a detected false claim');
    const caught = reviewDecision(mutated, false, fixture.challenge.text);
    assert.equal(challengeWasCaught(caught, fixture), true);
    caught.review.complete = false;
    assert.equal(challengeWasCaught(caught, fixture), false, 'incomplete review is not a successful challenge');

    const reviewLimits: number[] = [];
    const result = await evaluateEditorialFixture(fixture, {
      extract: async (title, text) => {
        assert.equal(title, fixture.sourceTitle);
        assert.equal(text, fixture.sourceText);
        return { series_names: [fixture.seriesName], season_numbers: [], episode_numbers: [], people_names: [], key_statements: [fixture.sourceText], release_dates: [], networks_platforms: [] };
      },
      write: async () => ({
        headline: sampleArticle.headline, lead: sampleArticle.excerpt, metaDescription: sampleArticle.metaDescription,
        sections: [{ h2: '', paragraphs: fixture.checks.map(check => check.passes) }], qa: [],
      }),
      review: async (article, evidence, maxRevisions) => {
        reviewLimits.push(maxRevisions);
        assert.equal(evidence.sourceText, fixture.sourceText);
        const decision = reviewDecision(article, maxRevisions === 1 && fixture.expectedOutcome !== 'hold', maxRevisions === 0 ? fixture.challenge.text : '');
        if (fixture.expectedOutcome === 'hold') {
          decision.reasons.push('Deutschlandrelevanz fehlt');
          decision.review.germanyRelevance = { relevant: false, basis: 'none', evidenceQuote: '', reason: 'Keine relevante DE-Meldung.', newsCategory: 'other', localOnly: true };
        }
        return { article, decision, revisions: 0 };
      },
    });
    assert.equal(result.summary.status, 'automatic-checks-passed');
    assert.deepEqual(reviewLimits, [1, 0], 'one repair allowed for writing, no repair may hide challenge detection');
    assert.equal(result.summary.challengeCaught, true);
  }

  const dependencyFailure = await evaluateEditorialFixture(EDITORIAL_FIXTURES[0], {
    extract: async () => { throw new Error('PRIVATE_UPSTREAM_ERROR_MUST_NOT_ESCAPE'); },
    write: async () => { throw new Error('must not reach writer'); },
    review: async () => { throw new Error('must not reach review'); },
  });
  assert.deepEqual(dependencyFailure.summary.failureCategories, ['dependency']);
  assert.equal(dependencyFailure.summary.stage, 'facts');
  assert(!JSON.stringify(dependencyFailure).includes('PRIVATE_UPSTREAM_ERROR'));
  const originalLog = console.log;
  await assert.rejects(withMutedEvaluationLogs(async () => { console.error('PRIVATE_SUPPRESSED_TEST'); throw new Error('test'); }));
  assert.equal(console.log, originalLog, 'logger restoration must run after failure');

  const script = path.resolve('scripts/evaluate-news-editorial.ts');
  const invoke = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', script, ...args], {
    encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' }, timeout: 20_000,
  });
  const offline = invoke([]);
  assert.equal(offline.status, 0, offline.stderr);
  const summary = JSON.parse(offline.stdout);
  assert.equal(summary.mode, 'offline-fixture-validation');
  assert.equal(summary.modelJudgmentEvaluated, false);
  assert.equal(summary.automaticChecksPassed, null, 'offline fixtures are not proof of model quality');
  assert.equal(summary.humanApproval, 'not-recorded');
  assert.equal(summary.artifactsWritten, false);
  assert.equal(summary.selectedCases, 7);
  assert.match(summary.implementationHash, /^[a-f0-9]{64}$/);
  assert(!offline.stdout.includes(EDITORIAL_FIXTURES[0].sourceText));
  assert.equal(JSON.parse(invoke(['--case', 'casting-talks']).stdout).selectedCases, 1);
  assert.equal(invoke(['--case', 'does-not-exist']).status, 1);
  assert.equal(invoke(['--output-dir', process.cwd()]).status, 1, 'existing artifact directories must not be overwritten');
  assert.equal(invoke(['--output-dir', 'relative-dir']).status, 1);
  for (const file of [script, path.resolve('scripts/evaluation/news-editorial-harness.ts')]) {
    const source = readFileSync(file, 'utf8');
    assert(!/(?:from\s*|import\s*\()['"][^'"]*(?:prisma|pipeline-v2|publication-verification)/.test(source), 'acceptance runner must not import publication or DB workflows');
  }
  console.log('✅ editorial-evaluation tests passed (offline/mocked; no model-quality claim)');
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
