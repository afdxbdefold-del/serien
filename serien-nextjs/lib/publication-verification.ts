import { load } from 'cheerio';
import sharp from 'sharp';

const SITE_ORIGIN = 'https://serien.de';
const TMDB_ORIGIN = 'https://image.tmdb.org';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_HTML_BYTES = 4 * 1024 * 1024;

export interface PublicationCheck {
  ok: boolean;
  code: string;
}

export interface ImageInspection {
  width: number;
  height: number;
  format: string;
}

export interface VerificationDependencies {
  fetch?: typeof fetch;
  /** Trusted server configuration only. Never populate this from article/source URLs. */
  imageOrigins?: readonly string[];
  timeoutMs?: number;
  inspectImage?: (bytes: Buffer) => Promise<ImageInspection>;
}

export interface PublicationImageInput {
  url: string;
  expectedSeriesId: number;
  imageSeriesId: number;
  sourceBackdropPath: string | null;
  /** Paths read from TMDB for expectedSeriesId, NOT asserted by generated content. */
  approvedBackdropPaths: readonly string[];
}

class VerificationError extends Error {
  constructor(readonly code: string) { super(code); }
}

function failure(error: unknown): PublicationCheck {
  // Do not include upstream messages, credentials, URLs or response bodies in logs.
  return { ok: false, code: error instanceof VerificationError ? error.code : 'verification-unavailable' };
}

function timeoutMs(deps: VerificationDependencies): number {
  return Math.max(10, Math.min(deps.timeoutMs ?? 8_000, 15_000));
}

function trustedImageOrigins(deps: VerificationDependencies): Set<string> {
  const origins = new Set([SITE_ORIGIN, TMDB_ORIGIN]);
  const configured = deps.imageOrigins ?? [process.env.NEXT_PUBLIC_R2_URL || ''];
  for (const candidate of configured) {
    if (!candidate) continue;
    const url = new URL(candidate);
    // No wildcard, private IP literal, local hostname, credentials or nonstandard port.
    // Only operator-owned, configured origins may extend the two fixed defaults.
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(url.hostname) ||
        /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname) ||
        /^\d+(?:\.\d+){3}$/.test(url.hostname)) {
      throw new VerificationError('invalid-image-origin-configuration');
    }
    origins.add(url.origin);
  }
  return origins;
}

function imageUrl(value: string, deps: VerificationDependencies): URL {
  const url = new URL(value, SITE_ORIGIN);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash ||
      !trustedImageOrigins(deps).has(url.origin)) throw new VerificationError('image-origin-not-allowed');
  // The verifier cannot invoke arbitrary application endpoints or arbitrary remote
  // URLs through the Next image optimizer. Verify the direct approved image URL.
  if (url.origin === SITE_ORIGIN && !/^\/(?:img|images|uploads|media)\//.test(url.pathname)) {
    throw new VerificationError('image-path-not-allowed');
  }
  if (url.origin === TMDB_ORIGIN && !/^\/t\/p\/(?:original|w\d+)\/[a-z0-9._-]+$/i.test(url.pathname)) {
    throw new VerificationError('image-path-not-allowed');
  }
  return url;
}

function validateSlug(slug: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 250) {
    throw new VerificationError('invalid-article-slug');
  }
}

/** Bounded GET, including the entire body; redirects are deliberately not followed. */
async function requestBytes(
  url: URL, limit: number, deps: VerificationDependencies, init: RequestInit = {},
): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new VerificationError('request-timeout'));
    }, timeoutMs(deps));
  });
  const request = async () => {
    const headers = new Headers(init.headers);
    // Exercise the visitor HTML response while identifying this first-party
    // check. No browser is launched and no advertising scripts are executed.
    headers.set('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 SerienPublicationCheck/1.0');
    const response = await (deps.fetch ?? fetch)(url.href, {
      ...init, headers, redirect: 'manual', cache: 'no-store', signal: controller.signal,
    });
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new VerificationError(`http-${response.status}`);
    }
    if (response.url && response.url !== url.href) {
      await response.body?.cancel();
      throw new VerificationError('unexpected-response-url');
    }
    if (Number(response.headers.get('content-length') || 0) > limit) {
      await response.body?.cancel();
      throw new VerificationError('response-too-large');
    }
    if (!response.body) throw new VerificationError('response-empty');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > limit) throw new VerificationError('response-too-large');
        chunks.push(result.value);
      }
    } finally {
      // Cancel, but do not let an uncooperative upstream delay the deadline.
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    if (!length) throw new VerificationError('response-empty');
    return {
      bytes: Buffer.concat(chunks),
      contentType: (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(),
    };
  };
  try { return await Promise.race([request(), deadline]); }
  finally { clearTimeout(timer!); }
}

