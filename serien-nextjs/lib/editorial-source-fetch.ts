import { lookup } from 'node:dns/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { load } from 'cheerio';
import { isSafePublicHttpUrl } from './article-html-safety';
import { parseSourcePublishedAt } from './source-published-at';

export interface EditorialSource {
  title: string;
  fullText: string;
  publishDate?: Date;
}

// Publisher pages can contain several MiB of inert application state. Bound
// transport and parsing together without relaxing the extracted evidence limit.
export const MAX_EDITORIAL_SOURCE_HTML_BYTES = 8 * 1024 * 1024;

/** Choose a public IPv4 address once, then pin that address in the socket lookup.
 * Never validate DNS and let a later, independent resolution choose the target.
 */
export function publicSourceAddress(addresses: readonly string[]): string {
  if (!addresses.length || addresses.some(address => !/^\d+(?:\.\d+){3}$/.test(address)
    || !isSafePublicHttpUrl(`https://${address}/`))) throw new Error('source-address-not-public');
  return addresses[0];
}

async function requestSourceHtml(url: URL, remainingRedirects = 3): Promise<string> {
  if (!isSafePublicHttpUrl(url.href)) throw new Error('source-url-not-public');
  const response = await new Promise<{ html?: string; location?: string }>((resolve, reject) => {
    let done = false;
    const finish = (error?: Error, value?: { html?: string; location?: string }) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(value!);
    };
    const request = (url.protocol === 'https:' ? httpsGet : httpGet)(url, {
      agent: false,
      headers: {
        'user-agent': 'Mozilla/5.0 SerienEditorialSourceCheck/1.0',
        accept: 'text/html', 'accept-encoding': 'identity',
      },
      // IPv4 only: no IPv6 mapped/private-address ambiguity. This callback is
      // used by the actual socket; TLS still validates the original hostname.
      lookup: (hostname, options, callback) => {
        lookup(hostname, { family: 4, all: true }).then(records => {
          const address = publicSourceAddress(records.map(record => record.address));
          if (options.all) callback(null, [{ address, family: 4 }]);
          else callback(null, address, 4);
        }).catch(() => callback(new Error('source-dns-not-public'), ''));
      },
    }, incoming => {
      const status = incoming.statusCode || 0;
      if (status >= 300 && status < 400) {
        const location = incoming.headers.location;
        finish(location ? undefined : new Error('source-redirect-invalid'), { location });
        incoming.destroy();
        return;
      }
      if (status !== 200 || !incoming.headers['content-type']?.toLowerCase().startsWith('text/html')) {
        finish(new Error('source-response-invalid'));
        incoming.destroy();
        return;
      }
      if (Number(incoming.headers['content-length'] || 0) > MAX_EDITORIAL_SOURCE_HTML_BYTES) {
        finish(new Error('source-response-too-large'));
        incoming.destroy();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        if (done) return;
        size += chunk.length;
        if (size > MAX_EDITORIAL_SOURCE_HTML_BYTES) {
          // destroy() may synchronously emit aborted/error; preserve the cause.
          finish(new Error('source-response-too-large'));
          incoming.destroy();
        } else chunks.push(chunk);
      });
      incoming.on('end', () => finish(undefined, { html: Buffer.concat(chunks).toString('utf8') }));
      incoming.on('error', () => finish(new Error('source-response-unavailable')));
      incoming.on('aborted', () => finish(new Error('source-response-aborted')));
    });
    const timer = setTimeout(() => {
      finish(new Error('source-request-timeout'));
      request.destroy();
    }, 10_000);
    request.on('error', () => finish(new Error('source-request-unavailable')));
  });
  if (response.location) {
    if (!remainingRedirects) throw new Error('source-redirect-limit');
    return requestSourceHtml(new URL(response.location, url), remainingRedirects - 1);
  }
  return response.html || '';
}

// These are exact article-body anchors, not broad typography/content classes.
// A publisher redesign must fail closed until its new body is verified.
const PUBLISHER_BODY_SELECTORS: Record<string, string[]> = {
  'deadline.com': ['.entry-content', '.article__content'],
  'variety.com': ['article .a-content', '.c-content', '.article-body'],
  'hollywoodreporter.com': ['.entry-content', '.article-body'],
  'tvline.com': ['.entry-content', '.article-content', '.article-body'],
  'netflix.com': ['[data-uia="article-body"]', '[data-testid="article-body"]', '[data-uia="article-content"]'],
};
const ARTICLE_BODY_SELECTORS = ['[itemprop~="articleBody"]', '.entry-content', '.article-body', '.article-content', '.post-content'];

function comparableSourceUrl(value: string, baseUrl: string): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (!isSafePublicHttpUrl(url.href)) return null;
    return `${url.protocol}//${url.hostname.replace(/^www\./, '')}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/$/, '')}${url.search}`;
  } catch { return null; }
}

