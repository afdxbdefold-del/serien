/**
 * Normalisiert TMDB-Streaming-Provider-Namen:
 * – entfernt Werbung/Kids-Varianten und „… Amazon/Apple TV Channel" Rebadges
 * – fasst Doubletten auf einen kanonischen Namen zusammen (Disney Plus → Disney+ usw.)
 *
 * Wird sowohl beim Aufbau der Filter-Liste in `/serienfinder` als auch bei der
 * Filter-Übereinstimmung verwendet, damit Auswahl und Anzeige konsistent bleiben.
 */

const DROP_SUFFIXES = [
  / Amazon Channel$/i,
  / Amazon channel$/i,
  / Apple TV Channel$/i,
  / Apple TV channel$/i,
  / with Ads$/i,
  / Standard with Ads$/i,
  / Kids$/i,
];

const ALIAS: Record<string, string> = {
  'disney plus': 'Disney+',
  'amazon prime video': 'Prime Video',
  'paramount plus': 'Paramount+',
  'hbo max': 'Max',
  'wow fiction': 'WOW',
  'joyn plus': 'Joyn',
  'rtl crime': 'RTL+',
  'rtl passion': 'RTL+',
  'sat.1 emotions': 'Sat.1',
  'prosieben fun': 'ProSieben',
  'zdf krimi': 'ZDF',
  'zdf select': 'ZDF',
  'ard plus': 'ARD',
  'ard mediathek': 'ARD',
};

export function normalizeStreamerName(input: string): string | null {
  if (!input) return null;
  let n = input.trim();
  // Strip rebadge suffixes
  for (const suffix of DROP_SUFFIXES) n = n.replace(suffix, '').trim();
  // Skip obviously-noise entries that survived
  if (!n) return null;
  // Apply alias map
  const key = n.toLowerCase();
  if (ALIAS[key]) return ALIAS[key];
  return n;
}

/**
 * Kombiniert + dedupliziert eine Liste roher TMDB-Anbieter zu einer kanonischen Liste.
 * Behält die Reihenfolge der ersten Vorkommen.
 */
export function normalizeStreamerList(input: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const n = normalizeStreamerName(raw);
    if (!n) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