async function inspectRaster(bytes: Buffer): Promise<ImageInspection> {
  const decoder = sharp(bytes, { limitInputPixels: 24_000_000, failOn: 'error' }).timeout({ seconds: 8 });
  const metadata = await decoder.metadata();
  // Metadata alone accepts some truncated files. Force raster decoding as well.
  await decoder.clone().resize(1, 1).raw().toBuffer();
  return { width: metadata.width || 0, height: metadata.height || 0, format: metadata.format || '' };
}

async function fetchRaster(url: URL, deps: VerificationDependencies): Promise<ImageInspection> {
  const { bytes, contentType } = await requestBytes(url, MAX_IMAGE_BYTES, deps);
  const formats: Record<string, string[]> = {
    'image/jpeg': ['jpeg'], 'image/png': ['png'], 'image/webp': ['webp'], 'image/avif': ['heif', 'avif'],
  };
  if (!formats[contentType]) throw new VerificationError('image-content-type-invalid');
  const inspection = await (deps.inspectImage ?? inspectRaster)(bytes);
  if (!formats[contentType].includes(inspection.format)) throw new VerificationError('image-format-mismatch');
  return inspection;
}

/** Human-selected image: verify actual raster bytes and suitability only.
 * Does not manufacture TMDB provenance or claim visual subject recognition.
 */
export async function verifyEditorialImage(
  url: string, deps: VerificationDependencies = {},
): Promise<PublicationCheck & Partial<ImageInspection>> {
  try {
    const inspection = await fetchRaster(imageUrl(url, deps), deps);
    if (inspection.width < 1200 || inspection.height < 500 || inspection.width / inspection.height < 1.2) {
      throw new VerificationError('image-size-or-aspect-insufficient');
    }
    return { ok: true, code: 'editor-selected-image-bytes-verified', ...inspection };
  } catch (error) { return failure(error); }
}

/**
 * Prepublication gate. Verifies served bytes, raster decode and trusted source
 * provenance. It does not claim visual recognition or prove that an upstream
 * catalogue record is correctly labelled. Missing provenance fails closed.
 */
export async function verifyPublicationImage(
  input: PublicationImageInput, deps: VerificationDependencies = {},
): Promise<PublicationCheck & Partial<ImageInspection>> {
  try {
    if (!Number.isSafeInteger(input.expectedSeriesId) || input.expectedSeriesId <= 0 ||
        input.imageSeriesId !== input.expectedSeriesId ||
        !input.sourceBackdropPath ||
        !/^\/[a-z0-9._-]+$/i.test(input.sourceBackdropPath) ||
        !input.approvedBackdropPaths.includes(input.sourceBackdropPath)) {
      throw new VerificationError('image-series-provenance-missing');
    }
    const url = imageUrl(input.url, deps);
    if (url.origin === TMDB_ORIGIN && !url.pathname.endsWith(input.sourceBackdropPath)) {
      throw new VerificationError('image-backdrop-mismatch');
    }
    if (url.origin === SITE_ORIGIN) {
      const proxy = url.pathname.match(/^\/img\/tmdb\/(?:original|w\d+)(\/[^/]+)$/);
      const series = url.pathname.match(/^\/img\/hero\/tv\/(\d+)$/);
      if (proxy ? proxy[1] !== input.sourceBackdropPath : series ? Number(series[1]) !== input.expectedSeriesId : true) {
        throw new VerificationError('image-backdrop-mismatch');
      }
    }
    // Standard R2 assets contain their series ID. Reject a mismatched ID even if
    // other provenance was accidentally copied from the selected series.
    const storedSeries = url.pathname.match(/\/(?:hero|og)\/tv\/(\d+)\.[a-z0-9]+$/i);
    if (storedSeries && Number(storedSeries[1]) !== input.expectedSeriesId) {
      throw new VerificationError('image-backdrop-mismatch');
    }
    const inspection = await fetchRaster(url, deps);
    if (inspection.width < 1200 || inspection.height < 500 || inspection.width / inspection.height < 1.2) {
      throw new VerificationError('image-size-or-aspect-insufficient');
    }
    return { ok: true, code: 'image-verified', ...inspection };
  } catch (error) { return failure(error); }
}