/** Do not borrow dates from related-story lists or arbitrary nested JSON-LD. */
function primaryArticleDates(raw: unknown, sourceUrl: string, canonicalUrl: string | undefined, now: Date): Date[] {
  const acceptedUrls = new Set([comparableSourceUrl(sourceUrl, sourceUrl)]);
  if (canonicalUrl) {
    try {
      const canonical = new URL(canonicalUrl, sourceUrl);
      const comparable = comparableSourceUrl(canonical.href, sourceUrl);
      if (comparable && canonical.hostname.replace(/^www\./, '') === new URL(sourceUrl).hostname.replace(/^www\./, '')) acceptedUrls.add(comparable);
    } catch { /* invalid canonical */ }
  }
  const dates: Date[] = [];
  const walk = (node: unknown, depth: number): void => {
    if (depth > 8 || !node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const entry of node) walk(entry, depth + 1); return; }
    const record = node as Record<string, unknown>;
    const types = Array.isArray(record['@type']) ? record['@type'] : [record['@type']];
    if (types.some(type => typeof type === 'string' && ['Article', 'NewsArticle', 'BlogPosting'].includes(type.split(/[\/#]/).pop()!))) {
      const page = record.mainEntityOfPage;
      const identity = typeof record.url === 'string' ? record.url
        : typeof page === 'string' ? page
          : page && typeof page === 'object' && typeof (page as Record<string, unknown>)['@id'] === 'string' ? (page as Record<string, string>)['@id']
            : typeof record['@id'] === 'string' ? record['@id'] : null;
      if (!identity || acceptedUrls.has(comparableSourceUrl(identity, sourceUrl))) {
        const date = parseSourcePublishedAt(typeof record.datePublished === 'string' ? record.datePublished : undefined, now);
        if (date) dates.push(date);
      }
    }
    walk(record['@graph'], depth + 1);
    walk(record.mainEntity, depth + 1);
  };
  walk(raw, 0);
  return dates;
}

/** Pure parser for offline publisher-markup fixtures; never a body/main fallback. */
export function parseEditorialSourceHtml(html: string, rawUrl: string, now = new Date()): EditorialSource {
  if (!isSafePublicHttpUrl(rawUrl)) throw new Error('source-url-not-public');
  if (typeof html !== 'string' || Buffer.byteLength(html, 'utf8') > MAX_EDITORIAL_SOURCE_HTML_BYTES) throw new Error('source-response-too-large');
  const url = new URL(rawUrl);
  const $ = load(html);
  const jsonLd = $('script[type="application/ld+json"]').toArray().map(element => $(element).text());
  const canonical = $('link[rel="canonical"]').attr('href');
  $('script,style,noscript,iframe,nav,footer,aside,button,form,[hidden],[aria-hidden="true"],.ad,.advertisement,.ads,.related,.related-posts,.related-content,.related-stories,.injected-related-story,.read-next,.newsletter,.subscribe,.promo,.sponsored,.comments,.author-bio,.author-box,.c-author,.social-share').remove();
  // Article headers can contain the actual headline and standfirst; site
  // headers are navigation, not editorial evidence.
  $('header').filter((_, element) => !$(element).closest('article').length).remove();
  const selectors = [
    '[itemprop~="articleBody"]',
    ...(PUBLISHER_BODY_SELECTORS[url.hostname.replace(/^www\./, '')] || []),
    ...ARTICLE_BODY_SELECTORS, 'article',
  ];
  let content = $('___missing_editorial_body___');
  for (const selector of [...new Set(selectors)]) {
    const candidates = $(selector).toArray().filter(element => $(element).text().trim());
    // Nested instances belong to one body; multiple sibling articles are a
    // listing or an ambiguous page, never an invitation to pick the first.
    const roots = candidates.filter(element => !$(element).parents(selector).length);
    if (roots.length > 1) throw new Error('source-article-body-ambiguous');
    if (roots.length === 1) { content = $(roots[0]); break; }
  }
  if (!content.length) throw new Error('source-article-body-missing');
  const articleScope = content.closest('article').length ? content.closest('article') : content;
  const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
  const title = clean(articleScope.find('h1').first().text()) || clean($('h1').first().text())
    || clean($('meta[property="og:title"]').attr('content') || '') || clean($('title').text());
  const fullText = content.find('p,h2,h3,h4,li,blockquote').toArray()
    .filter(element => $(element).find('p,li,blockquote').length === 0)
    .map(element => clean($(element).text())).filter(Boolean).join('\n\n');
  if (!title || title.length > 2000 || fullText.length < 600 || fullText.length + title.length > 60_000) throw new Error('source-complete-evidence-unavailable');

  const metaDates = $('meta[property="article:published_time"],meta[name="article:published_time"],meta[itemprop~="datePublished"]').toArray()
    .map(element => $(element).attr('content'));
  const articleDates = articleScope.find('time[itemprop~="datePublished"]').toArray().map(element => $(element).attr('datetime'));
  let publishDate = [...metaDates, ...articleDates].map(value => parseSourcePublishedAt(value, now)).find((date): date is Date => Boolean(date));
  if (!publishDate) {
    const dates = jsonLd.flatMap(text => {
      try { return primaryArticleDates(JSON.parse(text), rawUrl, canonical, now); } catch { return []; }
    });
    // Conflicting unlabelled article dates are not a reliable publication date.
    const uniqueDates = new Set(dates.map(date => date.toISOString()));
    if (uniqueDates.size === 1) publishDate = dates[0];
  }
  return { title, fullText, publishDate };
}

/** Original publisher HTML only. No third-party reader or logged source URL. */
export async function fetchEditorialSource(
  rawUrl: string, deps: { requestHtml?: (url: URL) => Promise<string>; now?: Date } = {},
): Promise<EditorialSource> {
  if (!isSafePublicHttpUrl(rawUrl)) throw new Error('source-url-not-public');
  const html = await (deps.requestHtml || requestSourceHtml)(new URL(rawUrl));
  return parseEditorialSourceHtml(html, rawUrl, deps.now);
}
