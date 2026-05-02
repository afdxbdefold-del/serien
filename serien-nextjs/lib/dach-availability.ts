/**
 * DACH availability check.
 *
 * Goal: Skip articles for shows that air on US/UK linear-only networks
 * with no German-speaking distribution. We already filter UK-only
 * (Sky UK, BBC iPlayer, ITV) via SKIP_KEYWORDS. This module catches the
 * harder case where the *series.networks* array reveals a US-only signal
 * AFTER TMDB resolution (e.g. ABC, NBC, CBS, FOX, The CW shows that
 * never made it onto a DACH streamer).
 *
 * Algorithm:
 *  1. Normalise series.networks[] to lowercase.
 *  2. If ANY entry overlaps with DACH_STREAMERS → keep (relevant).
 *  3. If networks[] is empty → use the source URL/title as fallback signal:
 *     if the article mentions any US-linear network in its body → skip.
 *  4. If networks[] contains ONLY US-linear-only entries → skip.
 */

const DACH_STREAMERS = [
  // Global Streamers verfügbar in DE/AT/CH
  'netflix', 'disney+', 'disney plus', 'disney',
  'prime video', 'amazon prime', 'amazon',
  'apple tv+', 'apple tv plus', 'apple tv',
  'paramount+', 'paramount plus',
  'hbo max', 'max', 'sky de', 'sky deutschland', 'wow',
  'mubi', 'crunchyroll', 'discovery+', 'discovery plus',
  // DE FAST + Mediatheken
  'joyn', 'rtl+', 'rtl plus', 'magenta tv+', 'magenta tv',
  'ard', 'ard mediathek', 'zdf', 'zdf mediathek', 'arte',
  '3sat', 'sat.1', 'prosieben', 'prosiebensat.1', 'sixx',
  // Anime / Special
  'wakanim', 'crunchyroll',
];

const US_LINEAR_ONLY = [
  // Phase-A (Feb 2026): Big-4 US-Broadcaster (ABC, NBC, CBS, FOX, CW) entfernt.
  // Begründung: Prestige-Inhalte dieser Sender wandern fast immer auf DACH-
  // Streamer (ABC→Disney+, CBS→Paramount+, NBC→Peacock/Sky/WOW, FOX→Disney+,
  // CW→Netflix). Das alte Setup blockierte ~110× pro Tag legitime Artikel.
  // Cable-only-Marken bleiben — die landen tatsächlich selten in DACH.
  'a&e', 'a+e', 'tlc', 'lifetime', 'bravo',
  'tnt', 'tbs', 'usa network', 'syfy', 'oxygen',
  'we tv', 'wetv', 'pop tv', 'reelz', 'ovation',
  'investigation discovery', 'travel channel',
  'animal planet', 'food network', 'hgtv', 'cooking channel',
  'ion television',
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export interface DachCheckResult {
  available: boolean;
  reason: string;
  matchedDachNetwork?: string;
  matchedUsLinearNetwork?: string;
}

/**
 * @param networks  series.networks[]   (TMDB-resolved network names)
 * @param sourceUrl optional source-article URL — used as fallback when
 *                  TMDB has no network metadata.
 */
export function checkDachAvailability(
  networks: string[] | null | undefined,
  sourceUrl?: string | null,
  sourceTitle?: string | null,
): DachCheckResult {
  const lower = (networks || []).map(norm);

  // 1. Series has at least one DACH streamer — keep.
  for (const n of lower) {
    for (const d of DACH_STREAMERS) {
      if (n.includes(d)) {
        return { available: true, reason: 'matched DACH streamer', matchedDachNetwork: n };
      }
    }
  }

  // 2. Series has US-linear network → skip immediately.
  for (const n of lower) {
    for (const us of US_LINEAR_ONLY) {
      // Use word-boundary match for short labels like "abc" / "cbs" so we
      // don't match e.g. "abc.com" inside a longer string accidentally.
      const re = new RegExp(`(^|[\\s,/&|+()])${us.replace(/[+]/g, '\\+')}([\\s,/&|+()]|$)`, 'i');
      if (re.test(n)) {
        return { available: false, reason: `US-linear-only network in TMDB: ${n}`, matchedUsLinearNetwork: n };
      }
    }
  }

  // 3. networks[] empty → fallback: scan source URL + title for US-only mentions.
  if (lower.length === 0 && (sourceUrl || sourceTitle)) {
    const blob = `${sourceUrl || ''} ${sourceTitle || ''}`.toLowerCase();
    // Only fire if a US-only network appears AND no DACH streamer hint is present.
    const hasDachHint = DACH_STREAMERS.some((d) => blob.includes(d));
    if (hasDachHint) {
      return { available: true, reason: 'DACH streamer mentioned in source' };
    }
    for (const us of US_LINEAR_ONLY) {
      const re = new RegExp(`\\b${us.replace(/[+]/g, '\\+')}\\b`, 'i');
      if (re.test(blob)) {
        return { available: false, reason: `US-only network mentioned, no DACH availability: ${us}`, matchedUsLinearNetwork: us };
      }
    }
  }

  // 4. Default: pass (we don't have enough signal to block; the existing
  //    SKIP_KEYWORDS list catches the obvious cases earlier).
  return { available: true, reason: 'no US-linear signal' };
}
