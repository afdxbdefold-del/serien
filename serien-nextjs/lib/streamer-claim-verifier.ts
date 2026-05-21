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

// ─────────────────────────────────────────────────────────────────────────
// BODY FACT-VERIFIER (v5.7)
//
// Scans the article HTML/markdown for streamer mentions paired with strong
// availability verbs ("läuft", "streamt", "verfügbar", "exklusiv", "im
// Programm von"). Each (streamer, claim) pair is then verified against the
// TMDB DE provider list. False positives — i.e. body text claiming a series
// is on Netflix when TMDB DE doesn't list Netflix — are the exact failure
// mode of the Handmaid's-Tale and Kevin-Hart hallucinations.
//
// Returns a list of unverified claims with surrounding context, so the
// pipeline can either reject the article (Discover-eligible=false) or
// surface it for editorial review.
// ─────────────────────────────────────────────────────────────────────────

export interface BodyClaim {
  streamer: string;       // canonical TMDB name, e.g. "Netflix"
  excerpt: string;        // 1-sentence excerpt around the claim (for debug)
  verb: string;           // matched availability verb
}

const AVAILABILITY_VERBS = [
  'läuft', 'streamt', 'verfügbar', 'erscheint', 'startet', 'kehrt',
  'exklusiv', 'im programm', 'zu sehen', 'abrufbar', 'bei', 'auf',
];

// Negation cues that turn a positive streamer mention into a non-claim
// or an inverted claim (e.g. "nicht auf Netflix", "weder bei Disney+").
// Examined inside a small window around the streamer mention.
const NEGATION_CUES = [
  'nicht', 'kein', 'keine', 'weder', 'noch nicht', 'bislang nicht',
  'leider nicht', 'in den usa', 'us-only', 'nur in den usa', 'nur in usa',
  'außerhalb', 'jedoch nicht', 'aber nicht', 'allerdings nicht',
];

function hasNegationNearby(sentence: string, streamerIndex: number): boolean {
  const start = Math.max(0, streamerIndex - 60);
  const end = Math.min(sentence.length, streamerIndex + 30);
  const window = sentence.slice(start, end).toLowerCase();
  return NEGATION_CUES.some(c => window.includes(c));
}

export function extractBodyStreamerClaims(htmlOrText: string): BodyClaim[] {
  if (!htmlOrText) return [];
  // Strip HTML tags very loosely — keeps reading order intact for excerpts
  const text = htmlOrText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const sentences = text.split(/(?<=[.!?])\s+/);
  const claims: BodyClaim[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    if (!AVAILABILITY_VERBS.some(v => lower.includes(v))) continue;
    const streamer = detectStreamerClaim(sentence);
    if (!streamer) continue;

    // Skip if the streamer is mentioned in a NEGATING context — those are
    // factually true statements ("nicht auf Netflix", "in den USA, nicht
    // in DE"), not hallucinated positive claims. We can't punish the body
    // for being honest about what's *not* available.
    const streamerIdx = lower.search(new RegExp(
      (STREAMER_ALIASES[streamer] || [streamer.toLowerCase()])
        .map(a => a.replace(/[+]/g, '\\+'))
        .join('|'),
      'i',
    ));
    if (streamerIdx >= 0 && hasNegationNearby(sentence, streamerIdx)) continue;

    const verb = AVAILABILITY_VERBS.find(v => lower.includes(v)) || '';
    const key = `${streamer}|${sentence.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({ streamer, excerpt: sentence.trim().slice(0, 280), verb });
  }
  return claims;
}

export interface BodyVerifyResult {
  ok: boolean;                       // false if ANY claim is unverified
  totalClaims: number;
  verifiedClaims: number;
  unverifiedClaims: Array<BodyClaim & { actualDeProviders: string[] }>;
  /**
   * Body explicitly claims "not in DE" / "US-only" while TMDB lists at least
   * one German flatrate provider. That's the original Handmaid's-Tale
   * hallucination pattern — independent of the positive-claim mismatch above.
   */
  negativeDeClaimMismatch?: { excerpt: string; actualDeProviders: string[] };
}

// Phrases that explicitly claim the show is NOT (or not yet) available in
// the German-speaking market. Used to detect inverse hallucinations.
const DE_NOT_AVAILABLE_PHRASES = [
  /nicht\s+(?:in\s+)?(?:de(?:utschland)?|dach)\s+(?:verfügbar|abrufbar|zu\s+sehen|erschienen)/i,
  /(?:noch\s+)?nicht\s+(?:in\s+)?(?:de(?:utschland)?|dach)\b/i,
  /\bus[- ]?only\b/i,
  /nur\s+in\s+(?:den\s+)?usa\b/i,
  /(?:lediglich|ausschließlich)\s+in\s+(?:den\s+)?usa\b/i,
  /(?:für\s+)?deutsche\s+fans\s+(?:bleibt|gibt\s+es)\s+(?:bisher|leider)\s+keine/i,
  /in\s+deutschland\s+(?:bisher|leider)\s+(?:nicht|keine?)/i,
];

export function verifyBodyClaims(
  htmlOrText: string,
  deProviders: string[],
): BodyVerifyResult {
  const claims = extractBodyStreamerClaims(htmlOrText);
  // No TMDB DE data: we can't verify either way → trust the body
  if (!deProviders || deProviders.length === 0) {
    return { ok: true, totalClaims: claims.length, verifiedClaims: 0, unverifiedClaims: [] };
  }

  // Inverse check: body claims "nicht in DE" / "US-only" while TMDB has DE providers
  const cleanedText = htmlOrText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  let negativeMismatch: BodyVerifyResult['negativeDeClaimMismatch'];
  for (const re of DE_NOT_AVAILABLE_PHRASES) {
    const m = cleanedText.match(re);
    if (m) {
      const idx = m.index ?? 0;
      const excerpt = cleanedText.slice(Math.max(0, idx - 60), idx + 200).trim();
      negativeMismatch = { excerpt, actualDeProviders: deProviders };
      break;
    }
  }

  const normalised = deProviders.map(p => p.trim().toLowerCase());
  const unverified: Array<BodyClaim & { actualDeProviders: string[] }> = [];
  let verifiedCount = 0;
  for (const c of claims) {
    const aliases = STREAMER_ALIASES[c.streamer] || [c.streamer.toLowerCase()];
    const isMatch = aliases.some(a => normalised.some(p => p === a || p.includes(a)));
    if (isMatch) verifiedCount++;
    else unverified.push({ ...c, actualDeProviders: deProviders });
  }
  return {
    ok: unverified.length === 0 && !negativeMismatch,
    totalClaims: claims.length,
    verifiedClaims: verifiedCount,
    unverifiedClaims: unverified,
    negativeDeClaimMismatch: negativeMismatch,
  };
}
