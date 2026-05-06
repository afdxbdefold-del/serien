/**
 * Google News RSS URL Decoder (2025+ batchexecute flow)
 *
 * Google News RSS items look like:
 *   <link>https://news.google.com/rss/articles/CBMixxxxx?...</link>
 *
 * Direct fetches return HTTP 400/302 to bots. To get the real publisher URL
 * (e.g. https://variety.com/2026/tv/news/...) we need a 2-step flow:
 *
 *   1. GET the wrapped page → parse `c-wiz > div` for `data-n-a-sg` (signature)
 *      and `data-n-a-ts` (timestamp). The article id is the last URL segment.
 *   2. POST to /_/DotsSplashUi/data/batchexecute with the three params encoded
 *      as f.req. Response is "AF_initDataCallback"-style; second line contains
 *      a nested JSON array; index [0][2] holds a stringified inner array; its
 *      element [1] is the decoded publisher URL.
 *
 * Returns null on any failure (caller decides fallback).
 */

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://news.google.com/',
};

interface DecodingParams {
  signature: string;
  timestamp: string;
  gnArtId: string;
}

async function getDecodingParams(wrappedUrl: string): Promise<DecodingParams | null> {
  try {
    // Google needs `?oc=5` (or another oc-value); ensure it's present.
    const urlObj = new URL(wrappedUrl);
    if (!urlObj.searchParams.has('oc')) urlObj.searchParams.set('oc', '5');
    const fetchUrl = urlObj.toString();

    const res = await fetch(fetchUrl, { headers: COMMON_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const html = await res.text();
    // Both attribute orderings can appear; try both.
    const m = html.match(/\bdata-n-a-sg="([^"]+)"[^>]*\bdata-n-a-ts="([^"]+)"/) ||
              (() => {
                const a = html.match(/\bdata-n-a-ts="([^"]+)"/);
                const b = html.match(/\bdata-n-a-sg="([^"]+)"/);
                return a && b ? [null, b[1], a[1]] as any : null;
              })();
    if (!m) return null;
    const signature = m[1];
    const timestamp = m[2];
    if (!signature || !timestamp) return null;
    const gnArtId = urlObj.pathname.split('/').pop() || '';
    if (!gnArtId) return null;
    return { signature, timestamp, gnArtId };
  } catch {
    return null;
  }
}

async function callBatchExecute(params: DecodingParams): Promise<string | null> {
  const inner = JSON.stringify([
    'Fbv4je',
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${params.gnArtId}",${params.timestamp},"${params.signature}"]`,
  ]);
  const fReq = JSON.stringify([[JSON.parse(inner)]]);
  try {
    const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({ 'f.req': fReq }).toString(),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const body = await res.text();
    // Response is XSSI-prefixed: starts with )]}'\n then JSON chunks separated by \n\n.
    // Second chunk begins with [[\"wrb.fr\",\"Fbv4je\",...
    const chunks = body.split('\n\n');
    if (chunks.length < 2) return null;
    const outer = JSON.parse(chunks[1]);
    // outer = [["wrb.fr","Fbv4je","[[\\"garturlres\\", \\"https://...\\", ...]]", ...]]
    const innerStr = outer?.[0]?.[2];
    if (typeof innerStr !== 'string') return null;
    const innerArr = JSON.parse(innerStr);
    const decoded = innerArr?.[1];
    if (typeof decoded !== 'string' || !decoded.startsWith('http')) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Decode a Google News wrapper URL to the real publisher URL.
 * Returns the decoded URL on success, the original URL on any failure (so the
 * caller can decide whether to retry, log, or skip).
 */
export async function decodeGoogleNewsUrl(wrappedUrl: string): Promise<string | null> {
  if (!/^https?:\/\/news\.google\.com\/rss\/articles\//i.test(wrappedUrl)) {
    // Already a publisher URL — pass through.
    return wrappedUrl;
  }
  const params = await getDecodingParams(wrappedUrl);
  if (!params) return null;
  return await callBatchExecute(params);
}
