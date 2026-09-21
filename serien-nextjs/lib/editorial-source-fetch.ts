import { lookup } from 'node:dns/promises';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { load } from 'cheerio';
import { isSafePublicHttpUrl } from './article-html-safety';
import { findJsonLdPublishedAt, parseSourcePublishedAt } from './source-published-at';

export interface EditorialSource {
  title: string;
  fullText: string;
  publishDate?: Date;
}

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
        incoming.destroy();
        finish(location ? undefined : new Error('source-redirect-invalid'), { location });
        return;
      }
      if (status !== 200 || !incoming.headers['content-type']?.toLowerCase().startsWith('text/html')
        || Number(incoming.headers['content-length'] || 0) > 2 * 1024 * 1024) {
        incoming.destroy();
        finish(new Error('source-response-invalid'));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      incoming.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) {
          incoming.destroy();
          finish(new Error('source-response-too-large'));
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

/** Original publisher HTML only. No third-party reader or logged source URL. */
export async function fetchEditorialSource(
  rawUrl: string, deps: { requestHtml?: (url: URL) => Promise<string> } = {},
): Promise<EditorialSource> {
  if (!isSafePublicHttpUrl(rawUrl)) throw new Error('source-url-not-public');
  const $ = load(await (deps.requestHtml || requestSourceHtml)(new URL(rawUrl)));
  const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  let publishDate = parseSourcePublishedAt($('meta[property="article:published_time"]').attr('content')
    || $('meta[name="article:published_time"]').attr('content') || $('meta[itemprop="datePublished"]').attr('content')
    || $('time[itemprop="datePublished"]').attr('datetime'));
  $('script[type="application/ld+json"]').each((_, element) => {
    if (publishDate) return;
    try { publishDate = findJsonLdPublishedAt(JSON.parse($(element).text())); } catch { /* malformed metadata */ }
  });
  $('script,style,iframe,nav,header,footer,aside,.ad,.advertisement,.related-posts,.comments,button,form').remove();
  let content = $('article').first();
  if (!content.length) content = $('[itemprop="articleBody"],.entry-content,.article-body,main').first();
  if (!content.length) throw new Error('source-article-body-missing');
  const fullText = content.find('p,h2,h3,h4,li,blockquote').toArray()
    .filter(element => $(element).find('p,li,blockquote').length === 0)
    .map(element => $(element).text().replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
  if (!title || fullText.length < 600 || fullText.length + title.length > 60_000) {
    throw new Error('source-complete-evidence-unavailable');
  }
  return { title, fullText, publishDate: publishDate || undefined };
}
