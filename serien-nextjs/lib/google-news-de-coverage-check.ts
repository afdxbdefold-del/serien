/**
 * "Already-Covered-In-German"-Check via Google News DE-Suche.
 *
 * Strategie für serien.de Discover-DACH-Funnel:
 *   - Wir wollen ENGLISCHE Quellen schnell adaptieren, BEVOR deutsche Publisher
 *     (moviepilot, Filmstarts, Quotenmeter, serienjunkies, gamereactor.de)
 *     dieselbe Story aufgreifen. Sind sie bereits drauf, hat unser Artikel
 *     keinen First-Mover-Advantage mehr → Discover-/Search-Wert ≈ 0.
 *
 * Implementation:
 *   - Query Google News mit hl=de&gl=DE&ceid=DE:de für die Serie.
 *   - Zähle Treffer in den letzten N Tagen (default 14).
 *   - Bei ≥ threshold (default 2) → "stale" → Story skippen.
 *
 * Optionale Whitelist: wenn deutsche Quellen-Hits NUR Trailer-Embeds /
 * "Bilder & Fotos"-Galerien sind (nicht-redaktionelle Indexierung), werden
 * sie nicht als echte Coverage gezählt.
 */

interface GnItem { title: string; source: string; pub: Date; }

const NON_EDITORIAL_TITLE_PATTERNS: RegExp[] = [
  /\bbilder\s*(?:&|und)?\s*(?:poster|fotos)\b/i,
  /\bvideos?\s+\w+\s+s\d+\b/i, // Filmstarts "Videos Worst Ex Ever S02"
  /\boffizieller?\s+trailer\b/i,
  /\bteaser\s+trailer\b/i,
  /\bsoundtrack\b/i,
];

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '')
    .trim();
}

async function fetchGnItems(query: string, lookbackDays: number): Promise<GnItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`"${query}"`)}` +
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
      const s = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const p = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      if (!t || !p) continue;
      const pub = new Date(decode(p[1]));
      if (isNaN(pub.getTime())) continue;
      items.push({
        title: decode(t[1]),
        source: s ? decode(s[1]) : '',
        pub,
      });
    }
    return items;
  } catch {
    return [];
  }
}

export interface DeCoverageResult {
  stale: boolean;
  editorialHits: number;
  nonEditorialHits: number;
  earliestPub: Date | null;
  topSources: string[];
}

/**
 * Prüft ob eine Story bei deutschen Publishern schon ausreichend gecovert
 * wurde. Default: 2+ redaktionelle Hits in 14 Tagen → stale.
 */
export async function checkGermanCoverage(
  seriesTitle: string,
  lookbackDays: number = 14,
  threshold: number = 2,
): Promise<DeCoverageResult> {
  const items = await fetchGnItems(seriesTitle, lookbackDays);
  let editorialHits = 0;
  let nonEditorialHits = 0;
  let earliestPub: Date | null = null;
  const sourceCounts = new Map<string, number>();
  for (const it of items) {
    const isNonEditorial = NON_EDITORIAL_TITLE_PATTERNS.some((rx) => rx.test(it.title));
    if (isNonEditorial) {
      nonEditorialHits++;
    } else {
      editorialHits++;
      sourceCounts.set(it.source, (sourceCounts.get(it.source) || 0) + 1);
      if (!earliestPub || it.pub < earliestPub) earliestPub = it.pub;
    }
  }
  const topSources = [...sourceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([s, c]) => `${s} (${c}x)`);
  return {
    stale: editorialHits >= threshold,
    editorialHits,
    nonEditorialHits,
    earliestPub,
    topSources,
  };
}
