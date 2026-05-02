/**
 * DACH-Network-Mapping
 *
 * Wenn TMDB keine /watch/providers für DE liefert (häufig bei brandneuen
 * Ankündigungen oder Pre-Release-Serien), fallen wir auf eine kuratierte
 * Mapping-Tabelle zurück: Original-US-/UK-Sender → bekannte DACH-Heimat.
 *
 * Quelle: redaktionelle Deal-Geschichte (Disney+ ≈ ABC/FOX/Hulu, Sky/WOW ≈
 * HBO/Max/AMC/Showtime, Paramount+ ≈ CBS/Showtime, Netflix DE ≈ CW/AMC für
 * spezifische Deals, Amazon Prime DE ≈ Sony/diverse).
 *
 * WICHTIG: Mapping ist eine **Erwartung**, kein bestätigtes Datum. Im Lead
 * IMMER als "in DACH erwartet bei …" oder "DACH-Heimat traditionell …"
 * formulieren — niemals als Tatsachenbehauptung.
 */

export interface DachExpectation {
  expectedStreamer: string;
  hedge: string;
  note?: string;
}

/**
 * US-/UK-Network → DACH-Heimat (Erwartung, nicht garantiert).
 * Reihenfolge der Keys: längere Strings zuerst, damit "BBC One" vor "BBC" matcht.
 */
const NETWORK_TO_DACH: Array<{ pattern: RegExp; expectation: DachExpectation }> = [
  // Disney-Family → Disney+
  { pattern: /\b(abc|hulu|fx|fxx|freeform|nat\s*geo|national\s*geographic|fox)\b/i,
    expectation: { expectedStreamer: 'Disney+', hedge: 'in DACH traditionell bei Disney+' } },
  // CBS-Family → Paramount+
  { pattern: /\b(cbs|paramount\s*network|showtime|nickelodeon|mtv|comedy\s*central|smithsonian)\b/i,
    expectation: { expectedStreamer: 'Paramount+', hedge: 'in DACH traditionell bei Paramount+' } },
  // NBCUniversal → Sky/WOW (Peacock-Output-Deal in DE) oder Netflix-Lizenz
  { pattern: /\b(nbc|peacock|usa\s*network|syfy|bravo|telemundo|oxygen|e!|cnbc|msnbc)\b/i,
    expectation: { expectedStreamer: 'Sky/WOW', hedge: 'in DACH meist über Sky/WOW (Peacock-Deal) erwartet' } },
  // Warner / HBO-Family → Sky/WOW
  { pattern: /\b(hbo|hbo\s*max|max|warner|tnt|tbs|cnn|tcm|cartoon\s*network|adult\s*swim)\b/i,
    expectation: { expectedStreamer: 'Sky/WOW', hedge: 'in DACH bei Sky/WOW (HBO-Output-Deal)' } },
  // CW → Netflix oder Joyn
  { pattern: /\b(cw|the\s*cw|cw\s*network)\b/i,
    expectation: { expectedStreamer: 'Netflix', hedge: 'CW-Serien laufen in DACH meist bei Netflix' } },
  // AMC → Amazon Prime / Netflix
  { pattern: /\b(amc|amc\+|amc\s*plus|sundance|ifc)\b/i,
    expectation: { expectedStreamer: 'Amazon Prime / Netflix', hedge: 'AMC-Inhalte landen in DACH meist bei Amazon Prime oder Netflix' } },
  // BBC → Disney+ / ARD / Sky (case by case)
  { pattern: /\bbbc\s*(one|two|three|four|iplayer|america)?\b/i,
    expectation: { expectedStreamer: 'Sky/Disney+/ARD-Mediathek', hedge: 'BBC-Produktionen erscheinen in DACH meist bei Sky, Disney+ oder in der ARD-Mediathek' } },
  // ITV → ARD/ZDF/Sky
  { pattern: /\b(itv|itvx)\b/i,
    expectation: { expectedStreamer: 'Sky / Mediatheken', hedge: 'ITV-Serien erscheinen in DACH meist bei Sky oder den öffentlich-rechtlichen Mediatheken' } },
  // Channel 4 / 5
  { pattern: /\bchannel\s*[45]\b/i,
    expectation: { expectedStreamer: 'unterschiedlich', hedge: 'für deutsche Zuschauer steht ein DACH-Streaming-Partner noch aus' } },
];

/**
 * Versucht für eine Liste von US-/UK-Networks die DACH-Heimat zu finden.
 * Gibt das beste (erste) Match zurück.
 */
export function mapNetworksToDach(networks: string[] | null | undefined): DachExpectation | null {
  if (!networks || networks.length === 0) return null;
  for (const net of networks) {
    const lower = net.toLowerCase();
    for (const { pattern, expectation } of NETWORK_TO_DACH) {
      if (pattern.test(lower)) return expectation;
    }
  }
  return null;
}

/**
 * Liste der DACH-Streamer-Namen, die in einem Lead/Headline einen
 * DACH-Anker erfüllen. Match ist case-insensitive und (für mehrdeutige
 * Kurz-Tokens) wortgenau, damit "arte" nicht in "startet" matcht.
 */