export function publicationCacheTargets(slug: string, seriesSlug?: string): { paths: string[]; tags: string[] } {
  validateSlug(slug);
  if (seriesSlug) validateSlug(seriesSlug);
  return {
    paths: [`/${slug}`, '/', '/news', '/news-sitemap.xml', '/sitemap.xml', ...(seriesSlug ? [`/serie/${seriesSlug}`] : [])],
    tags: ['homepage', 'article', 'article-metadata', `article-${slug}`, 'series-articles', 'author-series-articles'],
  };
}

export interface CacheInvalidationDependencies extends VerificationDependencies {
  /** Use inside the Next route; invalidation is queued until the route responds. */
  invalidate?: (paths: string[], tags: string[]) => void | Promise<void>;
  revalidateSecret?: string;
  seriesSlug?: string;
}

/** Run after the committed publication, never inside a DB transaction. */
export async function revalidatePublicationCaches(
  slug: string, deps: CacheInvalidationDependencies = {},
): Promise<PublicationCheck> {
  try {
    const { paths, tags } = publicationCacheTargets(slug, deps.seriesSlug);
    if (deps.invalidate) {
      await deps.invalidate(paths, tags);
      // Next defers tag/path invalidation until the current route handler
      // returns. A successful callback is not proof a separate request already
      // sees fresh content; use HTTP invalidation or a later recovery run.
      return { ok: true, code: 'cache-invalidation-queued' };
    }
    const secret = deps.revalidateSecret ?? process.env.REVALIDATE_SECRET;
    if (!secret?.trim()) return { ok: false, code: 'revalidation-not-configured' };
    const { bytes } = await requestBytes(new URL('/api/internal/revalidate', SITE_ORIGIN), 32_768, deps, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ paths }),
    });
    const result = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(result.revalidated) || !Array.isArray(result.errors) || result.errors.length ||
        paths.some(path => !result.revalidated.includes(path))) throw new VerificationError('cache-invalidation-incomplete');
    // The existing internal endpoint invalidates paths (and data used on those
    // routes), not arbitrary tags. Prefer the in-process callback when available.
    return { ok: true, code: 'cache-paths-invalidated' };
  } catch (error) { return failure(error); }
}

export interface PublishedArticleInput {
  slug: string;
  title: string;
  heroImageUrl: string;
  expectedOnHomepage?: boolean;
  expectedInNews?: boolean;
  expectedCarousel?: 'first' | 'present';
}

export interface PublishedArticleVerification {
  ok: boolean;
  checks: Record<string, PublicationCheck>;
  homepagePlacement: 'first-slide' | 'carousel' | 'news-grid' | 'missing' | 'not-checked';
}

function sameArticle(href: string | undefined, canonical: string): boolean {
  try { return new URL(href || '', SITE_ORIGIN).href === canonical; }
  catch { return false; }
}

function sameImage(actual: string | undefined, expected: string): boolean {
  try {
    let url = new URL(actual || '', SITE_ORIGIN);
    if (url.origin === SITE_ORIGIN && url.pathname === '/_next/image') {
      url = new URL(url.searchParams.get('url') || '', SITE_ORIGIN);
    }
    const wanted = new URL(expected, SITE_ORIGIN);
    return url.origin === wanted.origin && url.pathname === wanted.pathname;
  } catch { return false; }
}

async function htmlAt(path: string, deps: VerificationDependencies) {
  const { bytes, contentType } = await requestBytes(new URL(path, SITE_ORIGIN), MAX_HTML_BYTES, deps);
  if (contentType !== 'text/html') throw new VerificationError('page-content-type-invalid');
  return load(bytes.toString('utf8'));
}

