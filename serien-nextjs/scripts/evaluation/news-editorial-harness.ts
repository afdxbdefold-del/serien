import type { EditorialArticle, EditorialEvidence, EditorialReviewDecision } from '../../lib/editorial-review';
import type { ExtractedFacts } from '../../lib/fact-extractor';
import type { ValidStructuredArticle } from '../../lib/news-writing-policy';
import type { EditorialFailureCategory, EditorialFixture } from '../../tests/fixtures/news-editorial-cases';

export interface EvaluationOptions {
  live: boolean;
  caseIds: string[];
  outputDir?: string;
  help: boolean;
}

export function parseEvaluationOptions(args: string[]): EvaluationOptions {
  const options: EvaluationOptions = { live: false, caseIds: [], help: false };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--live') options.live = true;
    else if (arg === '--help') options.help = true;
    else if (arg === '--case' || arg === '--output-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('Invalid evaluation options');
      if (arg === '--case') options.caseIds.push(value);
      else if (options.outputDir) throw new Error('Duplicate output directory');
      else options.outputDir = value;
    } else throw new Error('Unknown evaluation option');
  }
  return options;
}

export function checkFixtureText(fixture: EditorialFixture, text: string): EditorialFailureCategory[] {
  return [...new Set(fixture.checks.filter(check => {
    const matches = new RegExp(check.pattern, 'iu').test(text);
    return check.expect === 'present' ? !matches : matches;
  }).map(check => check.category))];
}

export function validateEditorialFixtures(fixtures: EditorialFixture[]): void {
  const ids = new Set<string>();
  if (!fixtures.length) throw new Error('No evaluation fixtures');
  for (const fixture of fixtures) {
    if (ids.has(fixture.id) || !/^[a-z0-9-]+$/.test(fixture.id) || fixture.synthetic !== true) throw new Error('Invalid fixture identity');
    ids.add(fixture.id);
    const url = new URL(fixture.sourceUrl);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.example')) throw new Error('Fixtures must use reserved example domains');
    if (!fixture.sourceTitle.trim() || !fixture.seriesName.trim() || fixture.sourceText.length < 600 || fixture.sourceText.length > 24_000) throw new Error('Invalid fixture evidence');
    if (!Number.isFinite(Date.parse(fixture.sourcePublishedAt))) throw new Error('Invalid fixture timestamp');
    if (!fixture.checks.length || !fixture.humanChecks.length || fixture.challenge.text.length < 25) throw new Error('Missing fixture acceptance criteria');
    for (const check of fixture.checks) {
      const regex = new RegExp(check.pattern, 'iu');
      if (regex.test(check.passes) !== (check.expect === 'present') || regex.test(check.fails) === (check.expect === 'present')) throw new Error('Fixture probe has invalid positive or negative control');
    }
  }
}

export function fixtureEvidence(fixture: EditorialFixture): EditorialEvidence {
  return {
    sourceTitle: fixture.sourceTitle, sourceUrl: fixture.sourceUrl,
    sourceText: fixture.sourceText, sourcePublishedAt: fixture.sourcePublishedAt,
    seriesName: fixture.seriesName,
    germanyCatalog: fixture.germanyCatalog,
    // Fixed evidence clock makes reviewer date handling reproducible. Source
    // fixtures use absolute dates; the production writer retains its own clock.
    now: new Date('2026-09-20T12:00:00.000Z'),
  };
}

