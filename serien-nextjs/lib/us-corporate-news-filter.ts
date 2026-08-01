/**
 * US-Corporate-/Business-News-Filter
 *
 * Fängt Artikel ab, deren Kern-News eine US-Unternehmens-/Börsen-Meldung
 * ist (Quartalszahlen, Aktienkurs, Wall-Street-Erwartungen, Milliarden-
 * Deal aus Konzern-Perspektive), selbst wenn ein DACH-Streamer wie Netflix
 * nur als Aufhänger im Titel oder Lead auftaucht.
 *
 * Beispiel-Fall der diesen Filter motiviert hat:
 *   "Netflix verlängert The Walking Dead für 460 Mio. trotz AMC-Quartalskrise"
 *   Meta: "AMC Global Media verfehlt die Wall-Street-Erwartungen im
 *   zweiten Quartal. Aktie fällt sechs Prozent…"
 *   → Kern-Story ist AMC-Bilanz, für DACH-TV-Publikum irrelevant.
 *
 * Der Filter greift NICHT bei normalen Content-News, in denen die
 * US-Firma nur als Produzent/Studio genannt wird (z.B. "AMC startet
 * neue Staffel von The Walking Dead: Daryl Dixon"). Voraussetzung für
 * ein Blocken ist:
 *   (a) US-Medien-/Studio-Konzern als Subjekt UND
 *   (b) mindestens ein Börsen-/Business-Signal im Titel/Lead.
 */

// ────────────────────────────────────────────────────────────────────────────
// US-Medienkonzerne, deren *Unternehmens*-Nachrichten für DACH-TV-Zuschauer
// irrelevant sind. Wichtig: das sind Konzern-/Sender-Namen, keine Show-
// Marken oder DACH-Streamer.
// ────────────────────────────────────────────────────────────────────────────
const US_CORP_SUBJECTS = [
  'amc networks', 'amc global media', 'amc entertainment',
  'warner bros. discovery', 'warner bros discovery', 'wbd',
  'paramount global', 'paramount pictures corp',
  'nbcuniversal', 'nbc universal', 'comcast',
  'fox corporation', 'fox corp',
  'cbs corporation',
  'the walt disney company', 'walt disney company',
  'lionsgate',
  'sony pictures entertainment',
  'a+e networks', 'a&e networks',
  'starz',
  'scripps networks',
  'discovery inc',
];

// ────────────────────────────────────────────────────────────────────────────
// Börsen-/Business-Signale. Wenn mindestens ein Treffer in Headline ODER
// im Lead (erste 400 Zeichen des Bodys) auftaucht, ist die Meldung sehr
// wahrscheinlich Corporate-Business und nicht Serien-News.
// ────────────────────────────────────────────────────────────────────────────
const BUSINESS_MARKERS: RegExp[] = [
  /\bwall[\s-]?street\b/i,
  /\bquartalszahlen\b/i,
  /\bquartalskrise\b/i,
  /\bquartalsbericht\b/i,
  /\bquartalsergebnis(?:se)?\b/i,
  /\bkonzernergebnis(?:se)?\b/i,
  /\bjahresbilanz\b/i,
  /\bbilanzskandal\b/i,
  /\baktie\s+(?:fällt|faellt|steigt|stürzt|einbricht|verliert|bricht\s+ein)\b/i,
  /\baktienkurs\b/i,
  /\bkursverlust(?:e)?\b/i,
  /\bkurssturz\b/i,
  /\bboersen(?:tief|kurs|reaktion)?\b/i,
  /\bbörsen(?:tief|kurs|reaktion)?\b/i,
  /\bumsatz(?:rückgang|einbruch|verluste)\b/i,
  /\bumsatzrückgang\b/i,
  /\bumsatzeinbruch\b/i,
  /\berwartungen\s+verfehlt\b/i,
  /\bprognose\s+verfehlt\b/i,
  /\bgewinnwarnung\b/i,
  /\bearnings(?:\s+call|\s+report|\s+miss)?\b/i,
  /\bearnings-?bericht\b/i,
  /\b(?:im|zweite|zweiten|erste|ersten|dritten|vierten)?\s*q[1-4]\s+(?:20\d{2}|202\d)\b/i,
  /\bq[1-4]-(?:bericht|zahlen|ergebnis|verluste)\b/i,
  /\banleger\b/i,
  /\binvestoren\s+(?:reagieren|enttäuscht|verunsichert)\b/i,
  /\bnasdaq\b/i,
  /\bnyse\b/i,
  /\bdividende\b/i,
  /\baktionäre\b/i,
  /\baktionaere\b/i,
  /\bceo\s+(?:tritt|entlassen|ersetzt|geht)\b/i,
  /\bmassenentlassung(?:en)?\b/i,
];

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface UsCorporateCheckInput {
  headline: string;
  /** Article body (HTML or Markdown). */
  body: string;
  /** Optional: meta description. */
  metaDescription?: string;
  /** Optional: original source title. */
  sourceTitle?: string;
}

export interface UsCorporateCheckResult {
  blocked: boolean;
  reason: string;
  signals: {
    corpSubjectsFound: string[];
    businessMarkersInHeadline: string[];
    businessMarkersInLead: string[];
    businessMarkersInMeta: string[];
  };
}

export function checkUsCorporateNews(
  input: UsCorporateCheckInput,
): UsCorporateCheckResult {
  const headlineRaw = input.headline || '';
  const headline = normalize(headlineRaw);
  const sourceTitle = normalize(input.sourceTitle || '');
  const body = stripHtml(input.body || '');
  const bodyNorm = normalize(body);
  const lead = bodyNorm.substring(0, 400);
  const meta = (input.metaDescription || '').toLowerCase();

  // 1) US-Konzern als Subjekt in Headline, Meta, Source-Titel oder Lead
  const corpSubjectsFound = US_CORP_SUBJECTS.filter(
    (c) =>
      headline.includes(c) ||
      sourceTitle.includes(c) ||
      lead.includes(c) ||
      meta.includes(c),
  );

  // 2) Business-Signale
  const businessMarkersInHeadline = BUSINESS_MARKERS.map((re) =>
    headlineRaw.match(re)?.[0] || null,
  ).filter((x): x is string => x !== null);

  const businessMarkersInLead = BUSINESS_MARKERS.map(
    (re) => body.substring(0, 400).match(re)?.[0] || null,
  ).filter((x): x is string => x !== null);

  const businessMarkersInMeta = BUSINESS_MARKERS.map(
    (re) => meta.match(re)?.[0] || null,
  ).filter((x): x is string => x !== null);

  const hasBusinessMarker =
    businessMarkersInHeadline.length > 0 ||
    businessMarkersInLead.length > 0 ||
    businessMarkersInMeta.length > 0;

  const blocked = corpSubjectsFound.length > 0 && hasBusinessMarker;

  return {
    blocked,
    reason: blocked
      ? `US-Corporate/Business-News: Konzern [${corpSubjectsFound.join(', ')}] + Business-Signal [${[...businessMarkersInHeadline, ...businessMarkersInLead, ...businessMarkersInMeta].slice(0, 3).join(' | ')}]`
      : `OK (US-Konzern: ${corpSubjectsFound.length}, Business-Signale: ${businessMarkersInHeadline.length + businessMarkersInLead.length + businessMarkersInMeta.length})`,
    signals: {
      corpSubjectsFound,
      businessMarkersInHeadline,
      businessMarkersInLead,
      businessMarkersInMeta,
    },
  };
}