/**
 * Read-only postpublication verification. A 200/RSC payload alone is not proof of
 * visible content. Check actual HTML elements, and report stale listings without
 * rolling back or deleting an already-public article. Call again after ISR if
 * needed; this function deliberately has no retry loop or publishing side effect.
 */
export async function verifyPublishedArticle(
  input: PublishedArticleInput, deps: VerificationDependencies = {},
): Promise<PublishedArticleVerification> {
  const checks: Record<string, PublicationCheck> = {};
  let homepagePlacement: PublishedArticleVerification['homepagePlacement'] = 'not-checked';
  try { validateSlug(input.slug); }
  catch (error) { return { ok: false, checks: { input: failure(error) }, homepagePlacement }; }
  const canonical = `${SITE_ORIGIN}/${input.slug}`;
  const record = (name: string, ok: boolean, code: string) => { checks[name] = { ok, code: ok ? 'verified' : code }; };
  await Promise.all([
    (async () => {
      try {
        const $ = await htmlAt(`/${input.slug}`, deps);
        record('canonical', $('link[rel="canonical"]').toArray().some(el => sameArticle($(el).attr('href'), canonical)), 'canonical-missing-or-wrong');
        const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();
        record('headline', $('h1').toArray().some(el => normalise($(el).text()) === normalise(input.title)), 'headline-not-rendered');
        const hero = $('img, video[poster]').toArray().find(el => sameImage($(el).attr('src') || $(el).attr('poster'), input.heroImageUrl));
        record('hero', Boolean(hero), 'hero-not-rendered');
        if (hero) {
          try {
            // Verify the URL the browser actually requests, including Next's
            // image optimizer. A healthy upstream alone does not prove it renders.
            imageUrl(input.heroImageUrl, deps);
            const served = new URL($(hero).attr('src') || $(hero).attr('poster')!, SITE_ORIGIN);
            if (served.origin === SITE_ORIGIN && served.pathname === '/_next/image') {
              if (served.username || served.password || served.hash ||
                  [...served.searchParams.keys()].some(key => !['url', 'w', 'q'].includes(key))) {
                throw new VerificationError('image-path-not-allowed');
              }
              imageUrl(served.searchParams.get('url') || '', deps);
            } else { imageUrl(served.href, deps); }
            await fetchRaster(served, deps);
            record('hero-bytes', true, 'hero-response-invalid');
          } catch (error) { checks['hero-bytes'] = failure(error); }
        }
      } catch (error) { checks.article = failure(error); }
    })(),
    (async () => {
      if (input.expectedOnHomepage === false && !input.expectedCarousel) return;
      try {
        const $ = await htmlAt('/', deps);
        const carousel = $('[data-testid="news-highlight-carousel"]');
        const first = carousel.find('[data-testid="carousel-main-link"]').toArray().some(el => sameArticle($(el).attr('href'), canonical));
        const matchingImage = carousel.find('img').toArray().some(el => sameImage($(el).attr('src'), input.heroImageUrl) && $(el).attr('alt') === input.title);
        const dot = carousel.find('button').toArray().some(el => $(el).attr('aria-label')?.endsWith(`: ${input.title}`));
        const linked = $('a[href]').toArray().some(el => sameArticle($(el).attr('href'), canonical));
        homepagePlacement = first ? 'first-slide' : matchingImage && dot ? 'carousel' : linked ? 'news-grid' : 'missing';
        record('homepage', homepagePlacement !== 'missing', 'homepage-visibility-pending');
        if (input.expectedCarousel) {
          record('carousel', input.expectedCarousel === 'first' ? first : first || (matchingImage && dot), 'carousel-visibility-pending');
        }
      } catch (error) { checks.homepage = failure(error); }
    })(),
    (async () => {
      if (input.expectedInNews === false) return;
      try {
        const $ = await htmlAt('/news', deps);
        record('news', $('a[href]').toArray().some(el => sameArticle($(el).attr('href'), canonical)), 'news-visibility-pending');
      } catch (error) { checks.news = failure(error); }
    })(),
  ]);
  return { ok: Object.values(checks).every(check => check.ok), checks, homepagePlacement };
}
