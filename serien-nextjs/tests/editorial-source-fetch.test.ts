import assert from 'node:assert/strict';
import { fetchEditorialSource, parseEditorialSourceHtml } from '../lib/editorial-source-fetch';

// Synthetic publisher-markup contracts; these are NOT live publisher snapshots.
const now = new Date('2026-09-21T12:00:00Z');
const date = '2026-09-20T08:00:00Z';
const title = 'Die echte Artikelüberschrift';
const first = 'Die Produktion hat den Beginn der Dreharbeiten bestätigt. Die neue Staffel umfasst sechs Episoden und setzt die bekannte Ermittlungsgeschichte fort. Die Hauptdarsteller kehren in ihren bisherigen Rollen zurück. Ein Starttermin wurde in der vorliegenden Mitteilung nicht angekündigt.';
const second = 'Die Dreharbeiten finden an zwei bereits bekannten Schauplätzen statt. Weitere Orte sind geplant, werden in der Mitteilung aber noch nicht genannt. Die Geschichte folgt erneut den beiden Ermittlern im Hafenviertel. Welche Figuren den neuen Fall auslösen, verrät die Produktion in der Ankündigung nicht.';
const last = 'Der deutsche Anbieter ist ausdrücklich in der Mitteilung genannt. Diese letzte wichtige Quellenangabe darf weder gekürzt noch durch verwandte Meldungen verdrängt werden.';
const prose = `<p>${first}</p><p>${second}</p><p>${last}</p>`;
const plain = `${first}\n\n${second}\n\n${last}`;
const json = (value: unknown) => `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
const page = (body: string, head = '') => `<html><head>${head}</head><body><header><h1>Navigationsüberschrift</h1><p>NAVIGATION_ONLY</p></header><h1>${title}</h1>${body}</body></html>`;

async function run() {
  const contracts = [
    ['https://deadline.com/2026/09/example/', '<div class="entry-content">'],
    ['https://variety.com/2026/tv/news/example/', '<div class="c-content">'],
    ['https://www.hollywoodreporter.com/tv/tv-news/example/', '<div class="entry-content">'],
    ['https://www.tvline.com/news/example/', '<div class="article-content">'],
    ['https://www.netflix.com/tudum/articles/example', '<div data-uia="article-body">'],
  ];
  for (const [url, opener] of contracts) {
    const result = parseEditorialSourceHtml(page(`<article><p>OUTSIDE_BODY_TEASER</p>${opener}${prose}<div class="related"><p>RELATED_STORY</p></div><aside><p>OTHER_NEWS</p></aside><div class="newsletter"><p>SUBSCRIBE</p></div></div></article>`, `<meta property="article:published_time" content="${date}">`), url, now);
    assert.equal(result.title, title);
    assert.equal(result.fullText, plain, `${url}: use the specific story body, not its outer wrapper`);
    assert.equal(result.publishDate?.toISOString(), new Date(date).toISOString());
  }
  const sourceUrl = 'https://studio.example/news/example';
  const varietyModern = parseEditorialSourceHtml(page(`<article><div class="article-header"><h1>${title}</h1></div><div class="a-content"><div class="vy-cx-page-content"><div class="pmc-paywall">${prose}<div class="injected-related-story"><article><h3>UNRELATED_HEADLINE</h3></article></div></div></div></div></article><article class="o-tease"><h3>SIDEBAR_TEASER</h3></article>`), 'https://variety.com/2026/tv/news/example/', now);
  assert.equal(varietyModern.fullText, plain, 'observed Variety article .a-content must exclude injected related cards and sibling article teasers');
  const parse = (body: string, head = '') => parseEditorialSourceHtml(page(body, head), sourceUrl, now);
  assert.equal(parse(`<article><header><h1>Präziser Artikeltitel</h1><p>${first}</p></header><p>${second}</p><p>${last}</p></article>`).title, 'Präziser Artikeltitel');
  assert.equal(parse(`<article><header><p>${first}</p></header><p>${second}</p><p>${last}</p></article>`).fullText, plain, 'article standfirst must survive header cleanup');
  assert.equal(parse(`<article><p>WRAPPER</p><section itemprop="articleBody">${prose}<p hidden>HIDDEN_STORY</p></section></article>`).fullText, plain);
  assert.equal(parse(`<article>${prose}<blockquote><p>Ein klar zugeordnetes kurzes Zitat.</p></blockquote></article>`).fullText.split('Ein klar zugeordnetes kurzes Zitat.').length, 2, 'nested quotes must not be counted twice');
  assert.throws(() => parse(`<main>${prose}</main>`), /body-missing/, 'main is not proof of an article');
  assert.throws(() => parse(prose), /body-missing/, 'plain body text must never become evidence');
  assert.throws(() => parse(`<article>${prose}</article><article>${prose}</article>`), /ambiguous/, 'do not choose a listing card as the article');
  assert.throws(() => parse(`<article><div class="entry-content"><p>Login to continue.</p></div>${prose}</article>`), /complete-evidence/, 'a short/paywalled article body must not be padded from its wrapper');
  assert.throws(() => parse(`<article><p>${'a'.repeat(599)}</p></article>`), /complete-evidence/);
  assert.equal(parse(`<article><p>${'a'.repeat(600)}</p></article>`).fullText.length, 600);
  assert.equal(parse(`<article><p>${'a'.repeat(60_000 - title.length)}</p></article>`).fullText.length + title.length, 60_000);
  assert.throws(() => parse(`<article><p>${'a'.repeat(60_001 - title.length)}</p></article>`), /complete-evidence/, 'oversized sources are rejected rather than silently clipped');
  assert.throws(() => parseEditorialSourceHtml(' '.repeat(2 * 1024 * 1024 + 1), sourceUrl, now), /too-large/);

  const article = `<article>${prose}</article>`;
  const metadata = `<meta property="article:published_time" content="not-a-date"><meta name="article:published_time" content="${date}">`;
  assert.equal(parse(article, metadata).publishDate?.toISOString(), new Date(date).toISOString(), 'invalid first metadata must not hide a later valid publication date');
  assert.equal(parse(article, json({ '@graph': [
    { '@type': 'WebSite', datePublished: '2026-09-19T00:00:00Z' },
    { '@type': 'NewsArticle', url: 'https://studio.example/unrelated', datePublished: '2026-09-18T00:00:00Z' },
    { '@type': 'NewsArticle', mainEntityOfPage: { '@id': sourceUrl }, datePublished: date },
  ] })).publishDate?.toISOString(), new Date(date).toISOString());
  assert.equal(parse(article, json({ '@type': 'ItemList', itemListElement: [{ '@type': 'NewsArticle', datePublished: date }] })).publishDate, undefined, 'related-card metadata is not the original publication date');
  assert.equal(parse(article, json({ '@type': 'NewsArticle', dateModified: date })).publishDate, undefined, 'a modification timestamp is not a publication timestamp');
  assert.equal(parse(article, json([{ '@type': 'NewsArticle', datePublished: date }, { '@type': 'NewsArticle', datePublished: '2026-09-19T00:00:00Z' }])).publishDate, undefined, 'ambiguous undifferentiated publication dates fail closed');
  assert.equal(parse(article, json({ '@type': 'NewsArticle', datePublished: '2026-09-22T00:00:00Z' })).publishDate, undefined);
  assert.equal(parse(article, '<script type="application/ld+json">invalid JSON</script>').publishDate, undefined);
  assert.equal(parse(article).publishDate, undefined, 'article prose does not supply its publication time');
  const canonical = 'https://studio.example/news/canonical';
  assert.equal(parse(article, `<link rel="canonical" href="${canonical}">${json({ '@type': 'NewsArticle', url: canonical, datePublished: date })}`).publishDate?.toISOString(), new Date(date).toISOString());

  let requests = 0;
  const result = await fetchEditorialSource(sourceUrl, { now, requestHtml: async url => { requests++; assert.equal(url.href, sourceUrl); return page(article, metadata); } });
  assert.equal(result.fullText, plain);
  assert.equal(requests, 1);
  await assert.rejects(fetchEditorialSource('http://127.0.0.1/private', { requestHtml: async () => { throw new Error('must not request'); } }), /not-public/);
  console.log('✅ editorial-source-fetch parser contracts passed (synthetic HTML, no network)');
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
