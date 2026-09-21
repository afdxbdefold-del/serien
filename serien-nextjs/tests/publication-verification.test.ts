import assert from 'node:assert/strict';
import sharp from 'sharp';
import {
  publicationCacheTargets, revalidatePublicationCaches, verifyPublicationImage, verifyEditorialImage,
  verifyPublishedArticle, type PublicationImageInput,
} from '../lib/publication-verification';

const imageUrl = 'https://image.tmdb.org/t/p/w1280/correct-backdrop.png';
const article = { slug: 'eine-neue-serie', title: 'Eine neue Serie', heroImageUrl: imageUrl };
const provenance: PublicationImageInput = {
  url: imageUrl, expectedSeriesId: 123, imageSeriesId: 123,
  sourceBackdropPath: '/correct-backdrop.png', approvedBackdropPaths: ['/correct-backdrop.png'],
};
const response = (body: string | Buffer, type = 'text/html', status = 200) => new Response(
  body as BodyInit, { status, headers: { 'content-type': type } },
);
const network = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) =>
  ((url, init) => Promise.resolve(handler(String(url), init))) as typeof fetch;

async function run() {
  const validImage = await sharp({ create: { width: 1280, height: 720, channels: 3, background: '#334455' } }).png().toBuffer();
  const pngFetch = network((_url, init) => {
    assert.equal(init?.redirect, 'manual');
    assert.equal(init?.cache, 'no-store');
    assert(new Headers(init?.headers).get('user-agent')?.includes('SerienPublicationCheck/1.0'));
    return response(validImage, 'image/png');
  });
  const valid = await verifyPublicationImage(provenance, { fetch: pngFetch });
  assert.equal(valid.ok, true);
  assert.equal(valid.width, 1280);
  assert.equal(valid.format, 'png');
  const handSelected = await verifyEditorialImage('https://pub-owned.r2.dev/manual/my-image.png', {
    fetch: pngFetch, imageOrigins: ['https://pub-owned.r2.dev'],
  });
  assert.equal(handSelected.ok, true, 'a manually selected image needs no invented TMDB provenance');
  assert.equal(handSelected.code, 'editor-selected-image-bytes-verified');
  assert.equal((await verifyEditorialImage(imageUrl, {
    fetch: network(() => response(Buffer.from('broken raster'), 'image/png')),
  })).ok, false, 'MIME header alone must not allow a broken manually selected image');
  assert.equal((await verifyEditorialImage(imageUrl, {
    fetch: network(() => response(validImage.subarray(0, 80), 'image/png')),
  })).ok, false, 'truncated manually selected images fail decoding');

  const noFetch = network(() => { throw new Error('must not fetch'); });
  for (const input of [
    { ...provenance, imageSeriesId: 456 },
    { ...provenance, approvedBackdropPaths: [] },
    { ...provenance, sourceBackdropPath: null },
  ]) {
    const result = await verifyPublicationImage(input, { fetch: noFetch });
    assert.equal(result.code, 'image-series-provenance-missing');
  }
  for (const url of [
    'https://image.tmdb.org.evil.example/t/p/w1280/correct-backdrop.png',
    'http://image.tmdb.org/t/p/w1280/correct-backdrop.png',
    'https://user:password@image.tmdb.org/t/p/w1280/correct-backdrop.png',
    'https://127.0.0.1/images/correct-backdrop.png',
    'https://serien.de/api/admin/articles',
    'https://serien.de/_next/image?url=http://127.0.0.1/',
  ]) {
    assert.equal((await verifyPublicationImage({ ...provenance, url }, { fetch: noFetch })).ok, false);
  }
  assert.equal((await verifyPublicationImage({ ...provenance, url: 'https://image.tmdb.org/t/p/w1280/wrong.png' }, { fetch: noFetch })).code, 'image-backdrop-mismatch');
  assert.equal((await verifyPublicationImage({ ...provenance, url: '/img/hero/tv/456' }, { fetch: noFetch })).code, 'image-backdrop-mismatch');
  assert.equal((await verifyPublicationImage({ ...provenance, url: 'https://pub-owned.r2.dev/serien-nextjs/images/hero/tv/456.webp' }, {
    fetch: noFetch, imageOrigins: ['https://pub-owned.r2.dev'],
  })).code, 'image-backdrop-mismatch');

  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => response('<html>not an image</html>')) })).code, 'image-content-type-invalid');
  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => response(validImage, 'image/jpeg')) })).code, 'image-format-mismatch');
  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => response(validImage.subarray(0, 80), 'image/png')) })).ok, false);
  const smallImage = await sharp({ create: { width: 400, height: 600, channels: 3, background: '#334455' } }).png().toBuffer();
  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => response(smallImage, 'image/png')) })).code, 'image-size-or-aspect-insufficient');
  for (const [width, height, expected] of [
    [1280, 536, true], // Genuine 2.39:1 cinema backdrop at TMDB w1280.
    [1200, 500, true], // Minimum accepted landscape dimensions.
    [1199, 700, false],
    [1280, 499, false],
    [1200, 1600, false], // A high-resolution poster is still not a backdrop.
    [1200, 1200, false],
  ] as const) {
    const raster = await sharp({ create: { width, height, channels: 3, background: '#334455' } }).png().toBuffer();
    const checked = await verifyPublicationImage(provenance, { fetch: network(() => response(raster, 'image/png')) });
    assert.equal(checked.ok, expected, `backdrop dimensions ${width}x${height}`);
    if (!expected) assert.equal(checked.code, 'image-size-or-aspect-insufficient');
  }
  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => new Response(null, { status: 302, headers: { location: 'https://evil.example' } })) })).code, 'http-302');
  assert.equal((await verifyPublicationImage(provenance, { fetch: network(() => new Response(validImage as BodyInit, { headers: { 'content-length': '999999999', 'content-type': 'image/png' } })) })).code, 'response-too-large');
  assert.equal((await verifyPublicationImage(provenance, { timeoutMs: 10, fetch: network(() => new Promise(() => {})) })).code, 'request-timeout');

  const targets = publicationCacheTargets(article.slug, 'serie-eins');
  assert.deepEqual(targets.paths, ['/eine-neue-serie', '/', '/news', '/news-sitemap.xml', '/sitemap.xml', '/serie/serie-eins']);
  assert(targets.tags.includes('homepage'));
  assert(targets.tags.includes(`article-${article.slug}`));
  assert.throws(() => publicationCacheTargets('../admin'));
  let invalidated = false;
  const queuedInvalidation = await revalidatePublicationCaches(article.slug, {
    fetch: noFetch, revalidateSecret: '', invalidate(paths, tags) {
      invalidated = true;
      assert(paths.includes('/') && paths.includes('/news'));
      assert(tags.includes('homepage') && tags.includes('article-metadata'));
    },
  });
  assert.equal(queuedInvalidation.ok, true);
  assert.equal(queuedInvalidation.code, 'cache-invalidation-queued', 'route callbacks do not flush Next caches until the response completes');
  assert(invalidated, 'in-process invalidation must work without REVALIDATE_SECRET');
  assert.equal((await revalidatePublicationCaches(article.slug, { revalidateSecret: '', fetch: noFetch })).code, 'revalidation-not-configured');
  assert.equal((await revalidatePublicationCaches(article.slug, {
    revalidateSecret: 'test-only-secret', fetch: network((url, init) => {
      assert.equal(url, 'https://serien.de/api/internal/revalidate');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-only-secret');
      assert.equal(init?.redirect, 'manual');
      return response(JSON.stringify({ revalidated: JSON.parse(String(init?.body)).paths, errors: [] }), 'application/json');
    }),
  })).ok, true);
  assert.equal((await revalidatePublicationCaches(article.slug, {
    revalidateSecret: 'test-only-secret', fetch: network(() => response(JSON.stringify({ revalidated: ['/'], errors: [] }), 'application/json')),
  })).code, 'cache-invalidation-incomplete');
  assert.equal((await revalidatePublicationCaches(article.slug, { invalidate() { throw new Error('sensitive upstream body'); } })).code, 'verification-unavailable');

  const canonicalHtml = `<link rel="canonical" href="https://serien.de/${article.slug}"><h1>${article.title}</h1><img src="/_next/image?url=${encodeURIComponent(imageUrl)}&amp;w=1280&amp;q=75">`;
  const firstSlideHtml = `<section data-testid="news-highlight-carousel"><a data-testid="carousel-main-link" href="/${article.slug}">${article.title}</a><img src="${imageUrl}" alt="${article.title}"></section>`;
  const newsHtml = `<a href="/${article.slug}">${article.title}</a>`;
  const publicFetch = (homepage: string, detail = canonicalHtml, news = newsHtml) => network(url => {
    const path = new URL(url).pathname;
    assert.equal(new URL(url).origin, 'https://serien.de');
    if (path === '/_next/image') return response(validImage, 'image/png');
    return response(path === '/' ? homepage : path === '/news' ? news : detail);
  });
  const visible = await verifyPublishedArticle({ ...article, expectedCarousel: 'first' }, { fetch: publicFetch(firstSlideHtml) });
  assert.equal(visible.ok, true);
  assert.equal(visible.homepagePlacement, 'first-slide');
  assert.equal(visible.checks['hero-bytes'].ok, true);
  const brokenOptimizer = await verifyPublishedArticle(article, { fetch: network(url => {
    const path = new URL(url).pathname;
    if (path === '/_next/image') return response('optimizer rejected source', 'text/plain', 400);
    return response(path === '/' ? firstSlideHtml : path === '/news' ? newsHtml : canonicalHtml);
  }) });
  assert.equal(brokenOptimizer.ok, false);
  assert.equal(brokenOptimizer.checks.hero.ok, true);
  assert.equal(brokenOptimizer.checks['hero-bytes'].code, 'http-400');
  const laterSlideHtml = `<section data-testid="news-highlight-carousel"><a data-testid="carousel-main-link" href="/something-newer">Something newer</a><img src="${imageUrl}" alt="${article.title}"><button aria-label="Zu Slide 2 wechseln: ${article.title}"></button></section>`;
  const laterSlide = await verifyPublishedArticle(article, { fetch: publicFetch(laterSlideHtml) });
  assert.equal(laterSlide.ok, true);
  assert.equal(laterSlide.homepagePlacement, 'carousel');
  assert.equal((await verifyPublishedArticle({ ...article, expectedCarousel: 'first' }, { fetch: publicFetch(laterSlideHtml) })).checks.carousel.ok, false);
  const grid = await verifyPublishedArticle(article, { fetch: publicFetch(newsHtml) });
  assert.equal(grid.ok, true);
  assert.equal(grid.homepagePlacement, 'news-grid');
  const stale = await verifyPublishedArticle(article, { fetch: publicFetch('<main>older news</main>') });
  assert.equal(stale.ok, false);
  assert.equal(stale.checks.canonical.ok, true, 'listing failure must not imply article is absent');
  assert.equal(stale.checks.homepage.code, 'homepage-visibility-pending');
  const rscOnly = await verifyPublishedArticle(article, { fetch: publicFetch(`<script>${JSON.stringify({ href: `/${article.slug}`, title: article.title })}</script>`) });
  assert.equal(rscOnly.checks.homepage.ok, false, 'serialized hydration data is not rendered visibility');
  assert.equal((await verifyPublishedArticle(article, { fetch: publicFetch(firstSlideHtml, '<h1>wrong cached article</h1>') })).ok, false);
  const oldArticle = await verifyPublishedArticle({ ...article, expectedOnHomepage: false, expectedInNews: false }, { fetch: publicFetch('') });
  assert.equal(oldArticle.ok, true);
  assert.equal(oldArticle.homepagePlacement, 'not-checked');
  assert.equal((await verifyPublishedArticle({ ...article, slug: '../api/admin' }, { fetch: noFetch })).ok, false);
  console.log('publication-verification tests passed (offline, no production/API writes)');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