export function mutateEditorialCandidate(article: EditorialArticle, fixture: EditorialFixture): EditorialArticle {
  const { field, text } = fixture.challenge;
  return field === 'contentHtml'
    ? { ...article, contentHtml: `${article.contentHtml}\n<p>${escapeHtml(text)}</p>` }
    : { ...article, [field]: text };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

export async function structuredEvaluationArticle(output: ValidStructuredArticle, fixture: EditorialFixture): Promise<EditorialArticle> {
  const { marked } = await import('marked');
  return {
    headline: output.headline, excerpt: output.lead, metaDescription: output.metaDescription,
    // The separate excerpt is not inserted again as a body paragraph.
    contentHtml: output.sections.map(section =>
      `${section.h2 ? `<h2>${escapeHtml(section.h2)}</h2>\n` : ''}${section.paragraphs.map(paragraph => marked.parse(paragraph, { async: false })).join('\n')}`,
    ).join('\n') + `\n<small>Quelle: <a href="${escapeHtml(fixture.sourceUrl)}">Originalquelle</a></small>`,
  };
}

function targetsCorruption(quote: string, corruption: string): boolean {
  const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase('de-DE').replace(/\s+/g, ' ').trim();
  const part = normalize(quote);
  const whole = normalize(corruption);
  return part.length >= 12 && (whole.includes(part) || part.includes(whole));
}

/** Mere structural rejection or an API failure must not count as catching a false claim. */
export function challengeWasCaught(decision: EditorialReviewDecision, fixture: EditorialFixture): boolean {
  if (decision.passed || !decision.review.complete) return false;
  return decision.review.issues.some(issue => targetsCorruption(issue.articleQuote, fixture.challenge.text))
    || decision.review.claims.some(claim => claim.assessment !== 'supported' && targetsCorruption(claim.articleQuote, fixture.challenge.text));
}

export function reviewFailureCategories(decision: EditorialReviewDecision): EditorialFailureCategory[] {
  if (decision.passed) return [];
  const text = [...decision.reasons, ...decision.review.issues.map(issue => `${issue.code} ${issue.reason}`)].join(' ').toLowerCase();
  const mappings: Array<[EditorialFailureCategory, RegExp]> = [
    ['germany-relevance', /deutschlandrelevanz|deutschlandbeleg|katalogkontext|lokale oder sachfremde/],
    ['territory', /region|territor|deutschland|benelux|us-start/],
    ['uncertainty', /unsicher|verhand|gerücht|speculat|uncertain/],
    ['event-status', /absetz|verlänger|final|cancell|renew/],
    ['contradiction', /widerspr|contradict/],
    ['prompt-injection', /injection|eingebettete.*anweisung|system override/],
    ['originality', /quellennah|übersetz|original|eigenständig|schematisch/],
    ['style', /floskel|werb|klar|präzise|stil/],
    ['structure', /absatz|wörter|vorspann|html|struktu/],
    ['review-coverage', /vollständig|prüfausgabe|geprüft|beleg geliefert/],
    ['facts', /unbelegt|quelle|beleg|fakt|unsupported/],
  ];
  const categories = mappings.filter(([, regex]) => regex.test(text)).map(([category]) => category);
  return categories.length ? categories : ['facts'];
}

type ReviewedArticle = { article: EditorialArticle; decision: EditorialReviewDecision; revisions: number };
export interface EvaluationDependencies {
  extract: (title: string, text: string) => Promise<ExtractedFacts>;
  write: (fixture: EditorialFixture, facts: ExtractedFacts) => Promise<ValidStructuredArticle>;
  review: (article: EditorialArticle, evidence: EditorialEvidence, maxRevisions: 0 | 1) => Promise<ReviewedArticle>;
}

export interface EvaluationCaseSummary {
  id: string;
  kind: EditorialFixture['kind'];
  status: 'fixture-valid' | 'automatic-checks-passed' | 'failed';
  expectedOutcome: EditorialFixture['expectedOutcome'];
  reviewOutcome?: 'publish' | 'hold';
  reviewFailureCategories?: EditorialFailureCategory[];
  failureCategories: EditorialFailureCategory[];
  revisions?: number;
  challengeCaught?: boolean;
  stage?: 'facts' | 'writer' | 'review' | 'challenge';
}

export async function evaluateEditorialFixture(fixture: EditorialFixture, dependencies: EvaluationDependencies) {
  const summary: EvaluationCaseSummary = {
    id: fixture.id, kind: fixture.kind, status: 'failed', expectedOutcome: fixture.expectedOutcome, failureCategories: [],
  };
  let stage: NonNullable<EvaluationCaseSummary['stage']> = 'facts';
  let artifacts: Record<string, unknown> = { synthetic: true, publicationForbidden: true, fixture };
  try {
    const facts = await dependencies.extract(fixture.sourceTitle, fixture.sourceText);
    stage = 'writer';
    const written = await dependencies.write(fixture, facts);
    const firstArticle = await structuredEvaluationArticle(written, fixture);
    artifacts = { ...artifacts, facts, firstArticle };
    stage = 'review';
    const reviewed = await dependencies.review(firstArticle, fixtureEvidence(fixture), 1);
    artifacts = { ...artifacts, reviewed };
    summary.reviewOutcome = reviewed.decision.passed ? 'publish' : 'hold';
    summary.reviewFailureCategories = reviewFailureCategories(reviewed.decision);
    summary.revisions = reviewed.revisions;
    if (!reviewed.decision.passed && fixture.expectedOutcome === 'publish') summary.failureCategories.push('unexpected-hold');
    if (fixture.expectedOutcome === 'hold' && (reviewed.decision.passed || !summary.reviewFailureCategories.includes('germany-relevance'))) {
      summary.failureCategories.push('germany-relevance');
    }
    if (reviewed.decision.passed) {
      const { headline, excerpt, metaDescription, contentHtml } = reviewed.article;
      summary.failureCategories.push(...checkFixtureText(fixture, [headline, excerpt, metaDescription, contentHtml].join('\n')));
    }
    stage = 'challenge';
    const challengeArticle = mutateEditorialCandidate(reviewed.article, fixture);
    const challenge = await dependencies.review(challengeArticle, fixtureEvidence(fixture), 0);
    summary.challengeCaught = challengeWasCaught(challenge.decision, fixture);
    artifacts = { ...artifacts, challengeArticle, challenge };
    if (!summary.challengeCaught) summary.failureCategories.push('challenge-missed', fixture.challenge.category);
    summary.failureCategories = [...new Set(summary.failureCategories)];
    summary.status = summary.failureCategories.length ? 'failed' : 'automatic-checks-passed';
  } catch {
    // Never serialize upstream SDK errors, request headers, bodies or credentials.
    summary.stage = stage;
    summary.failureCategories = [...new Set([...summary.failureCategories, 'dependency' as const])];
  }
  return { summary, artifacts };
}

/** Isolated CLI use only: suppress legacy module logging, including error payloads. */
export async function withMutedEvaluationLogs<T>(operation: () => Promise<T>): Promise<T> {
  const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  const quiet = () => {};
  console.log = console.info = console.warn = console.error = console.debug = quiet;
  try { return await operation(); }
  finally { Object.assign(console, saved); }
}
