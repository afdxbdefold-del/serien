/**
 * Editorial acceptance, not publishing. Default: no model/network/database calls.
 * node --import tsx scripts/evaluate-news-editorial.ts
 * Explicitly billed opt-in: add --live [--case <id>] [--output-dir <new absolute local directory>].
 * The existing OPENAI_API_KEY is read only by the real modules; no .env is loaded.
 * No source URL is fetched. All stories, companies and people are fictional.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { EDITORIAL_FIXTURES, EDITORIAL_FIXTURE_VERSION, EDITORIAL_HUMAN_RUBRIC } from '../tests/fixtures/news-editorial-cases';
import {
  evaluateEditorialFixture, parseEvaluationOptions, validateEditorialFixtures, withMutedEvaluationLogs,
  type EvaluationCaseSummary, type EvaluationDependencies,
} from './evaluation/news-editorial-harness';

async function main(): Promise<void> {
  const options = parseEvaluationOptions(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(JSON.stringify({
      usage: 'node --import tsx scripts/evaluate-news-editorial.ts [--live] [--case ID] [--output-dir NEW_ABSOLUTE_LOCAL_DIRECTORY]',
      default: 'Offline fixture validation only; no judgement of model quality.',
      live: 'Explicitly permits billed OpenAI calls through the real fact extractor, NEWS writer and reviewer. Sequential, one repair maximum plus one corrupted-claim challenge per case. Module-level retries still apply.',
      output: 'Only the explicit output directory receives synthetic text artifacts and the human scorecard. Existing directories are refused. Stdout contains compact metadata only.',
      never: 'No database access, URL fetch, scheduling, storage upload or article publication.',
      cases: EDITORIAL_FIXTURES.map(fixture => fixture.id),
    }) + '\n');
    return;
  }
  validateEditorialFixtures(EDITORIAL_FIXTURES);
  if (options.caseIds.some(id => !EDITORIAL_FIXTURES.some(fixture => fixture.id === id))) throw new Error('Unknown case');
  const fixtures = EDITORIAL_FIXTURES.filter(fixture => !options.caseIds.length || options.caseIds.includes(fixture.id));
  if (options.outputDir) {
    if (!path.isAbsolute(options.outputDir) || /^[/\\]{2}/.test(options.outputDir) || path.parse(options.outputDir).root === path.resolve(options.outputDir)) throw new Error('Output must be a new local absolute directory');
    // Refuse overwrite and validate the output target before any billable work.
    await mkdir(options.outputDir, { recursive: false });
  }
  const results: EvaluationCaseSummary[] = [];
  const artifactCases: unknown[] = [];
  const implementationFiles = ['fact-extractor.ts', 'structured-content-generator.ts', 'news-writing-policy.ts', 'editorial-review.ts', 'article-structure.ts', 'llm-config.ts'];
  const implementationHash = createHash('sha256');
  for (const file of implementationFiles) {
    implementationHash.update(file).update(await readFile(path.resolve(path.dirname(process.argv[1]), '../lib', file)));
  }
  let model: string | null = null;
  let reasoningEffort: string | null = null;
  if (options.live) {
    // These modules have no Prisma/DB/publication dependencies. No full pipeline import.
    await withMutedEvaluationLogs(async () => {
      const [{ extractFacts }, { generateStructuredContent }, { reviewAndRepairArticle }, { NEWS_LLM_CONFIG }] = await Promise.all([
        import('../lib/fact-extractor'), import('../lib/structured-content-generator'), import('../lib/editorial-review'), import('../lib/llm-config'),
      ]);
      model = NEWS_LLM_CONFIG.model;
      reasoningEffort = NEWS_LLM_CONFIG.reasoning_effort;
      const dependencies: EvaluationDependencies = {
        extract: extractFacts,
        write: (fixture, facts) => generateStructuredContent({
          facts, seriesName: fixture.seriesName, originalHeadline: fixture.sourceTitle,
          sourceText: fixture.sourceText, sourceUrl: fixture.sourceUrl,
          sourcePublishedAt: fixture.sourcePublishedAt, contentType: 'NEWS', wordCountTarget: 300,
        }),
        review: (article, evidence, maxRevisions) => reviewAndRepairArticle(article, evidence, { maxRevisions }),
      };
      for (const fixture of fixtures) {
        const result = await evaluateEditorialFixture(fixture, dependencies);
        results.push(result.summary);
        artifactCases.push(result.artifacts);
        // A configuration/outage failure should not spend another full batch.
        if (result.summary.failureCategories.includes('dependency')) break;
      }
    });
  } else {
    for (const fixture of fixtures) {
      results.push({ id: fixture.id, kind: fixture.kind, status: 'fixture-valid', expectedOutcome: fixture.expectedOutcome, failureCategories: [] });
      artifactCases.push({ synthetic: true, publicationForbidden: true, fixture, modelEvaluation: 'not-run' });
    }
  }
  const failureCategories = [...new Set(results.flatMap(result => result.failureCategories))];
  const summary = {
    synthetic: true, publicationForbidden: true, fixtureVersion: EDITORIAL_FIXTURE_VERSION,
    fixtureHash: createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'),
    implementationHash: implementationHash.digest('hex'), model, reasoningEffort,
    mode: options.live ? 'live-model-evaluation' : 'offline-fixture-validation',
    modelJudgmentEvaluated: options.live && results.some(result => result.reviewOutcome !== undefined),
    humanReviewRequired: true, humanApproval: 'not-recorded',
    selectedCases: fixtures.length, completedCases: results.length,
    automaticChecksPassed: options.live ? !failureCategories.length && results.length === fixtures.length : null,
    failureCategories, results,
    limitations: 'Synthetic fixtures only; not production verification or proof of newsroom quality. The NEWS writer uses its current clock and configured model; outputs may vary between runs.',
    artifactsWritten: Boolean(options.outputDir),
  };
  if (options.outputDir) {
    await writeFile(path.join(options.outputDir, 'SYNTHETIC-EDITORIAL-EVALUATION.json'), JSON.stringify({
      warning: 'SYNTHETIC TEST DATA. DO NOT PUBLISH. No real news, no human approval.',
      summary, rubric: EDITORIAL_HUMAN_RUBRIC, cases: artifactCases,
    }, null, 2), { encoding: 'utf8', flag: 'wx' });
  }
  process.stdout.write(JSON.stringify(summary) + '\n');
  if (failureCategories.length) process.exitCode = 1;
}

void main().catch(() => {
  // Do not echo CLI values or exception messages: they may contain sensitive paths/keys.
  process.stdout.write(JSON.stringify({ success: false, synthetic: true, failureCategories: ['configuration-or-artifact-error'], humanApproval: 'not-recorded' }) + '\n');
  process.exitCode = 1;
});
