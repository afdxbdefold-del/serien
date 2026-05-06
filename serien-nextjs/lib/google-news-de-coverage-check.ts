/**
 * "Already-Covered-In-German"-Check pro STORY-ANGLE (nicht pro Serie).
 *
 * Strategie für serien.de Discover-DACH-Funnel:
 *   - Eine Serie kann bereits 20 DE-Hits haben (Trailer, Release, Kritik), trotzdem
 *     ist ein SPEZIFISCHER ANGLE (z.B. "Wade Wilson Florida killer in Worst Ex Ever")
 *     vielleicht noch komplett unbespielt. → Neuer Angle = Wert für serien.de.
 *
 * Implementation:
 *   1. Entity-Extraction: Multi-Word-Capitalized aus EN-Headline (Personen-Namen,
 *      Episoden-Titel, Marken).
 *   2. Pro Entity: Google News DE mit `"<seriesTitle>" + <entity>`.
 *   3. Filter: nur ECHTE deutsche Publisher (Whitelist) zählen — IMDb-/ČSFD-/
 *      Wikipedia-Auto-Translations sind kein Signal.
 *   4. Schwelle: ≥1 echter deutscher Publisher-Hit zum Angle → STALE.
 */

/**
 * Whitelist echter deutscher Streaming-/TV-Publisher. Domains-only Match
 * (auch www-/m-Subdomains zählen). IMDb, ČSFD, Wikipedia, RottenTomatoes,
 * Letterboxd etc. sind BEWUSST nicht drin — die haben die gleiche Story in
 * jeder Sprachversion und sagen nichts über deutsche Redaktions-Coverage.
 */
const DE_PUBLISHER_WHITELIST: RegExp[] = [
  // Streaming/TV-Magazine
  /\bmoviepilot\.de$/i,
  /\bfilmstarts\.de$/i,
  /\bserienjunkies\.de$/i,
  /\bserienfuchs\.de$/i,
  /\bquotenmeter\.de$/i,
  /\bquotenmeter\.ch$/i,
  /\bgamereactor\.de$/i,
  /\bgamepro\.de$/i,
  /\bgamestar\.de$/i,
  /\bnetzwelt\.de$/i,
  /\bgiga\.de$/i,
  /\bcomputerbild\.de$/i,
  /\bchip\.de$/i,
  /\bturn-on\.de$/i,
  /\bfilmfutter\.com$/i,
  /\bfilmfutter\.de$/i,
  /\bfilmrezensionen\.de$/i,
  /\bcrew-united\.com$/i,
  /\brobots-and-dragons\.de$/i,
  /\bkino\.de$/i,
  /\bcineastentreff\.de$/i,
  /\bcinema\.de$/i,
  /\btv-media\.at$/i,
  /\btvspielfilm\.de$/i,
  /\bfernsehserien\.de$/i,
  /\bwunschliste\.de$/i,
  // Boulevard / Allgemein-News
  /\bspiegel\.de$/i,
  /\bfocus\.de$/i,
  /\bbild\.de$/i,
  /\bwelt\.de$/i,
  /\bzeit\.de$/i,
  /\btagesspiegel\.de$/i,
  /\bsueddeutsche\.de$/i,
  /\bfaz\.net$/i,
  /\bderstandard\.at$/i,
  /\borf\.at$/i,
  /\b20min\.ch$/i,
  /\bblick\.ch$/i,
  /\bsrf\.ch$/i,
  /\bn-tv\.de$/i,
  /\bstern\.de$/i,
  /\brnd\.de$/i,
  /\bgmx\.net$/i,
  /\bweb\.de$/i,
  /\bt-online\.de$/i,
  /\bbunte\.de$/i,
  /\bgala\.de$/i,
  /\bok-magazin\.de$/i,
  // Streaming-Specific Blogs
  /\bnerdwithtaste\.de$/i,
  /\bwortschmaus\.com$/i,
  /\bwortschmaus\.de$/i,
];

interface GnItem { title: string; sourceDomain: string; sourceName: string; pub: Date; }

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extract candidate "story-angle" entities from a headline.
 * Heuristic: 2-4-word sequences of Capitalized tokens (proper nouns,
 * episode titles, locations). Filtered against common stop tokens.
 */
const STOP = new Set([
  'The', 'A', 'An', 'And', 'Or', 'Of', 'In', 'On', 'At', 'For', 'With', 'From',
  'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'But', 'By', 'New', 'Top',
  'Netflix', 'Hulu', 'Disney', 'Apple', 'Amazon', 'Prime', 'HBO', 'Paramount',
  'Sky', 'WOW', 'Joyn', 'Peacock', 'Max', 'Crackle', 'Tubi', 'Roku',
  'Season', 'Episode', 'Series', 'Show', 'Movie', 'Trailer', 'Star', 'Stars',
  'Review', 'Guide', 'Recap', 'Spoiler', 'Spoilers', 'Schedule', 'Premiere',
  'Tonight', 'Today', 'Tomorrow', 'Yesterday', 'This', 'That', 'These', 'Those',
  'Plot', 'Cast', 'Update', 'Updates', 'Release', 'Date', 'News', 'Recap',
]);

