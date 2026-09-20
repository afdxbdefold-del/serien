import assert from 'node:assert/strict';
import { countArticleSentences, inspectArticleStructure } from '../lib/article-structure';
import { parseQualityScores, qualityCheck } from '../lib/quality-checker';
import { buildNewsWritingPrompt, parseCompletedWriterResponse, validateStructuredArticle } from '../lib/news-writing-policy';

const paragraphs = [
  'Die Dreharbeiten zur neuen Staffel beginnen im Oktober in Prag. Das teilte der verantwortliche Sender am Freitag mit. Die Hauptdarstellerin übernimmt erneut ihre bisherige Rolle und arbeitet dabei mit dem bisherigen Regisseur zusammen. Zum Team gehören außerdem zwei neue Darsteller, deren Rollen zunächst nicht genannt wurden.',
  'Für die Produktion sind acht Folgen vorgesehen. Die Geschichte setzt nach dem offenen Ende der vorigen Staffel ein und führt die Ermittlerin zurück in ihre Heimatstadt. Dort muss sie einen älteren Fall wieder aufnehmen, der laut der veröffentlichten Beschreibung mit ihrer Familie verbunden ist.',
  'Einen konkreten Veröffentlichungstermin nennt die Ankündigung noch nicht. Auch Angaben zur deutschen Auswertung fehlen in dieser Mitteilung. Die bisherige Staffel ist dort bereits verfügbar, daraus lässt sich aber kein Termin für die neuen Folgen ableiten. Weitere Informationen zur Besetzung will der Sender während der Dreharbeiten veröffentlichen.',
];
const html = `<h2>Neue Folgen entstehen in Prag</h2>\n${paragraphs.map((p, index) => `<p class="body" data-index="${index}">\n${p}\n</p>`).join('\n')}`;
const lead = 'Die neue Staffel wird in Prag gedreht. Acht Folgen sind geplant. Der Sender nennt noch keinen Starttermin.';
const markdown = `## Neue Folgen entstehen in Prag\n\n${paragraphs.join('\n\n')}`;

