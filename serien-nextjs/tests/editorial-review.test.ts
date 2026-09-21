import assert from 'node:assert/strict';
import {
  editorialBodyParagraphs, editorialPayloadHash, germanyCatalogEvidenceText, parseEditorialReview, reviewAndRepairArticle, validateEditorialReview,
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
const germanyProof = 'The announcement confirms that Nordhafen is available in Germany.';
const sourceText = `${sourceQuote} The production team confirmed that the season will contain six new episodes. The story returns to the harbour district and follows the same two investigators. Both lead actors will reprise their existing roles. Filming begins at locations already used in the first season, with further locations to follow during production. The announcement does not identify those additional locations or provide a daily filming schedule. No new characters or guest actors are announced. The team describes the continuation as the next stage of the same investigation. No broadcast date or trailer has been announced, and the announcement does not establish a release date for any territory. ${germanyProof}`;
const evidence: EditorialEvidence = {
  sourceTitle: 'Nordhafen returns to production', sourceUrl: 'https://studio.example/news/nordhafen',
  sourceText, sourcePublishedAt: '2026-09-20T08:00:00.000Z', seriesName: 'Nordhafen',
  now: new Date('2026-09-20T12:00:00.000Z'),
};
const goodReview = (candidate = article): EditorialReview => ({
  complete: true, newsworthy: true, verdict: 'publish', clarity: 4, originality: 4,
  germanyRelevance: { relevant: true, basis: 'original', evidenceQuote: germanyProof, reason: 'Wesentliche Produktionsnachricht einer ausdrücklich in Deutschland verfügbaren Serie.', newsCategory: 'series-production', localOnly: false },
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
    { ...goodReview(), germanyRelevance: undefined },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, relevant: 'true' } },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, basis: 'brand-name' } },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, evidenceQuote: 123 } },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, reason: '' } },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, newsCategory: 'gossip' } },
    { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, localOnly: undefined } },
    { ...goodReview(), coverage: undefined },
    { ...goodReview(), coverage: { ...goodReview().coverage, excerpt: 'true' } },
    ...[0, -1, 1.5, 513, '1'].map(index => ({ ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: [index] } })),
    { ...goodReview(), coverage: { ...goodReview().coverage, bodyParagraphIndexes: Array.from({ length: 513 }, () => 1) } },
    { ...goodReview(), claims: [null] },
    { ...goodReview(), claims: [{ ...goodReview().claims[0], sourceQuote: 123 }] },
    { ...goodReview(), claims: [{ ...goodReview().claims[0], assessment: 'probably' }] },
  ]) assert.throws(() => parseEditorialReview(malformed));

  const noGermanyEvidence = { ...evidence, sourceText: sourceText.replace(germanyProof, '') };
  assert.equal(decision(goodReview(), article, noGermanyEvidence).passed, false, 'a claimed DE quotation must actually exist');
  for (const patch of [{ relevant: false }, { basis: 'none' }, { localOnly: true }, { newsCategory: 'other' }, { evidenceQuote: sourceQuote }]) {
    assert.equal(decision({ ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, ...patch } }).passed, false);
  }
  for (const falseProof of [
    'Global streaming giant FixtureStream has announced a UK-only talk show.',
    'The series is not available in Germany.',
    'Germany is excluded from this worldwide release.',
    'The series premieres worldwide, excluding Germany.',
    'Die Serie ist nicht in Deutschland verfügbar.',
    'Die weltweite Marke FixtureStream kündigt ein UK-Gastinterview an.',
  ]) {
    const wronglyApproved = { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, evidenceQuote: falseProof } };
    assert.equal(decision(wronglyApproved, article, { ...noGermanyEvidence, sourceText: `${noGermanyEvidence.sourceText} ${falseProof}` }).passed, false, falseProof);
  }
  const worldwideProof = 'Nordhafen is available worldwide on the same service.';
  assert.equal(decision({ ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, evidenceQuote: worldwideProof } }, article, { ...noGermanyEvidence, sourceText: `${noGermanyEvidence.sourceText} ${worldwideProof}` }).passed, true);
  const catalogEvidence: EditorialEvidence = {
    ...noGermanyEvidence, germanyCatalog: { country: 'DE', seriesName: 'Nordhafen', providers: ['FixtureStream'] },
  };
  const catalogProof = germanyCatalogEvidenceText(catalogEvidence)!;
  const catalogReview = { ...goodReview(), germanyRelevance: { ...goodReview().germanyRelevance, basis: 'catalog-context' as const, evidenceQuote: catalogProof } };
  assert.equal(decision(catalogReview, article, catalogEvidence).passed, true);
  const catalogClaim = 'Nordhafen ist in Deutschland bei FixtureStream verfügbar.';
  assert.equal(decision({ ...catalogReview, claims: [...catalogReview.claims, { articleQuote: catalogClaim, sourceQuote: catalogProof, source: 'context', assessment: 'supported' }] }, { ...article, excerpt: catalogClaim }, catalogEvidence).passed, true, 'validated catalogue evidence may support an actual availability statement');
  assert.equal(decision(catalogReview, article, { ...noGermanyEvidence, verifiedContext: catalogProof }).passed, false, 'free-form context is not validated DE catalogue evidence');
  assert.equal(decision({ ...catalogReview, germanyRelevance: { ...catalogReview.germanyRelevance, newsCategory: 'germany-release' } }, article, catalogEvidence).passed, false, 'old DE catalogue entries prove no new DE release');
  for (const patch of [{ localOnly: true }, { newsCategory: 'other' }, { evidenceQuote: 'FixtureStream' }]) {
    assert.equal(decision({ ...catalogReview, germanyRelevance: { ...catalogReview.germanyRelevance, ...patch } }, article, catalogEvidence).passed, false, 'catalogue relevance cannot launder local slots, talk shows, ratings or gossip');
  }
  // These synthetic events exercise the deterministic evidence contract, not
  // a real model's ability to judge whether an award or chart is newsworthy.
  const audienceClaim = 'Nordhafen führt die wöchentlichen Streamingcharts in Deutschland an.';
  const audienceArticle = { ...article, headline: 'Nordhafen führt die deutschen Streamingcharts an',
    excerpt: audienceClaim, contentHtml: `${article.contentHtml}<p>${audienceClaim}</p>` };
  for (const audienceProof of [
    "Nordhafen tops Germany's weekly streaming chart.",
    'Nordhafen tops the German streaming charts this week.',
    'Nordhafen leads the streaming chart in Germany this week.',
    'Nordhafen führt die wöchentlichen Streamingcharts in Deutschland an.',
    'Nordhafen tops the streaming chart in Germany while placing third in the US.',
  ]) {
    const audienceEvidence = { ...noGermanyEvidence, sourceText: `${noGermanyEvidence.sourceText} ${audienceProof}` };
    const audienceReview: EditorialReview = { ...goodReview(audienceArticle),
      germanyRelevance: { ...goodReview().germanyRelevance, newsCategory: 'germany-audience', evidenceQuote: audienceProof },
      claims: [{ articleQuote: audienceClaim, sourceQuote: audienceProof, source: 'original', assessment: 'supported' }],
    };
    assert.equal(decision(audienceReview, audienceArticle, audienceEvidence).passed, true, audienceProof);
    assert.equal(decision({ ...audienceReview, germanyRelevance: { ...audienceReview.germanyRelevance,
      basis: 'catalog-context', evidenceQuote: catalogProof } }, audienceArticle, { ...audienceEvidence, germanyCatalog: catalogEvidence.germanyCatalog }).passed, false,
    'even a real German catalogue cannot substitute for the geography of audience metrics');
  }
  const usChartProof = 'Nordhafen leads the US streaming charts this week.';
  for (const proof of [usChartProof, worldwideProof]) {
    assert.equal(decision({ ...goodReview(audienceArticle), germanyRelevance: {
      ...goodReview().germanyRelevance, newsCategory: 'germany-audience', evidenceQuote: proof,
    } }, audienceArticle, { ...catalogEvidence, sourceText: `${sourceText} ${usChartProof} ${worldwideProof}` }).passed, false,
    'foreign metrics or worldwide availability alone cannot supply an original DE audience proof');
  }
  for (const unrelatedProof of [germanyProof, worldwideProof, `${germanyProof} ${usChartProof}`]) {
    const audienceEvidence = { ...catalogEvidence, sourceText: `${sourceText} ${worldwideProof} ${usChartProof}` };
    const audienceReview: EditorialReview = { ...goodReview(audienceArticle),
      germanyRelevance: { ...goodReview().germanyRelevance, newsCategory: 'germany-audience', evidenceQuote: unrelatedProof },
      claims: [{ articleQuote: audienceClaim, sourceQuote: usChartProof, source: 'original', assessment: 'unsupported' }],
    };
    assert.equal(decision(audienceReview, audienceArticle, audienceEvidence).passed, false,
      'a semantic review finding that the US metric does not support a German result must block publication');
    assert.equal(decision({ ...audienceReview, germanyRelevance: { ...audienceReview.germanyRelevance,
      basis: 'catalog-context', evidenceQuote: catalogProof } }, audienceArticle, audienceEvidence).passed, false,
    'foreign charts cannot acquire German relevance through catalogue evidence');
  }
  const awardClaim = 'Nordhafen gewinnt den fiktiven Serienpreis für die beste Dramaserie.';
  const awardProof = 'Nordhafen won the fictional best drama series award.';
  const awardArticle = { ...article, headline: 'Nordhafen gewinnt den fiktiven Serienpreis',
    excerpt: awardClaim, contentHtml: `${article.contentHtml}<p>${awardClaim}</p>` };
  const awardEvidence = { ...catalogEvidence, sourceText: `${sourceText} ${awardProof}` };
  const awardReview: EditorialReview = { ...goodReview(awardArticle),
    germanyRelevance: { ...goodReview().germanyRelevance, newsCategory: 'series-award' },
    claims: [{ articleQuote: awardClaim, sourceQuote: awardProof, source: 'original', assessment: 'supported' }],
  };
  assert.equal(decision(awardReview, awardArticle, awardEvidence).passed, true, 'a substantive award with original DE evidence may pass');
  const catalogAwardReview = { ...awardReview, germanyRelevance: { ...awardReview.germanyRelevance,
    basis: 'catalog-context' as const, evidenceQuote: catalogProof } };
  assert.equal(decision(catalogAwardReview, awardArticle, awardEvidence).passed, true, 'a substantive series award may use verified DE catalogue relevance');
  const synonymousAwardProof = 'Nordhafen secured the Emmy for best drama series.';
  const synonymousAwardClaim = 'Nordhafen hat den Emmy als beste Dramaserie erhalten.';
  const synonymousAwardArticle = { ...awardArticle, headline: 'Nordhafen erhält den Emmy als beste Dramaserie',
    excerpt: synonymousAwardClaim, contentHtml: awardArticle.contentHtml.replace(awardClaim, synonymousAwardClaim) };
  assert.equal(decision({ ...catalogAwardReview, claims: [{ articleQuote: synonymousAwardClaim, sourceQuote: synonymousAwardProof,
    source: 'original', assessment: 'supported' }] }, synonymousAwardArticle, { ...awardEvidence, sourceText: `${awardEvidence.sourceText} ${synonymousAwardProof}` }).passed, true,
  'valid award wording must not depend on a lexical win/nomination checklist');
  const galaProof = 'The lead actor will host the fictional awards gala.';
  assert.equal(decision({ ...catalogAwardReview, claims: [{ articleQuote: awardClaim, sourceQuote: galaProof,
    source: 'original', assessment: 'unsupported' }] }, awardArticle, { ...awardEvidence, sourceText: `${awardEvidence.sourceText} ${galaProof}` }).passed, false,
  'a semantic review finding that gala attendance does not support an award must block publication');
  assert.equal(decision({ ...catalogAwardReview, germanyRelevance: { ...catalogAwardReview.germanyRelevance,
    localOnly: true } }, awardArticle, awardEvidence).passed, false, 'award labels must not bypass the local-only exclusion');
  for (const germanyCatalog of [
    { country: 'US', seriesName: 'Nordhafen', providers: ['FixtureStream'] },
    { country: 'DE', seriesName: 'Other Show', providers: ['FixtureStream'] },
    { country: 'DE', seriesName: 'Nordhafen', providers: [] },
    { country: 'DE', seriesName: 'Nordhafen', providers: [''] },
  ]) {
    assert.equal(germanyCatalogEvidenceText({ ...catalogEvidence, germanyCatalog } as EditorialEvidence), null);
    assert.equal(decision(catalogReview, article, { ...catalogEvidence, germanyCatalog } as EditorialEvidence).passed, false);
  }

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
  let relevanceCalls = 0;
  const heldForGermany = await reviewAndRepairArticle(article, noGermanyEvidence, { callJson: async () => {
    relevanceCalls++;
    return { ...goodReview(), verdict: 'revise', germanyRelevance: { ...goodReview().germanyRelevance, relevant: false, basis: 'none', evidenceQuote: '', reason: 'Kein Deutschlandbeleg.' } };
  } });
  assert.equal(heldForGermany.decision.passed, false);
  assert.equal(relevanceCalls, 1, 'missing DE evidence cannot be manufactured through a rewrite');
  await reviewAndRepairArticle(article, catalogEvidence, { callJson: async (_name, _schema, instructions, data) => {
    assert.equal((data as { germanyCatalogEvidenceText: string }).germanyCatalogEvidenceText, catalogProof);
    assert(instructions.includes('Lokale UK-/US-Talkshows'));
    assert(instructions.includes('geografische Zuordnung der Zahlen oder Chartposition selbst'));
    assert(instructions.includes('ein separater Satz über deutsche Verfügbarkeit reicht nicht'));
    assert(instructions.includes('Erfasse den konkreten Auszeichnungs-/Nominierungsvorgang ausdrücklich in claims'));
    return catalogReview;
  } });

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
