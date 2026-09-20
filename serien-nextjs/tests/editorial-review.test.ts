import assert from 'node:assert/strict';
import {
  editorialBodyParagraphs, editorialPayloadHash, parseEditorialReview, reviewAndRepairArticle, validateEditorialReview,
  type EditorialArticle, type EditorialEvidence, type EditorialReview,
} from '../lib/editorial-review';

// Fictional fixtures. All model calls are injected below; these tests neither
// contact a model nor claim to evaluate a real model's factual judgement.
const headline = 'Nordhafen: Die Dreharbeiten zur zweiten Staffel beginnen';
const excerpt = 'Das Produktionsteam von Nordhafen hat den Beginn der Dreharbeiten bestätigt. Im Mittelpunkt stehen erneut die Ermittlungen im Hafenviertel.';
const sourceLink = '<small>Quelle: <a href="https://studio.example/news/nordhafen">Originalmitteilung der Produktion</a></small>';
const paragraphs = [
  'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen. Das gab das Produktionsteam in einer Mitteilung bekannt. Für die neuen Folgen kehrt die Handlung in das Hafenviertel zurück, in dem bereits die erste Staffel spielte. Im Zentrum stehen erneut die Ermittlungen der beiden Hauptfiguren.',
  'Die Produktion nennt in ihrer Ankündigung sechs neue Episoden. Gedreht wird zunächst an den bekannten Schauplätzen der Serie. Weitere Drehorte sollen während der laufenden Arbeit hinzukommen. Welche Orte das konkret sind, lässt die Mitteilung noch offen und beschreibt auch keinen genauen Ablauf der einzelnen Drehtage.',
  'Die beiden Hauptdarsteller übernehmen wieder ihre bisherigen Rollen. Angaben zu neuen Figuren enthält die vorliegende Mitteilung dagegen nicht. Das Team beschreibt die Fortsetzung als nächste Etappe derselben Ermittlungsgeschichte. Weitere Details zum Fall oder zu möglichen Gastauftritten wurden in der Ankündigung nicht genannt.',
  'Zum Veröffentlichungstermin macht die Produktion noch keine Angaben. Auch ein Trailer ist nicht Teil der neuen Ankündigung. Fest steht damit zunächst nur der Beginn der Dreharbeiten und der vorgesehene Umfang der Fortsetzung. Ein konkreter Sendetermin lässt sich aus diesen Informationen nicht ableiten.',
];
const article: EditorialArticle = {
  headline, excerpt,
  metaDescription: 'Nordhafen geht mit sechs neuen Folgen in die Produktion. Die Dreharbeiten haben begonnen, ein Veröffentlichungstermin wurde noch nicht genannt.',
  contentHtml: paragraphs.map(p => `<p>${p}</p>`).join('\n') + sourceLink,
};
const sourceQuote = 'Filming on the second season of Nordhafen begins this week.';
const sourceText = `${sourceQuote} The production team confirmed that the season will contain six new episodes. The story returns to the harbour district and follows the same two investigators. Both lead actors will reprise their existing roles. Filming begins at locations already used in the first season, with further locations to follow during production. The announcement does not identify those additional locations or provide a daily filming schedule. No new characters or guest actors are announced. The team describes the continuation as the next stage of the same investigation. No broadcast date or trailer has been announced, and the announcement does not establish a release date for any territory.`;
const evidence: EditorialEvidence = {
  sourceTitle: 'Nordhafen returns to production', sourceUrl: 'https://studio.example/news/nordhafen',
  sourceText, sourcePublishedAt: '2026-09-20T08:00:00.000Z', seriesName: 'Nordhafen',
  now: new Date('2026-09-20T12:00:00.000Z'),
};
const goodReview = (candidate = article): EditorialReview => ({
  complete: true, newsworthy: true, verdict: 'publish', clarity: 4, originality: 4,
  coverage: { headline: true, excerpt: true, metaDescription: true, bodyParagraphIndexes: editorialBodyParagraphs(candidate).map(p => p.index) },
  issues: [], claims: [{
    articleQuote: 'Die Dreharbeiten zur zweiten Staffel von Nordhafen beginnen.',
    sourceQuote, source: 'original', assessment: 'supported',
  }],
});
const decision = (review: unknown, candidate = article, source = evidence) => validateEditorialReview(review, candidate, source);