export function extractAngleEntities(title: string, maxEntities: number = 3): string[] {
  // Strip obvious tail-junk: " - Publisher", " | Publisher", "(Exclusive)"
  const clean = title
    .replace(/\s[-–—|]\s.+$/, '')
    .replace(/\(Exclusive\)$/i, '')
    .replace(/[''"]/g, '') // remove all quote characters so "'Worst Ex Ever'" → "Worst Ex Ever"
    .trim();
  // Tokenise on whitespace and punctuation but keep apostrophes inside names.
  const tokens = clean.split(/[\s,:;!?()\[\]"]+/).filter(Boolean);
  const entities: string[] = [];
  let cluster: string[] = [];
  for (const t of tokens) {
    const isCap = /^[A-ZÄÖÜ]/.test(t) && !STOP.has(t);
    const isLowerJoiner = /^(of|the|and|de|von|in|für)$/i.test(t);
    if (isCap || (isLowerJoiner && cluster.length > 0)) {
      cluster.push(t);
    } else {
      if (cluster.length >= 2) entities.push(cluster.join(' '));
      cluster = [];
    }
  }
  if (cluster.length >= 2) entities.push(cluster.join(' '));
  // Clean trailing apostrophes/quotes/possessives.
  const cleaned = entities.map((e) => e.replace(/['']s$/, '').replace(/['']$/, '').trim());
  // Dedupe + length sort + cap.
  const unique = [...new Set(cleaned)].filter((e) => e.length >= 4);
  return unique.sort((a, b) => b.length - a.length).slice(0, maxEntities);
}

function isWhitelistedDePublisher(sourceDomain: string): boolean {
  if (!sourceDomain) return false;
  return DE_PUBLISHER_WHITELIST.some((rx) => rx.test(sourceDomain));
}

async function fetchGnDeItems(query: string, lookbackDays: number): Promise<GnItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=de&gl=DE&ceid=DE:de&when=${lookbackDays}d`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; serien.de-coverage-check/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: GnItem[] = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/gi;
    let m: RegExpExecArray | null;
    while ((m = itemRe.exec(xml))) {
      const block = m[1];
      const t = block.match(/<title>([\s\S]*?)<\/title>/i);
      const s = block.match(/<source\s+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/i);
      const p = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (!t || !p) continue;
      const pub = new Date(decode(p[1]));
      if (isNaN(pub.getTime())) continue;
      let sourceDomain = '';
      let sourceName = '';
      if (s) {
        try { sourceDomain = new URL(s[1]).hostname.toLowerCase().replace(/^www\./, ''); } catch {}
        sourceName = decode(s[2]);
      }
      items.push({ title: decode(t[1]), sourceDomain, sourceName, pub });
    }
    return items;
  } catch {
    return [];
  }
}

export interface AngleCoverageResult {
  stale: boolean;
  staleReason: string | null;
  angles: Array<{
    entity: string;
    deWhitelistedHits: GnItem[];
    deTotalHits: number;
  }>;
}

/**
 * Prüft ob ein KONKRETER STORY-ANGLE bei deutschen Publishern schon
 * gecovert wurde. Default: 1 Hit auf Whitelist-Domain → stale.
 */
export async function checkGermanAngleCoverage(
  seriesTitle: string,
  articleTitle: string,
  lookbackDays: number = 14,
  threshold: number = 1,
): Promise<AngleCoverageResult> {
  const entities = extractAngleEntities(articleTitle, 3)
    .filter((e) => {
      const eL = e.toLowerCase();
      const sL = seriesTitle.toLowerCase();
      // Reject entities identical or substring-overlapping with series title.
      if (eL === sL) return false;
      if (sL.includes(eL) || eL.includes(sL)) return false;
      // Reject entities that share more than 60% tokens with the series title.
      const sTokens = new Set(sL.split(/\s+/));
      const eTokens = eL.split(/\s+/);
      const overlap = eTokens.filter((t) => sTokens.has(t)).length / eTokens.length;
      if (overlap >= 0.6) return false;
      return true;
    });
  if (entities.length === 0) {
    return { stale: false, staleReason: null, angles: [] };
  }
  const angles: AngleCoverageResult['angles'] = [];
  for (const entity of entities) {
    const query = `"${seriesTitle}" "${entity}"`;
    const items = await fetchGnDeItems(query, lookbackDays);
    const whitelisted = items.filter((it) => isWhitelistedDePublisher(it.sourceDomain));
    angles.push({ entity, deWhitelistedHits: whitelisted, deTotalHits: items.length });
  }
  const staleAngle = angles.find((a) => a.deWhitelistedHits.length >= threshold);
  if (staleAngle) {
    const top = staleAngle.deWhitelistedHits[0];
    return {
      stale: true,
      staleReason: `Angle "${staleAngle.entity}" bereits bei ${top.sourceDomain} (${top.pub.toISOString().slice(0, 10)})`,
      angles,
    };
  }
  return { stale: false, staleReason: null, angles };
}
