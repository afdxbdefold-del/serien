import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import http, { type ClientRequest, type IncomingHttpHeaders, type IncomingMessage, type RequestOptions } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { fetchEditorialSource, MAX_EDITORIAL_SOURCE_HTML_BYTES, parseEditorialSourceHtml } from '../lib/editorial-source-fetch';

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

function paddedPage(bytes: number): string {
  const html = page(`<article>${prose}</article>`, '<script type="application/json">{"padding":""}</script>');
  return html.replace('"padding":""', `"padding":"${'x'.repeat(bytes - Buffer.byteLength(html, 'utf8'))}"`);
}

interface MockSourceResponse {
  status?: number;
  headers?: IncomingHttpHeaders;
  chunks?: Buffer[];
}

/** Exercise the real request lifecycle without DNS, sockets or live publishers.
 * destroy emits synchronously to expose abort/error settlement races.
 */
async function withMockSourceResponses(responses: MockSourceResponse[], check: () => Promise<void>): Promise<void> {
  const originalGet = http.get;
  const pending = [...responses];
  http.get = ((url: URL, options: RequestOptions, onResponse: (incoming: IncomingMessage) => void) => {
    assert.equal(url.protocol, 'http:');
    assert.equal(options.agent, false);
    assert.equal(typeof options.lookup, 'function', 'the transport retains its pinned public-DNS lookup');
    assert.equal((options.headers as Record<string, string>)['accept-encoding'], 'identity');
    const scenario = pending.shift();
    assert.ok(scenario, 'unexpected source request');
    const request = new EventEmitter() as ClientRequest;
    request.destroy = () => { request.emit('error', new Error('mock-request-destroyed')); return request; };
    queueMicrotask(() => {
      const incoming = new EventEmitter() as IncomingMessage;
      incoming.statusCode = scenario.status ?? 200;
      incoming.headers = { 'content-type': 'text/html; charset=utf-8', ...scenario.headers };
      incoming.destroy = () => {
        incoming.emit('aborted');
        request.emit('error', new Error('mock-response-destroyed'));
        return incoming;
      };
      onResponse(incoming);
      for (const chunk of scenario.chunks || []) incoming.emit('data', chunk);
      incoming.emit('end');
    });
    return request;
  }) as typeof http.get;
  syncBuiltinESMExports();
  try {
    await check();
    assert.equal(pending.length, 0, 'all expected requests must be exercised');
  } finally {
    http.get = originalGet;
    syncBuiltinESMExports();
  }
}

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
  assert.equal(MAX_EDITORIAL_SOURCE_HTML_BYTES, 8 * 1024 * 1024);
  assert.equal(parseEditorialSourceHtml(paddedPage(2 * 1024 * 1024 + 1), sourceUrl, now).fullText, plain, 'inert publisher state beyond the former 2 MiB cap is not article evidence');
  const boundaryHtml = paddedPage(MAX_EDITORIAL_SOURCE_HTML_BYTES);
  assert.equal(Buffer.byteLength(boundaryHtml, 'utf8'), MAX_EDITORIAL_SOURCE_HTML_BYTES);
  assert.equal(parseEditorialSourceHtml(boundaryHtml, sourceUrl, now).fullText, plain, 'the exact byte boundary is accepted without including inert script state');
  assert.throws(() => parseEditorialSourceHtml(`${boundaryHtml} `, sourceUrl, now), /source-response-too-large/);

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

  const transportUrl = 'http://studio.example/news/example';
  const smallHtml = Buffer.from(page(article, metadata));
  await withMockSourceResponses([{ headers: { 'content-length': String(MAX_EDITORIAL_SOURCE_HTML_BYTES) }, chunks: [Buffer.from(boundaryHtml)] }], async () => {
    assert.equal((await fetchEditorialSource(transportUrl, { now })).fullText, plain, 'transport accepts an exact-boundary content length and body');
  });
  await withMockSourceResponses([{ headers: { 'content-length': String(MAX_EDITORIAL_SOURCE_HTML_BYTES + 1) } }], async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-response-too-large$/, 'oversized declared length must not be masked by destroy/error');
  });
  for (const headers of [{}, { 'content-length': '1' }]) {
    await withMockSourceResponses([{ headers, chunks: [Buffer.from(boundaryHtml), Buffer.from(' '), smallHtml] }], async () => {
      await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-response-too-large$/, 'stream cap applies with missing or dishonest length, and wins over synchronous aborted/error');
    });
  }
  await withMockSourceResponses([{ status: 503 }], async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-response-invalid$/, 'invalid responses settle before destroy');
  });
  await withMockSourceResponses([{ headers: { 'content-type': 'application/json' } }], async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-response-invalid$/);
  });
  await withMockSourceResponses([{ status: 302 }], async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-redirect-invalid$/, 'missing redirect targets retain their intended error');
  });
  await withMockSourceResponses([{ status: 302, headers: { location: '/redirected' } }, { chunks: [smallHtml] }], async () => {
    assert.equal((await fetchEditorialSource(transportUrl, { now })).fullText, plain, 'a valid redirect is settled before destroying its old response');
  });
  await withMockSourceResponses([{ status: 302, headers: { location: 'http://127.0.0.1/private' } }], async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-url-not-public$/, 'redirects must still pass the public-address gate');
  });
  await withMockSourceResponses(Array.from({ length: 4 }, () => ({ status: 302, headers: { location: '/loop' } })), async () => {
    await assert.rejects(fetchEditorialSource(transportUrl), /^Error: source-redirect-limit$/, 'the three-redirect limit is unchanged');
  });
  console.log('✅ editorial-source-fetch parser and transport contracts passed (synthetic HTML, mocked HTTP, no network)');
}

void run().catch(error => { console.error(error); process.exitCode = 1; });