async function main() {
  const structure = inspectArticleStructure(html, lead);
  assert.equal(structure.paragraphs.length, 3, 'paragraphs with attributes/newlines must be preserved');
  assert.equal(structure.score, 100, 'four-sentence body paragraphs and three-sentence excerpt are valid');
  assert.equal(structure.hardFailure, false);
  assert.equal(inspectArticleStructure(`${html}<div class="related-articles"><p>${paragraphs[0]}</p></div>`, lead).score, 100, 'related-article cards are not body prose');
  assert.deepEqual(inspectArticleStructure(markdown, lead).paragraphs, structure.paragraphs, 'Markdown and HTML share the same structural interpretation');
  assert.equal(inspectArticleStructure(paragraphs.map((p) => `<p>${p}</p>`).join(''), lead).score, 100, 'headings and FAQ are not compulsory');
  assert.equal(countArticleSentences('Am 21. September spricht Dr. Meier über 1,5 Mio. Euro. Die 3. Staffel folgt später.'), 2, 'German dates, abbreviations and ordinals are not sentence boundaries');
  assert.equal(countArticleSentences('J. K. Rowling arbeitet mit David E. Kelley. Der Sender nennt acht Folgen.'), 2, 'initials in cast and creator names do not inflate sentence counts');
  assert.equal(inspectArticleStructure('<h2>Nur ein Titel</h2>').hardFailure, true);
  assert.equal(inspectArticleStructure('<p> </p><iframe src="/video"></iframe>').wordCount, 0);
  assert.equal(inspectArticleStructure(`<p>${'Ein weiterer Satz. '.repeat(6)}</p><p>Zweiter Absatz.</p>`).hardFailure, true, 'real paragraph walls still fail');
  assert.ok(inspectArticleStructure(html, 'Eins. Zwei. Drei. Vier.').score < 70, 'overlong separate excerpt is checked');
  assert.ok(inspectArticleStructure(`${html}<p>${paragraphs[0]}</p>`).issues.some((issue) => issue.includes('wortgleich')), 'duplicate prose is flagged');
  assert.deepEqual(parseQualityScores({ headline: 85, content: 90, structure: 18 }), { headline: 85, content: 90 }, 'LLM structure guess cannot reject valid HTML');
  for (const bad of [{ headline: '85', content: 90 }, { headline: NaN, content: 90 }, { headline: 85, content: 101 }, {}]) assert.throws(() => parseQualityScores(bad));

  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'unit-test-placeholder';
  let sent: any;
  globalThis.fetch = async (_input, init) => {
    sent = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ headline: 85, content: 90, structure: 18 }) } }] }), { status: 200 });
  };
  try {
    const result = await qualityCheck({ generatedArticleHtml: html, finalHeadline: 'Beispielserie dreht ihre neue Staffel in Prag', primarySeriesName: 'Beispielserie', lead });
    assert.equal(result.status, 'PASS', 'source-sized German news must survive the old Structure Score 18 regression');
    assert.equal(result.scores.structure, 100);
    assert.equal(result.failReasons.length, 0, 'possessive ihre/ihr is not reader-address failure');
    const sentArticle = JSON.parse(sent.messages[1].content);
    assert.equal(sentArticle.paragraphs.length, 3, 'reviewer receives paragraph boundaries');
    assert.equal(sentArticle.lead, lead, 'reviewer receives actual separate excerpt');
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{"headline":90,"content":90}' } }] }), { status: 200 });
    await assert.rejects(() => qualityCheck({ generatedArticleHtml: html, finalHeadline: 'Beispielserie dreht in Prag', primarySeriesName: 'Beispielserie' }), /incomplete/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
  }

  const article = { headline: 'Beispielserie dreht in Prag', metaDescription: 'Neue Folgen sind angekündigt.', lead, sections: [{ h2: '', paragraphs }], qa: [] };
  assert.deepEqual(validateStructuredArticle(article), article);
  for (const bad of [null, {}, { ...article, lead: '' }, { ...article, sections: [] }, { ...article, sections: [{ h2: 'Titel', paragraphs: [''] }] }, { ...article, qa: [{}] }]) assert.throws(() => validateStructuredArticle(bad));
  assert.deepEqual(parseCompletedWriterResponse({ finish_reason: 'stop', message: { content: JSON.stringify(article) } }), article);
  assert.throws(() => parseCompletedWriterResponse({ finish_reason: 'length', message: { content: JSON.stringify(article) } }), /incomplete/);
  assert.throws(() => parseCompletedWriterResponse({ finish_reason: 'stop', message: { refusal: 'refused', content: JSON.stringify(article) } }), /refused/);
  assert.throws(() => parseCompletedWriterResponse({ finish_reason: 'stop', message: { content: JSON.stringify(article).slice(0, -5) } }), SyntaxError);
  const prompt = buildNewsWritingPrompt({ seriesName: 'Beispielserie', originalHeadline: 'Starts in Benelux', sourceText: 'The series starts in the Benelux on September 21.', facts: {}, wordCountTarget: 1500, dachContext: { dachStreamers: [], dachExpectation: 'CBS → Paramount+ erwartet', originalNetworks: ['CBS'] } });
  assert.ok(prompt.includes('ungefähr 650 Wörter'), 'legacy 1500-word minimum is capped');
  assert.ok(prompt.includes('Ein US- oder Benelux-Start ist kein Deutschland-Start'));
  assert.ok(prompt.includes('qa muss bei NEWS leer sein'));
  assert.ok(!prompt.includes('CBS → Paramount+ erwartet'), 'unverified network-to-provider expectation is excluded from writer evidence');
  console.log('✅ Editorial structure, quality review and grounded writer regression tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