export const DACH_STREAMER_KEYWORDS = [
  'netflix', 'disney+', 'disney plus',
  'amazon prime', 'prime video',
  'sky', 'wow',
  'paramount+', 'paramount plus',
  'apple tv+', 'apple tv plus',
  'joyn', 'rtl+', 'rtl plus',
  'magenta tv', 'magentatv',
  'ard', 'zdf', 'arte', 'mediathek',
  'discovery+', 'discovery plus',
  'mubi', 'crunchyroll',
];

/**
 * Streamer-Tokens, die als Wort isoliert stehen müssen (Substring würde
 * zu False-Positives führen — "arte" in "startet", "sky" in "skype" usw.).
 * Werden mit `\b…\b` geprüft.
 */
const DACH_WORD_BOUNDED = new Set([
  'sky', 'wow', 'ard', 'zdf', 'arte', 'joyn', 'mubi', 'mediathek',
]);

/**
 * Phrasen, die als legitimer "kein DACH-Streamer bekannt"-Hinweis zählen.
 * Damit der Content-Generator nicht zwingend einen Streamer halluzinieren muss.
 */
export const DACH_OPEN_PHRASES = [
  'startdatum für deutschland steht',
  'startdatum in deutschland steht',
  'deutsche ausstrahlung steht aus',
  'dach-start offen',
  'dach-start steht aus',
  'für deutsche zuschauer steht',
  'für deutsche zuschauerinnen steht',
  'dach-streaming-partner steht',
  'streaming-partner für dach',
  'in dach erwartet bei',
  'in dach traditionell bei',
  'in dach meist bei',
  'in dach meist über',
];

/**
 * Prüft, ob ein Text (Lead, Headline) einen DACH-Anker enthält.
 */
export function hasDachAnchor(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const k of DACH_STREAMER_KEYWORDS) {
    if (DACH_WORD_BOUNDED.has(k)) {
      // Wortgenau: \b…\b. Escape "+" für Regex.
      const safe = k.replace(/[+]/g, '\\+');
      if (new RegExp(`\\b${safe}\\b`, 'i').test(lower)) return true;
    } else {
      if (lower.includes(k)) return true;
    }
  }
  for (const p of DACH_OPEN_PHRASES) {
    if (lower.includes(p)) return true;
  }
  return false;
}

/**
 * US-/UK-Sender, die in Headlines NICHT alleine stehen dürfen.
 * Wenn einer dieser Begriffe in der Headline vorkommt, MUSS auch ein
 * DACH-Streamer / DACH-Hinweis dabei sein. Sonst: Reject.
 */
const US_UK_NETWORK_HEADLINE_PATTERNS: RegExp[] = [
  /\b(abc|nbc|cbs|fox|the\s*cw|cw)\b/i,
  /\b(hulu|peacock|hbo(\s*max)?|amc(\s*\+|\s*plus)?|showtime)\b/i,
  /\bbbc(\s*(one|two|three|four|iplayer|america))?\b/i,
  /\b(itv|itvx|channel\s*[45])\b/i,
  /\b(usa\s*network|syfy|tnt|tbs|fxx|fx\b)\b/i,
];

/**
 * Phrasen, die US-Quoten-Talk in Headlines verraten — Discover-Gift,
 * weil DACH-User sich nicht für Nielsen-Numbers oder US-Sweeps interessieren.
 */
const US_RATINGS_PHRASES: RegExp[] = [
  /\bnielsen(\s*-?\s*(zahlen|quote|rating))?\b/i,
  /\b\d+(?:[.,]\d+)?\s*millionen?\s*us[\s-]*zuschauer/i,
  /\bzuschauer\s+in\s+den\s+usa\b/i,
  /\bus[\s-]*einschaltquote/i,
  /\bprime[\s-]*time(\s*usa)?\b/i,
  /\bsweeps\b/i,
  /\bupfronts?\b/i,
  /\b(season|series)\s*premiere\s*(?:on|auf)\s*(?:abc|nbc|cbs|fox|cw|bbc|itv|hbo|amc|fxx?)\b/i,
];

export interface UsContextCheckResult {
  ok: boolean;
  reason?: string;
  hit?: string;
}

/**
 * Prüft, ob eine Headline US-Kontext enthält, der für DACH-Discover unbrauchbar ist.
 * Toleriert US-Sender, wenn parallel ein DACH-Streamer genannt wird.
 */
export function checkHeadlineUsContext(headline: string): UsContextCheckResult {
  if (!headline) return { ok: true };

  // 1) US-Quoten/Sweeps/Upfronts/Nielsen — IMMER raus.
  for (const p of US_RATINGS_PHRASES) {
    const m = headline.match(p);
    if (m) {
      return { ok: false, reason: 'US-Quoten/Branchenslang in Headline', hit: m[0] };
    }
  }

  // 2) US-/UK-Sender ohne DACH-Anker — raus.
  const hasDach = hasDachAnchor(headline);
  for (const p of US_UK_NETWORK_HEADLINE_PATTERNS) {
    const m = headline.match(p);
    if (m && !hasDach) {
      return { ok: false, reason: `US-/UK-Sender in Headline ohne DACH-Anker`, hit: m[0] };
    }
  }

  return { ok: true };
}
