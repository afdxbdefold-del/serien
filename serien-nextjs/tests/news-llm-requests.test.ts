import assert from 'node:assert/strict';
import { extractFacts, FACT_EXTRACTION_SCHEMA } from '../lib/fact-extractor';
import { generateStructuredContent } from '../lib/structured-content-generator';
import {
  editorialBodyParagraphs, editorialPayloadHash, reviewAndRepairArticle,
  type EditorialArticle, type EditorialEvidence, type EditorialReview,
} from '../lib/editorial-review';
import { getNewsRequestConfig } from '../lib/llm-config';
import { classifyContent, CLASSIFICATION_SCHEMA } from '../lib/content-classifier';
import { requestTriageJson } from '../lib/news-triage-request';

// These are transport-contract regressions, not a live model quality evaluation.
// Real module functions and the real SDK serialize requests into a fetch stub.
// No original fetch, database client or production source is ever called.
interface RequestBody {
  model: string;
  reasoning_effort?: string;
  max_completion_tokens?: number;
  temperature?: number;
  messages: Array<{ role: string; content: string }>;
  response_format?: { type: string; json_schema?: { name: string; strict: boolean; schema: unknown } };
  [field: string]: unknown;
}
interface Reply {
  finish_reason: string;
  message: { role: 'assistant'; content: string | null; refusal?: string };
}
const complete = (value: unknown): Reply => ({ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } });
const truncated = (value: unknown): Reply => ({ ...complete(value), finish_reason: 'length' });
const refused = (value: unknown): Reply => ({ ...complete(value), message: { ...complete(value).message, refusal: 'Mocked refusal' } });
const sourceQuote = 'Filming on the second season of Nordhafen begins this week.';
const germanyQuote = 'The announcement confirms that Nordhafen is available in Germany.';
const sourceText = `${sourceQuote} ${germanyQuote} The production team confirmed that the season will contain six new episodes. The story returns to the harbour district and follows the same two investigators. Both lead actors will reprise their existing roles. Filming begins at locations already used in the first season, with further locations to follow during production. The announcement does not identify those additional locations or provide a daily filming schedule. No new characters or guest actors are announced. The team describes the continuation as the next stage of the same investigation. No broadcast date or trailer has been announced, and the announcement does not establish a release date for any territory.`;
const paragraphs = [
  'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen. Das gab das Produktionsteam in einer Mitteilung bekannt. Für die neuen Folgen kehrt die Handlung in das Hafenviertel zurück, in dem bereits die erste Staffel spielte. Im Zentrum stehen erneut die Ermittlungen der beiden Hauptfiguren.',
  'Die Produktion nennt in ihrer Ankündigung sechs neue Episoden. Gedreht wird zunächst an den bekannten Schauplätzen der Serie. Weitere Drehorte sollen während der laufenden Arbeit hinzukommen. Welche Orte das konkret sind, lässt die Mitteilung noch offen und beschreibt auch keinen genauen Ablauf der einzelnen Drehtage.',
  'Die beiden Hauptdarsteller übernehmen wieder ihre bisherigen Rollen. Angaben zu neuen Figuren enthält die vorliegende Mitteilung dagegen nicht. Weitere Details zum Fall oder zu möglichen Gastauftritten wurden in der Ankündigung nicht genannt. Zum Veröffentlichungstermin macht die Produktion noch keine Angaben.',
];
const facts = {
  series_names: ['Nordhafen'], season_numbers: [2], episode_numbers: [6], people_names: [],
  key_statements: [sourceQuote], release_dates: [], networks_platforms: [],
};
const article: EditorialArticle = {
  headline: 'Nordhafen: Die Dreharbeiten zur zweiten Staffel beginnen',
  excerpt: 'Nordhafen geht in die nächste Produktionsrunde. Sechs neue Folgen sind angekündigt.',
  metaDescription: 'Nordhafen bekommt sechs neue Folgen. Die Dreharbeiten beginnen, ein Veröffentlichungstermin wurde noch nicht genannt.',
  contentHtml: `${paragraphs.map(p => `<p>${p}</p>`).join('\n')}<small>Quelle: <a href="https://studio.example/news/nordhafen">Originalmitteilung</a></small>`,
};
const evidence: EditorialEvidence = {
  sourceTitle: 'Nordhafen returns to production', sourceText, sourceUrl: 'https://studio.example/news/nordhafen',
  sourcePublishedAt: '2026-09-20T08:00:00.000Z', seriesName: 'Nordhafen', now: new Date('2026-09-20T12:00:00.000Z'),
};
const writerArticle = {
  headline: article.headline, metaDescription: article.metaDescription, lead: article.excerpt,
  sections: [{ h2: '', paragraphs }], qa: [],
};
const writerInput = {
  facts, seriesName: 'Nordhafen', originalHeadline: evidence.sourceTitle, sourceText,
  sourceUrl: evidence.sourceUrl, sourcePublishedAt: evidence.sourcePublishedAt,
  contentType: 'NEWS' as const, temperature: 0.9,
};
const goodReview = (payload = article): EditorialReview => ({
  complete: true, newsworthy: true, verdict: 'publish', clarity: 4, originality: 4,
  germanyRelevance: { relevant: true, basis: 'original', evidenceQuote: germanyQuote,
    reason: 'Neue Produktion einer laut Originalquelle in Deutschland verfügbaren Serie.', newsCategory: 'series-production', localOnly: false },
  coverage: { headline: true, excerpt: true, metaDescription: true, bodyParagraphIndexes: editorialBodyParagraphs(payload).map(p => p.index) },
  issues: [], claims: [{ articleQuote: 'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen.', sourceQuote, source: 'original', assessment: 'supported' }],
});