async function run() {
  assert.equal(decision(goodReview()).passed, true, 'a concise structured article needs no H2, FAQ or padding');
  assert.equal(decision(goodReview()).payloadHash, editorialPayloadHash(article));
  assert.deepEqual(editorialBodyParagraphs(article), paragraphs.map((text, index) => ({ index: index + 1, text })));
  for (const field of ['headline', 'excerpt', 'metaDescription', 'contentHtml'] as const) {
    assert.notEqual(editorialPayloadHash({ ...article, [field]: `${article[field]} geändert` }), editorialPayloadHash(article), `${field} must be part of the reviewed payload`);
  }
  assert.equal(decision({ ...goodReview(), complete: false }).passed, false);
  assert.equal(decision({ ...goodReview(), newsworthy: false }).passed, false);
  assert.equal(decision({ ...goodReview(), verdict: 'reject' }).passed, false);
  assert.equal(decision({ ...goodReview(), clarity: 3 }).passed, false);
  assert.equal(decision({ ...goodReview(), originality: 3 }).passed, false);
  assert.equal(decision({ ...goodReview(), claims: [] }).passed, false);
  assert.equal(decision({ ...goodReview(), issues: [{ code: 'scope', reason: 'Regionaler Geltungsbereich fehlt', articleQuote: excerpt }] }).passed, false);

  for (const malformed of [
    undefined, null, '', {}, { refusal: 'declined' },
    { ...goodReview(), complete: 'true' },
    { ...goodReview(), verdict: 'PASS' },
    { ...goodReview(), clarity: 6 },
    { ...goodReview(), originality: 4.5 },
    { ...goodReview(), coverage: undefined },
    { ...goodReview(), coverage: { ...goodReview().coverage, excerpt: 'true' } },
    ...[0, -1, 1.5, 513, '1'].map(index => ({ ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: [index] } })),
    { ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: Array.from({ length: 513 }, () => 1) } },
    { ...goodReview(), claims: [null] },
    { ...goodReview(), claims: [{ ...goodReview().claims[0], sourceQuote: 123 }] },
    { ...goodReview(), claims: [{ ...goodReview().claims[0], assessment: 'probably' }] },
  ]) assert.throws(() => parseEditorialReview(malformed));

  for (const field of ['headline', 'excerpt', 'metaDescription'] as const) {
    assert.equal(decision({ ...goodReview(), coverage: { ...goodReview().coverage, [field]: false } }).passed, false);
  }
  for (const indexes of [[], [1, 2, 3], [1, 2, 3, 3], [1, 2, 3, 5], [1, 2, 3, 4, 5]]) {
    const incomplete = decision({ ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: indexes } });
    assert.equal(incomplete.passed, false);
    assert(incomplete.reasons.some(reason => reason.includes('Absatzprüfung unvollständig')));
  }
  assert.equal(decision({ ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: [4, 3, 2, 1] } }).passed, true);
  const withAside = { ...article, contentHtml: `${article.contentHtml}<div class="related-articles"><p>Weitere Meldungen zur Serie</p></div>` };
  assert.deepEqual(editorialBodyParagraphs(withAside), editorialBodyParagraphs(article));
  assert.equal(decision(goodReview(), withAside).passed, true);
  const sourceParagraph = { ...article, contentHtml: `${article.contentHtml.replace(sourceLink, '')}<p>${sourceLink}</p>` };
  assert.equal(editorialBodyParagraphs(sourceParagraph).length, 5);
  assert.equal(decision(goodReview(), sourceParagraph).passed, false, 'a visible source paragraph also needs coverage');
  assert.equal(decision(goodReview(sourceParagraph), sourceParagraph).passed, true);

  const fabricated = goodReview();
  fabricated.claims[0].sourceQuote = 'The series will premiere in Germany on September 21.';
  const fabricatedDecision = decision(fabricated);
  assert.equal(fabricatedDecision.passed, false);
  assert(fabricatedDecision.reasons.some(reason => reason.includes('Quellenbeleg nicht im Original')));
  const sourceHeadlineProof = goodReview();
  sourceHeadlineProof.claims[0].sourceQuote = evidence.sourceTitle;
  assert.equal(decision(sourceHeadlineProof).passed, true, 'the original press headline is valid source material');
  assert.equal(decision(sourceHeadlineProof, article, { ...evidence, sourceTitle: 'An unrelated source title' }).passed, false);
  const nonexistentArticleQuote = goodReview();
  nonexistentArticleQuote.claims[0].articleQuote = 'Die Hauptfigur bekommt eine Zwillingsschwester.';
  assert.equal(decision(nonexistentArticleQuote).passed, false);
  for (const assessment of ['unsupported', 'contradicted'] as const) {
    const oneBad = goodReview();
    oneBad.claims.push({ ...oneBad.claims[0], assessment });
    assert.equal(decision(oneBad).passed, false, 'one bad claim fails even when other claims pass');
  }
  const wrongContext = goodReview();
  wrongContext.claims[0].source = 'context';
  assert.equal(decision(wrongContext).passed, false, 'original proof is not automatically context proof');
  assert.equal(decision(wrongContext, article, { ...evidence, verifiedContext: sourceText }).passed, true);
  assert.equal(decision(goodReview(), { ...article, headline: 'Nordhafen startet morgen' }).passed, false);
  assert.equal(decision(goodReview(), { ...article, excerpt: '' }).passed, false);
  assert.equal(decision(goodReview(), { ...article, metaDescription: '' }).passed, false);
  assert.equal(decision(goodReview(), { ...article, contentHtml: `${article.contentHtml}<script>alert(1)</script>` }).passed, false);
  const withoutSource = { ...article, contentHtml: article.contentHtml.replace(sourceLink, '') };
  assert.equal(decision(goodReview(), withoutSource).passed, false);
  assert.equal(decision(goodReview(), { ...article, contentHtml: article.contentHtml.replace('href="https://studio.example/news/nordhafen"', 'href="https://unrelated.example/story"') }).passed, false);
  assert.equal(decision(goodReview(), { ...article, contentHtml: article.contentHtml.replace('Originalmitteilung der Produktion', '') }).passed, false);
  assert.equal(decision(goodReview(), { ...withoutSource, contentHtml: `${withoutSource.contentHtml}<div class="related-articles">${sourceLink}</div>` }).passed, false, 'a related-links aside is not source attribution');

  const tooShort = { ...article, contentHtml: `<p>${paragraphs[0]}</p><p>${paragraphs[1]}</p>` };
  const shortDecision = decision(goodReview(), tooShort);
  assert.equal(shortDecision.passed, false);
  assert(shortDecision.reasons.some(reason => reason.includes('mindestens 120')));
  const wallOfText = { ...article, contentHtml: `<p>${paragraphs.join(' ')}</p>` };
  assert.equal(decision(goodReview(), wallOfText).passed, false);
  const repeated = { ...article, contentHtml: `${article.contentHtml}<p>${paragraphs[0]}</p>` };
  assert.equal(decision(goodReview(), repeated).passed, false);

  let calls = 0;
  const mustNotCall = async () => { calls++; throw new Error('unexpected model request'); };
  for (const badEvidence of [
    { ...evidence, sourceText: '' },
    { ...evidence, sourceText: 'RSS teaser only.' },
    { ...evidence, sourcePublishedAt: '' },
    { ...evidence, sourcePublishedAt: 'invalid' },
    { ...evidence, sourcePublishedAt: '2026-09-21T12:00:00.000Z' },
    { ...evidence, sourceUrl: 'http://127.0.0.1/private' },
    { ...evidence, sourceText: 'source '.repeat(10_000) },
  ]) await assert.rejects(() => reviewAndRepairArticle(article, badEvidence, { callJson: mustNotCall }));
  assert.equal(calls, 0, 'bad evidence must fail before any paid request');
  await assert.rejects(() => reviewAndRepairArticle({ ...article, contentHtml: '<p>Ein Absatz</p>'.repeat(513) }, evidence, { callJson: mustNotCall }), /Prüfbudget/);
  assert.equal(calls, 0);

  for (const raw of [null, { refusal: 'I cannot review this' }, { ...goodReview(), claims: undefined }]) {
    await assert.rejects(() => reviewAndRepairArticle(article, evidence, { callJson: async () => raw }));
  }
  for (const reason of ['model refused response', 'dependency timed out', 'truncated JSON']) {
    await assert.rejects(() => reviewAndRepairArticle(article, evidence, {
      callJson: async () => { throw new Error(reason); },
    }), error => error instanceof Error && error.message === reason);
  }
  const passed = await reviewAndRepairArticle(article, evidence, { callJson: async () => goodReview() });
  assert.equal(passed.decision.passed, true);
  assert.equal(passed.revisions, 0);

  // No first-1500-character truncation: the late allegation must reach review.
  const allegation = 'Ein Hauptdarsteller wurde wegen Betrugs verurteilt.';
  const longArticle = { ...article, contentHtml: `${article.contentHtml}<p>Die Ankündigung konzentriert sich auf die laufende Produktion. Über die Gestaltung einzelner Folgen enthält sie keine weiteren Einzelheiten. Zusätzliche Informationen sollen nach Abschluss der Dreharbeiten folgen, sobald das Team über den weiteren Ablauf entschieden hat. Bis dahin bleibt der bisher bestätigte Rahmen der Serie bestehen.</p><p>${allegation}</p>` };
  assert(longArticle.contentHtml.indexOf(allegation) > 1500);
  const lateFailure = await reviewAndRepairArticle(longArticle, evidence, {
    maxRevisions: 0,
    callJson: async (_name, _schema, instructions, data) => {
      const seen = data as { article: EditorialArticle; evidence: EditorialEvidence; bodyParagraphs: Array<{ index: number; text: string }> };
      assert.equal(seen.article.contentHtml, longArticle.contentHtml);
      assert.equal(seen.evidence.sourceText, sourceText);
      assert(instructions.includes('jeden Absatz'));
      assert.deepEqual(seen.bodyParagraphs, editorialBodyParagraphs(longArticle));
      assert.equal(seen.bodyParagraphs.at(-1)?.text, allegation);
      return { ...goodReview(longArticle), claims: [...goodReview().claims, { articleQuote: allegation, sourceQuote, source: 'original', assessment: 'unsupported' }] };
    },
  });
  assert.equal(lateFailure.decision.passed, false);
  assert(lateFailure.decision.reasons.some(reason => reason.includes(allegation)));

  // A regional announcement must remain regional. The mocked review explicitly
  // flags the unsupported Germany claim; this tests enforcement, not model IQ.
  for (const region of ['Benelux', 'United States']) {
    const regionalProof = `The premiere on September 21 is confirmed for ${region} only.`;
    const regionalEvidence = { ...evidence, sourceText: `${sourceText} ${regionalProof}` };
    const germanyClaim = 'Die Serie startet am 21. September in Deutschland.';
    const regionalArticle = { ...article, excerpt: germanyClaim };
    const result = await reviewAndRepairArticle(regionalArticle, regionalEvidence, {
      maxRevisions: 0,
      callJson: async (_name, _schema, instructions, data) => {
        assert(instructions.includes('Benelux-, US- oder UK-Pressemitteilung belegt keinen Deutschlandstart'));
        assert.equal((data as { evidence: EditorialEvidence }).evidence.sourceText, regionalEvidence.sourceText);
        return { ...goodReview(), claims: [...goodReview().claims, { articleQuote: germanyClaim, sourceQuote: regionalProof, source: 'original', assessment: 'unsupported' }] };
      },
    });
    assert.equal(result.decision.passed, false);
    const scopedClaim = `Die Terminankündigung betrifft ${region}.`;
    const scopedArticle = { ...article, excerpt: scopedClaim };
    const scopedReview = goodReview();
    scopedReview.claims.push({ articleQuote: scopedClaim, sourceQuote: regionalProof, source: 'original', assessment: 'supported' });
    assert.equal(decision(scopedReview, scopedArticle, regionalEvidence).passed, true);
  }

  const revise = { ...goodReview(), verdict: 'revise' as const, issues: [{ code: 'wording', reason: 'Vorspann präzisieren', articleQuote: excerpt }] };
  const revisedArticle = {
    ...article, excerpt: 'Nordhafen wird fortgesetzt. Die Produktion bestätigt sechs neue Episoden.',
    contentHtml: `${article.contentHtml}<p>Ein Termin für die Veröffentlichung eines Trailers ist weiterhin offen.</p>`,
  };
  const names: string[] = [];
  const repaired = await reviewAndRepairArticle(article, evidence, {
    callJson: async (name, _schema, _instructions, data) => {
      names.push(name);
      if (names.length === 1) return revise;
      if (name === 'editorial_revision') {
        assert.deepEqual((data as { findings: string[] }).findings, decision(revise).reasons);
        return revisedArticle;
      }
      assert.deepEqual((data as { article: EditorialArticle }).article, revisedArticle, 'the second review must receive the exact revision');
      assert.deepEqual((data as { bodyParagraphs: Array<{ index: number; text: string }> }).bodyParagraphs, editorialBodyParagraphs(revisedArticle));
      return goodReview(revisedArticle);
    },
  });
  assert.deepEqual(names, ['editorial_review', 'editorial_revision', 'editorial_review']);
  assert.equal(repaired.revisions, 1);
  assert.equal(repaired.decision.passed, true);
  assert.equal(repaired.decision.payloadHash, editorialPayloadHash(revisedArticle));
  assert.notEqual(repaired.decision.payloadHash, editorialPayloadHash(article));
  assert.equal(decision(goodReview(), revisedArticle).passed, false, 'old paragraph coverage cannot approve an extended revision');

  let boundedCalls = 0;
  const stillFailing = await reviewAndRepairArticle(article, evidence, {
    callJson: async name => { boundedCalls++; return name === 'editorial_revision' ? revisedArticle : revise; },
  });
  assert.equal(stillFailing.decision.passed, false);
  assert.equal(stillFailing.revisions, 1);
  assert.equal(boundedCalls, 3, 'at most one rewrite and one repeat review');
  let noRewriteCalls = 0;
  const noRewrite = await reviewAndRepairArticle(article, evidence, {
    maxRevisions: 0, callJson: async () => { noRewriteCalls++; return revise; },
  });
  assert.equal(noRewrite.decision.passed, false);
  assert.equal(noRewriteCalls, 1);
  let rejectionCalls = 0;
  const rejection = await reviewAndRepairArticle(article, evidence, {
    callJson: async () => { rejectionCalls++; return { ...goodReview(), verdict: 'reject' }; },
  });
  assert.equal(rejection.decision.passed, false);
  assert.equal(rejectionCalls, 1, 'a rejected story must not spend a rewrite attempt');
  await assert.rejects(() => reviewAndRepairArticle(article, evidence, {
    callJson: async name => name === 'editorial_revision' ? { ...revisedArticle, contentHtml: '' } : revise,
  }), /vollständiges Veröffentlichungspaket/);
  await assert.rejects(() => reviewAndRepairArticle(article, evidence, {
    callJson: async name => name === 'editorial_revision' ? { ...revisedArticle, contentHtml: `<p>${'word '.repeat(7_000)}</p>` } : revise,
  }), /Prüfbudget/);
  console.log('editorial-review tests passed (mocked model, no external calls)');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
