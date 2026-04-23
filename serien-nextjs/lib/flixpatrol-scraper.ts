/**
 * FLIXPATROL TOP-10 SCRAPER
 *
 * Pulls daily Top-10 TV + Movie rankings per streaming platform / country
 * from FlixPatrol's public index pages. FlixPatrol publishes fully rendered
 * static HTML (no JS required) — a plain fetch + regex pass is enough and
 * keeps us off Playwright-on-Vercel tax.
 *
 * Data source is internal only. The UI does NOT attribute FlixPatrol; we
 * store rank + title + slug + date, resolve against our TMDB series table
 * for image/URL linkage, and expose them through our own endpoints.
 *
 * Robustness: one request per platform per day behind a 1h edge cache means
 * we never stress the target even if the cron overlaps with a manual run.
 */

import https from 'https';

export interface FlixpatrolEntry {
  rank: number;
  title: string;
  slug: string; // FlixPatrol-internal slug (e.g. "the-pitt")
}

export interface FlixpatrolTop10 {
  platform: string;
  country: string;
  tv: FlixpatrolEntry[];
  movies: FlixpatrolEntry[];
  scrapedAt: string;
}

/** Mirrors the URL path segment FlixPatrol uses per streamer. */
export const FLIXPATROL_PLATFORMS = {
  'hbo-max': 'hbo-max',
  netflix: 'netflix',
  'disney-plus': 'disney',
  'prime-video': 'amazon-prime',
  'apple-tv': 'apple-tv',
  paramount: 'paramount-plus',
} as const;
export type FlixpatrolPlatform = keyof typeof FLIXPATROL_PLATFORMS;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function fetchHtml(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'user-agent': UA,
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9,de;q=0.8',
          'accept-encoding': 'identity', // skip gzip — simpler parser
          connection: 'close',
        },
        timeout: 15000,
      },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`flixpatrol HTTP ${res.statusCode} for ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`flixpatrol timeout for ${url}`));
    });
  });
}

/**
 * Parse the Top-10 TV OR Movie table out of the full platform page.
 * FlixPatrol renders both as plain tables; we slice by section heading
 * and then regex out the first 10 ranked rows.
 */
function parseSection(html: string, kind: 'tv' | 'movie'): FlixpatrolEntry[] {
  const heading = kind === 'tv' ? 'TOP 10 TV Shows' : 'TOP 10 Movies';
  const start = html.indexOf(heading);
  if (start < 0) return [];
  // Slice enough to contain ~10 table rows — 20KB is plenty, stops before
  // the next section heading so we don't bleed into neighbouring tables.
  const section = html.slice(start, start + 20000);

  const matches = Array.from(
    section.matchAll(
      /<td[^>]*>\s*(\d+)\.?\s*<\/td>[\s\S]*?<a\s+href="(\/title\/([^"/]+)\/?)"[^>]*>\s*([^<]+?)\s*<\/a>/g,
    ),
  );

  const seen = new Set<number>();
  const out: FlixpatrolEntry[] = [];
  for (const m of matches) {
    const rank = parseInt(m[1], 10);
    if (rank < 1 || rank > 10 || seen.has(rank)) continue;
    seen.add(rank);
    out.push({
      rank,
      title: decodeEntities(m[4].trim()),
      slug: m[3],
    });
    if (out.length === 10) break;
  }
  // Sort ascending by rank so consumers don't care about ordering.
  return out.sort((a, b) => a.rank - b.rank);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Scrape one platform / country combo. Returns both lists in a single
 * object since a single HTML page contains them both — halves the
 * outbound-request count compared to scraping separately.
 */
export async function scrapeFlixpatrolTop10(
  platform: FlixpatrolPlatform,
  country: string = 'germany',
): Promise<FlixpatrolTop10> {
  const slug = FLIXPATROL_PLATFORMS[platform];
  const url = `https://flixpatrol.com/top10/${slug}/${country}/`;
  const html = await fetchHtml(url);
  return {
    platform,
    country,
    tv: parseSection(html, 'tv'),
    movies: parseSection(html, 'movie'),
    scrapedAt: new Date().toISOString(),
  };
}