function assertNewsRequest(body: RequestBody, budget: number) {
  assert.equal(body.model, 'gpt-6-astra');
  assert.equal(body.reasoning_effort, 'low');
  assert.equal(body.max_completion_tokens, budget);
  for (const field of ['temperature', 'top_p', 'top_logprobs', 'logprobs']) {
    assert.equal(Object.prototype.hasOwnProperty.call(body, field), false, `NEWS must not serialize ${field}`);
  }
}

async function run() {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  let requests: RequestBody[] = [];
  let replies: Reply[] = [];
  const unexpectedTargets: string[] = [];
  const scenario = (...nextReplies: Reply[]) => { requests = []; replies = nextReplies; };
  const expectConsumed = (count: number) => { assert.equal(requests.length, count); assert.equal(replies.length, 0); };
  process.env.OPENAI_API_KEY = 'unit-test-dummy-key-not-a-secret';
  globalThis.fetch = async (target, init) => {
    const url = target instanceof Request ? target.url : String(target);
    if (url !== 'https://api.openai.com/v1/chat/completions') unexpectedTargets.push(url);
    assert.equal(url, 'https://api.openai.com/v1/chat/completions', 'unexpected transport target must never reach the network');
    const body = JSON.parse(String(init?.body)) as RequestBody;
    requests.push(body);
    const reply = replies.shift();
    assert(reply, 'unexpected extra SDK request');
    return new Response(JSON.stringify({ id: 'offline-news-contract', object: 'chat.completion', created: 0,
      model: body.model, choices: [{ index: 0, ...reply }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    for (const [role, budget] of Object.entries({ classification: 4096, deduplication: 4096, facts: 12000, writing: 8192, review: 12000, revision: 12000 })) {
      const config = getNewsRequestConfig(role as Parameters<typeof getNewsRequestConfig>[0]);
      assertNewsRequest({ ...config, messages: [] }, budget);
    }

    const classification = { content_type: 'SINGLE_SERIES_NEWS', confidence: 0.96, primary_series: 'Nordhafen',
      series_candidates: ['Nordhafen'], signals: { title: ['Nordhafen'], text: [sourceQuote] },
      reasoning: 'Filming has begun for a series whose German availability is expressly confirmed.' };
    scenario(complete(classification));
    assert.equal((await classifyContent(evidence.sourceTitle, evidence.sourceUrl, sourceText)).primary_series, 'Nordhafen');
    expectConsumed(1);
    assertNewsRequest(requests[0], 4096);
    assert.equal(requests[0].response_format?.json_schema?.strict, true);
    assert.deepEqual(requests[0].response_format?.json_schema?.schema, CLASSIFICATION_SCHEMA);
    assert.equal(JSON.parse(requests[0].messages[1].content).text, sourceText);
    for (const [repliesForFailure, count, pattern] of [
      [[truncated(classification), truncated(classification)], 2, /incomplete/i],
      [[refused(classification)], 1, /refused/i],
    ] as const) {
      scenario(...repliesForFailure);
      await assert.rejects(classifyContent(evidence.sourceTitle, evidence.sourceUrl, sourceText, { wait: async () => {} }), pattern);
      expectConsumed(count);
      requests.forEach(request => assertNewsRequest(request, 4096));
    }

    // The deduplication module instantiates Prisma at import time. Exercise its
    // shared SDK transport here; news-triage.test covers the full decision path
    // with a stubbed article loader and schema validation.
    const transportSchema = { type: 'object', additionalProperties: false,
      properties: { is_duplicate: { type: 'boolean' } }, required: ['is_duplicate'] };
    const dedupe = { is_duplicate: false };
    const dedupeCall = () => requestTriageJson('deduplication', transportSchema, 'Offline transport contract.',
      { sourceText }, (value) => { assert.deepEqual(value, dedupe); return value; }, { wait: async () => {} });
    scenario(complete(dedupe));
    assert.deepEqual(await dedupeCall(), dedupe);
    expectConsumed(1);
    assertNewsRequest(requests[0], 4096);
    assert.equal(requests[0].response_format?.json_schema?.name, 'news_deduplication');
    assert.equal(requests[0].response_format?.json_schema?.strict, true);
    assert.deepEqual(requests[0].response_format?.json_schema?.schema, transportSchema);
    for (const [repliesForFailure, count, pattern] of [
      [[truncated(dedupe), truncated(dedupe)], 2, /incomplete/i],
      [[refused(dedupe)], 1, /refused/i],
    ] as const) {
      scenario(...repliesForFailure);
      await assert.rejects(dedupeCall(), pattern);
      expectConsumed(count);
      requests.forEach(request => assertNewsRequest(request, 4096));
    }

    scenario(complete(facts));
    assert.deepEqual(await extractFacts(evidence.sourceTitle, sourceText), facts);
    expectConsumed(1);
    assertNewsRequest(requests[0], 12000);
    assert.equal(requests[0].response_format?.type, 'json_schema');
    assert.equal(requests[0].response_format?.json_schema?.strict, true);
    assert.deepEqual(requests[0].response_format?.json_schema?.schema, FACT_EXTRACTION_SCHEMA);
    assert.equal(JSON.parse(requests[0].messages[1].content).text, sourceText);
    for (const bad of [truncated(facts), refused(facts)]) {
      scenario(bad);
      await assert.rejects(extractFacts(evidence.sourceTitle, sourceText), /incomplete|refused/i);
      expectConsumed(1);
      assertNewsRequest(requests[0], 12000);
    }

    scenario(complete(writerArticle));
    const written = await generateStructuredContent(writerInput);
    assert.equal(written.headline, article.headline);
    expectConsumed(1);
    assertNewsRequest(requests[0], 8192);
    // Facts at the end of a long source must remain available to the writer.
    const fullBudgetSource = `${'a'.repeat(59965)} COMPLETE-SOURCE-END-EVIDENCE`;
    scenario(complete(writerArticle));
    await generateStructuredContent({ ...writerInput, sourceText: fullBudgetSource });
    expectConsumed(1);
    assert(requests[0].messages[1].content.includes(fullBudgetSource));
    for (const invalid of ['', 'x'.repeat(60001)]) {
      scenario();
      await assert.rejects(generateStructuredContent({ ...writerInput, sourceText: invalid }));
      expectConsumed(0);
    }
    // Mechanical anti-AI punctuation changes must not mutate a NEWS quotation.
    const quote = 'Die Produktion nennt ihre Arbeit „nah – und persönlich“. Weitere Details folgen später.';
    scenario(complete({ ...writerArticle, sections: [{ h2: '', paragraphs: [...paragraphs, quote] }] }));
    const withQuote = await generateStructuredContent(writerInput);
    assert(withQuote.markdown.includes(quote));
    expectConsumed(1);
    scenario(truncated(writerArticle), truncated(writerArticle));
    await assert.rejects(generateStructuredContent(writerInput), /incomplete|malformed/i);
    expectConsumed(2);
    requests.forEach(request => assertNewsRequest(request, 8192));
    scenario(refused(writerArticle));
    await assert.rejects(generateStructuredContent(writerInput), /refused/i);
    expectConsumed(1);
    assertNewsRequest(requests[0], 8192);

    // The migration scope is NEWS, not the separate ranking/feature workflow.
    scenario(complete(writerArticle));
    await generateStructuredContent({ ...writerInput, contentType: 'RANKING', temperature: 0.27 });
    expectConsumed(1);
    assert.equal(requests[0].model, 'gpt-5.4');
    assert.equal(requests[0].temperature, 0.27);
    assert.equal(requests[0].reasoning_effort, undefined);
    assert.equal(requests[0].max_completion_tokens, 8192);

    scenario(complete(goodReview()));
    const reviewed = await reviewAndRepairArticle(article, evidence, { maxRevisions: 0 });
    assert(reviewed.decision.passed, reviewed.decision.reasons.join('; '));
    assert.equal(reviewed.decision.payloadHash, editorialPayloadHash(article));
    expectConsumed(1);
    assertNewsRequest(requests[0], 12000);
    assert.equal(requests[0].response_format?.json_schema?.name, 'editorial_review');
    assert.equal(requests[0].response_format?.json_schema?.strict, true);
    const reviewPayload = JSON.parse(requests[0].messages[1].content);
    assert.deepEqual(reviewPayload.article, article);
    assert.deepEqual(reviewPayload.bodyParagraphs, editorialBodyParagraphs(article));
    assert.equal(reviewPayload.evidence.sourceText, sourceText);
    for (const bad of [truncated(goodReview()), refused(goodReview())]) {
      scenario(bad);
      await assert.rejects(reviewAndRepairArticle(article, evidence, { maxRevisions: 0 }), /fehlt|abgelehnt|abgebrochen/);
      expectConsumed(1);
      assertNewsRequest(requests[0], 12000);
    }

    const revised = { ...article, excerpt: 'Die Produktion von Nordhafen kündigt sechs neue Folgen an. Die Dreharbeiten zur zweiten Staffel beginnen.' };
    const needsRevision = { ...goodReview(), verdict: 'revise' as const,
      issues: [{ code: 'clarity', reason: 'Vorspann präziser formulieren', articleQuote: article.excerpt }] };
    scenario(complete(needsRevision), complete(revised), complete(goodReview(revised)));
    const repaired = await reviewAndRepairArticle(article, evidence);
    assert.equal(repaired.revisions, 1);
    assert(repaired.decision.passed, repaired.decision.reasons.join('; '));
    assert.equal(repaired.decision.payloadHash, editorialPayloadHash(revised));
    expectConsumed(3);
    requests.forEach(request => { assertNewsRequest(request, 12000); assert.equal(request.response_format?.json_schema?.strict, true); });
    assert.deepEqual(requests.map(request => request.response_format?.json_schema?.name), ['editorial_review', 'editorial_revision', 'editorial_review']);
    assert.deepEqual(JSON.parse(requests[2].messages[1].content).article, revised);
    for (const badRevision of [truncated(revised), refused(revised)]) {
      scenario(complete(needsRevision), badRevision);
      await assert.rejects(reviewAndRepairArticle(article, evidence), /fehlt|abgelehnt|abgebrochen/);
      expectConsumed(2);
      requests.forEach(request => assertNewsRequest(request, 12000));
    }
    assert.equal(unexpectedTargets.length, 0);
    console.log('NEWS LLM transport contracts passed (real SDK, mocked fetch, no API/DB calls)');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
