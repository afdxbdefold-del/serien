/**
 * US-Only Streaming News Filter
 *
 * Catches articles where the headline + lead announce a US-only streaming
 * event (e.g. "Das Boot startet auf MHz Choice in den USA"), even when the
 * show itself is German. The DACH audience cannot use US-only providers,
 * so these articles are irrelevant noise that hurts Discover Quality.
 *
 * The existing `german-angle-coverage` filter accepts a mandatory one-liner
 * like "In Deutschland bereits bei Netflix verfügbar" as proof of DACH
 * relevance — but a token DACH mention isn't the same as a DACH NEWS event.
 *
 * Heuristic:
 *   1. Headline mentions US audience / US release / US streamer keyword
 *   2. Body's first 400 chars mention a US-only streaming provider
 *   3. DACH streamer NOT mentioned as the news event (only as side-note)
 *   → block with errorStep='us-streaming-only'
 */

// Streaming providers that operate exclusively or near-exclusively in the
// US market and have no DACH presence. If one of these is the news subject,
// the article has no value to a German-speaking audience.
const US_ONLY_PROVIDERS = [
  'mhz choice', 'mhzchoice',
  'hulu',
  'peacock',
  'paramount+ us',
  'sundance now',
  'acorn tv',
  'ovid.tv', 'ovid tv',
  'topic',
  'shudder',
  'philo',
  'fubo', 'fubotv',
  'sling tv',
  'youtube tv',
  'directv stream',
  'tubi',
  'pluto tv us',
  'crackle',
  'cw seed',
  'imdb tv',
  'freevee',
];

// DACH-available streaming providers — if any of these is mentioned as the
// news subject (not just as side-note), the article is DACH-relevant
// regardless of secondary US mentions.
const DACH_PROVIDERS = [
  'netflix',
  'amazon prime', 'prime video',
  'disney+', 'disney plus',
  'apple tv+', 'apple tv plus',
  'sky', 'wow', 'wow tv',
  'paramount+', // available in DACH too
  'rtl+', 'rtl plus',
  'magenta tv',
  'joyn',
  'mubi',
  'ard mediathek', 'zdf mediathek',
  'crunchyroll',
];

// Strong US-audience markers in the headline that signal "this is US news"
const US_AUDIENCE_MARKERS = [
  /\bus[\s-]?zuschauer\b/i,
  /\bus[\s-]?publikum\b/i,
  /\bus[\s-]?release\b/i,
  /\bus[\s-]?start(?:termin)?\b/i,
  /\bus[\s-]?streaming(?:start)?\b/i,
  /\bus[\s-]?premiere\b/i,
  /\bus[\s-]?fans\b/i,
  /\bamerikanische[snm]?\s+zuschauer\b/i,
  /\bamerikanische[snm]?\s+publikum\b/i,
  /\bin\s+den\s+usa\b/i,
  /\bfür\s+us[\s-]?zuschauer\b/i,
];

// Floskel patterns: "in Deutschland (bereits) bei X (verfügbar|abrufbar|...)"
// — these are mandatory side-mentions that don't make the news DACH-relevant.
// Match: "in deutschland bei netflix verfügbar", "in deutschland bereits auf
// sky abrufbar", "die serie läuft in deutschland bei amazon prime", etc.
const DACH_SIDE_NOTE_PATTERNS = [
  /\bin\s+deutschland\b[^.]{0,80}(verfugbar|verfuegbar|abrufbar|erhaltlich|erhältlich|zu\s+sehen|laufen|läuft|streamt|gestreamt)/i,
  /\bbereits\s+(in|bei|auf)\s+(deutschland|netflix|sky|wow|disney|amazon|prime|apple\s+tv)\b/i,
  /\b(österreich|austria|schweiz|switzerland|dach)\b[^.]{0,80}(verfugbar|verfuegbar|abrufbar)/i,
];

export interface UsOnlyCheckInput {
  headline: string;
  /** Article body (HTML or markdown). */
  body: string;
  /** Optional: original source title for additional context. */
  sourceTitle?: string;
}

export interface UsOnlyCheckResult {
  blocked: boolean;
  reason: string;
  signals: {
    headlineHasUsMarker: boolean;
    usProvidersFound: string[];
    dachProvidersInLead: string[];
    dachIsOnlySideNote: boolean;
    leadIsUsCentric: boolean;
  };
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkUsOnlyStreaming(input: UsOnlyCheckInput): UsOnlyCheckResult {
  const headline = normalize(input.headline);
  const sourceTitle = normalize(input.sourceTitle || '');
  const body = stripHtml(input.body);
  const bodyNorm = normalize(body);
  // We scan the FULL body for US providers (some articles mention them
  // mid-article rather than in the lead). DACH provider check stays in lead.
  const lead = bodyNorm.substring(0, 400);
  const leadFirstHalf = bodyNorm.substring(0, 200);

  // 1) Headline mentions US audience/release
  const headlineHasUsMarker = US_AUDIENCE_MARKERS.some((re) => re.test(headline)) ||
    US_AUDIENCE_MARKERS.some((re) => re.test(sourceTitle));

  // 2) US-only providers anywhere in headline OR body
  const usProvidersFound = US_ONLY_PROVIDERS.filter(
    (p) => headline.includes(p) || bodyNorm.includes(p),
  );

  // 3) DACH provider mentions in lead
  const dachProvidersInLead = DACH_PROVIDERS.filter((p) => lead.includes(p));
  const dachInFirstHalf = DACH_PROVIDERS.filter((p) => leadFirstHalf.includes(p));

  // 4) Are DACH mentions only side-notes ("in Deutschland bei X verfügbar")?
  //    If so, they don't count as the news subject.
  const dachIsOnlySideNote =
    dachProvidersInLead.length > 0 &&
    DACH_SIDE_NOTE_PATTERNS.some((re) => re.test(body));

  // Decision logic — BLOCK if:
  //   (a) headline has US-audience marker, AND
  //   (b) US-only provider appears anywhere in the article, AND
  //   (c) either no DACH provider in first half, OR all DACH mentions are
  //       just mandatory side-notes ("in Deutschland verfügbar")
  const leadIsUsCentric =
    headlineHasUsMarker &&
    usProvidersFound.length > 0 &&
    (dachInFirstHalf.length === 0 || dachIsOnlySideNote);

  const blocked = leadIsUsCentric;

  return {
    blocked,
    reason: blocked
      ? `US-only News: Headline ("${input.headline.slice(0, 60)}...") + US-Provider [${usProvidersFound.join(', ')}]${dachIsOnlySideNote ? ' (DACH nur Floskel)' : ' (kein DACH-Streamer im Lead)'}`
      : `OK (US-Marker: ${headlineHasUsMarker}, US-Provider: ${usProvidersFound.length}, DACH im Lead: ${dachInFirstHalf.length}, side-note: ${dachIsOnlySideNote})`,
    signals: {
      headlineHasUsMarker,
      usProvidersFound,
      dachProvidersInLead,
      dachIsOnlySideNote,
      leadIsUsCentric,
    },
  };
}
