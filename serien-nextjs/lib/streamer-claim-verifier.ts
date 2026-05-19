/**
 * Streamer-Claim-Verifier
 *
 * Scans a headline for explicit streaming-platform claims ("auf Netflix",
 * "auf Disney+", "streamt auf …") and verifies them against TMDB's
 * `watchProviders.results.DE.flatrate` (= the providers that actually
 * stream the show in Germany right now).
 *
 * If the headline claims a streamer that TMDB doesn't list for DE, we
 * have a `false-claim` situation — the article would mislead German
 * readers (think Handmaid's-Tale-on-Netflix-but-not-in-Germany scenario).
 *
 * We expose two helpers:
 *   • `detectStreamerClaim(headline)` — returns the streamer name the
 *     headline implies, or null.
 *   • `verifyHeadlineClaim(headline, deProviders)` — returns a decision
 *     object the pipeline can act on (keep / strip / fallback).
 *
 * Headline-Engine v5.2 templates known to embed streamer names:
 *   • "Serie X jetzt auf Netflix"
 *   • "Disney+ holt sich Y"
 *   • "Z streamt ab heute exklusiv auf Prime Video"
 *   • "WOW-Hit: …"
 *
 * The detector is intentionally conservative — only matches well-known
 * German DACH streamers, not arbitrary brand mentions.
 */

/**
 * Aliases that map a free-text streamer mention back to the canonical
 * provider name TMDB uses. TMDB names are stable strings like "Netflix",
 * "Disney Plus", "Amazon Prime Video", "Apple TV Plus".
 *
 * The first entry of each value tuple is the canonical TMDB display name.
 */
const STREAMER_ALIASES: Record<string, string[]> = {
  Netflix: ['netflix'],
  'Disney Plus': ['disney+', 'disney plus', 'disneyplus', 'disney +'],
  'Amazon Prime Video': ['prime video', 'amazon prime', 'prime', 'amazon prime video'],
  'Apple TV Plus': ['apple tv+', 'apple tv plus', 'appletv+', 'apple tv'],
  'Paramount Plus': ['paramount+', 'paramount plus', 'paramountplus'],
  Joyn: ['joyn', 'joyn plus', 'joyn+'],
  'RTL+': ['rtl+', 'rtl plus', 'rtlplus'],
  MagentaTV: ['magenta tv', 'magentatv', 'magenta'],
  WOW: ['wow', 'sky wow'],
  Sky: ['sky ticket', 'sky'],
  Crunchyroll: ['crunchyroll'],
  'Discovery+': ['discovery+', 'discovery plus', 'dplay'],
  MUBI: ['mubi'],
  ARD: ['ard mediathek', 'ardmediathek'],
  ZDF: ['zdf mediathek', 'zdfmediathek'],
};

/**
 * Tries to identify which canonical streamer name the headline implies.
 * Returns the canonical TMDB name (e.g. "Netflix", "Disney Plus") or null.
 *
 * Note: matches are word-boundary aware to avoid false hits on words
 * containing alias substrings (e.g. "Sky" inside "Skye").
 */
export function detectStreamerClaim(headline: string): string | null {
  if (!headline) return null;
  const lower = headline.toLowerCase();

  for (const [canonical, aliases] of Object.entries(STREAMER_ALIASES)) {
    for (const alias of aliases) {
      const escaped = alias.replace(/\+/g, '\\+');
      // For aliases ending in '+' \b won't match (since `+` is non-word).
      // Use a lookahead-based boundary that works on both ends.
      const pattern = alias.endsWith('+')
        ? `(?:^|[^\\w+])${escaped}(?![\\w+])`
        : `\\b${escaped}\\b`;
      if (new RegExp(pattern, 'i').test(lower)) return canonical;
    }
  }
  return null;
}

/**
 * Removes a "[preposition] [streamer]" fragment from a headline. Used as
 * a quick rewrite when verification fails — the rest of the headline
 * usually still works grammatically.
 *
 * Examples:
 *   "Handmaid's Tale jetzt auf Netflix"
 *     → "Handmaid's Tale jetzt verfügbar"
 *   "Disney+ holt sich The Bear"
 *     → "Streamer holt sich The Bear"
 */
export function stripStreamerClaim(headline: string, streamer: string): string {
  if (!headline || !streamer) return headline;

  const aliases = STREAMER_ALIASES[streamer] || [streamer.toLowerCase()];
  const aliasPattern = aliases
    .map((a) => a.replace(/\+/g, '\\+').replace(/\s+/g, '\\s+'))
    .join('|');

  let out = headline;

  // "auf <Streamer>" / "bei <Streamer>" / "via <Streamer>" — drop preposition + name.
  out = out.replace(
    new RegExp(`\\s+(?:auf|bei|via)\\s+(?:${aliasPattern})\\b`, 'gi'),
    '',
  );
  // Leading "<Streamer> holt/lädt/zeigt/startet" → generic "Streamer …"
  out = out.replace(
    new RegExp(`\\b(?:${aliasPattern})\\b`, 'gi'),
    'Streamer',
  );

  // Clean trailing connectors / punctuation that became dangling.
  return out
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([:.!?])/g, '$1')
    .replace(/^\s*[:,-]\s*/, '')
    .trim();
}

export type VerifyResult =
  | { kind: 'no-claim'; headline: string }
  | { kind: 'verified'; headline: string; streamer: string }
  | { kind: 'unknown'; headline: string; claimedStreamer: string; reason: 'no-tmdb-data' }
  | {
      kind: 'unverified';
      headline: string;
      claimedStreamer: string;
      actualDeProviders: string[];
      rewrittenHeadline: string;
    };

/**
 * Compares the streamer mentioned in the headline with the actual list
 * of providers TMDB reports for Germany. Returns a decision object:
 *
 *   • `no-claim`     — headline doesn't promise a streamer → no action
 *   • `verified`     — claim matches DE-providers → publish as-is
 *   • `unknown`      — TMDB has no DE provider data yet (data-lag on fresh
 *                     content). We MUST NOT strip the headline — that would
 *                     delete correct claims and produce false negatives.
 *   • `unverified`   — claim doesn't match → pipeline should swap headline
 *
 * `deProviders` is the array of provider_name strings from
 * `series.watchProviders.results.DE.flatrate` (TMDB schema).
 */
export function verifyHeadlineClaim(
  headline: string,
  deProviders: string[],
): VerifyResult {
  const claimed = detectStreamerClaim(headline);
  if (!claimed) return { kind: 'no-claim', headline };

  // TMDB has no DE data → don't risk stripping a correct claim. Stay neutral.
  if (!deProviders || deProviders.length === 0) {
    return { kind: 'unknown', headline, claimedStreamer: claimed, reason: 'no-tmdb-data' };
  }

  // Normalise: TMDB sometimes returns "Disney Plus" vs "Disney+"
  const normalisedProviders = deProviders.map((p) => p.trim().toLowerCase());

  // Check direct match OR alias match
  const aliases = STREAMER_ALIASES[claimed] || [claimed.toLowerCase()];
  const isMatch = aliases.some((a) =>
    normalisedProviders.some((p) => p === a || p.includes(a)),
  );

  if (isMatch) return { kind: 'verified', headline, streamer: claimed };

  const rewritten = stripStreamerClaim(headline, claimed);
  return {
    kind: 'unverified',
    headline,
    claimedStreamer: claimed,
    actualDeProviders: deProviders,
    rewrittenHeadline: rewritten,
  };
}
