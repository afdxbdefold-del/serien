/**
 * Non-DACH Streaming News Filter
 *
 * Analog zu `us-only-streaming-filter.ts`, aber für ALLE Nicht-DACH-Territorien
 * (UK, Frankreich, Italien, Spanien, Skandinavien, Benelux, Australien, Japan,
 * Kanada, LATAM). Fängt Artikel ab, deren Kern-News ein Streaming-/Sender-
 * Launch außerhalb Deutschlands/Österreichs/Schweiz ist.
 *
 * Beispiel-Fall der diesen Filter motiviert hat:
 *   "Warum Paris & Pups 2026 beim britischen Sender Sky Kids startet"
 *   (Sky Kids UK — nicht in DACH verfügbar, obwohl "Sky" existiert)
 *
 * Heuristik (bricht ab bei erstem Hit):
 *   1. Selbst-Geständnis-Marker (STRONG): Artikel sagt selbst, dass es kein
 *      Deutschland-Startdatum gibt.
 *   2. Nicht-DACH-Sender/Streamer im Headline oder Body-Lead.
 *   3. Nicht-DACH-Territorium in Headline explizit erwähnt ("britisch",
 *      "französisch", "US-Sender", etc.) UND kein DACH-Provider im Lead.
 */

// ────────────────────────────────────────────────────────────────────────────
// Streamer / lokale TV-Sender, die AUSSERHALB DACH operieren.
// Wichtig: Achtung bei Mehrdeutigkeiten — "Sky Kids" ist UK-only, aber "Sky"
// ist DACH-verfügbar. Deshalb IMMER die spezifischere Variante zuerst.
// ────────────────────────────────────────────────────────────────────────────
const NON_DACH_PROVIDERS = [
  // ── UK ──
  'sky kids', // Sky Kids UK — Kinderkanal-Zweig, nicht in DACH
  'sky uk',
  'bbc iplayer', 'bbc one', 'bbc two', 'bbc three',
  'itvx', 'itv x', 'itv hub',
  'channel 4', 'channel4', 'all 4', 'all4',
  'channel 5', 'my5',
  'stv player',
  'now tv uk', 'now uk',
  'britbox',
  'discovery+ uk',
  // ── Frankreich ──
  'canal+', 'canal plus france', 'mycanal',
  'salto',
  'france.tv', 'france tv',
  'arte.tv france',
  'ocs',
  // ── Italien ──
  'raiplay',
  'mediaset infinity', 'mediaset play',
  'now italia', 'sky italia',
  'tim vision', 'timvision',
  // ── Spanien ──
  'movistar+', 'movistar plus',
  'filmin',
  'atresplayer',
  'mitele',
  'rtve play',
  // ── Skandinavien ──
  'viaplay',
  'nrk tv', 'nrk play',
  'tv2 play', 'tv 2 play',
  'yle areena',
  'svt play',
  'dr tv',
  // ── Benelux ──
  'videoland',
  'streamz',
  'npo start', 'npo plus',
  'vrt max', 'vrt nu',
  // ── Australien / NZ ──
  'stan.com.au', 'stan australia',
  'binge', 'kayo',
  'foxtel now',
  'tvnz+',
  '10 play', 'tenplay',
  // ── Kanada ──
  'crave',
  'cbc gem',
  'ctv.ca',
  // ── Japan ──
  'hulu japan',
  'u-next', 'unext',
  'abema',
  'wowow',
  // ── Lateinamerika ──
  'globoplay',
  'vix+', 'vixplus',
  'blim tv',
];

// ────────────────────────────────────────────────────────────────────────────
// DACH-Streamer — falls einer davon als News-Subjekt (nicht Side-Note) im
// Lead auftaucht, ist der Artikel relevant.
// ────────────────────────────────────────────────────────────────────────────
const DACH_PROVIDERS = [
  'netflix',
  'amazon prime', 'prime video',
  'disney+', 'disney plus',
  'apple tv+', 'apple tv plus',
  'wow', 'wow tv',
  'sky deutschland', 'sky.de',
  'paramount+',
  'rtl+', 'rtl plus',
  'magenta tv', 'magentatv',
  'joyn',
  'mubi',
  'ard mediathek', 'zdf mediathek', 'ardmediathek', 'zdfmediathek',
  'ard', 'zdf',
  'crunchyroll',
  'dazn',
];

// ────────────────────────────────────────────────────────────────────────────
// Non-DACH Territorien-Marker in Headline (starkes Signal).
// ────────────────────────────────────────────────────────────────────────────
const NON_DACH_HEADLINE_MARKERS = [
  /\bbritischer\s+sender\b/i,
  /\bbritischen\s+sender\b/i,
  /\bbritische[srn]?\s+sender\b/i,
  /\bin\s+(gross|groß)britannien\b/i,
  /\bim\s+(vereinigten\s+königreich|uk)\b/i,
  /\bnur\s+im\s+uk\b/i,
  /\bfür\s+uk[\s-]?zuschauer\b/i,
  /\bbritische[snm]?\s+publikum\b/i,
  // FR
  /\bfranzösische[srn]?\s+sender\b/i,
  /\bin\s+frankreich\b/i,
  /\bfür\s+französische[snm]?\s+zuschauer\b/i,
  // IT
  /\bitalienische[srn]?\s+sender\b/i,
  /\bin\s+italien\b/i,
  // ES
  /\bspanische[srn]?\s+sender\b/i,
  /\bin\s+spanien\b/i,
  // Skandinavien
  /\bin\s+(schweden|norwegen|dänemark|finnland)\b/i,
  /\bnordische[snm]?\s+zuschauer\b/i,
  // Australien / Japan
  /\bin\s+australien\b/i,
  /\bin\s+japan\b/i,
  /\bin\s+kanada\b/i,
];

// ────────────────────────────────────────────────────────────────────────────
// Selbst-Verrat-Muster: Der Artikel sagt selbst, dass Deutschland (noch)
// nicht bedient wird. Klassisches Beispiel: "Ein Startdatum für Deutschland
// steht noch aus." — Wenn der Artikel selbst zugibt, dass Deutschland nicht
// dran ist, ist er per Definition irrelevant für DACH-Discover.
// ────────────────────────────────────────────────────────────────────────────
const NO_DACH_LAUNCH_PATTERNS = [
  /\bstartdatum\s+für\s+deutschland\s+(steht|ist)\s+(noch\s+)?(aus|offen|unklar)\b/i,
  /\bkein\s+(deutsches?\s+)?startdatum\b/i,
  /\b(noch\s+)?(kein|keine)\s+(offiziellen\s+)?(deutsche[snm]?\s+)?(start(termin)?|verfügbarkeit)\b/i,
  /\b(in\s+)?deutschland\s+(bisher|noch)\s+(nicht|kein)\s+(verfügbar|angekündigt|geplant)\b/i,
  /\bdeutsche[srn]?\s+(release|start|starttermin)\s+(steht\s+(noch\s+)?aus|unklar|offen)/i,
  /\bdach[\s-]?start(termin)?\s+(steht|ist)\s+(noch\s+)?(aus|offen|unklar)\b/i,
  /\bfür\s+dach\s+(bisher|noch)\s+(nicht|kein)\s+(bestätigt|angekündigt|verfügbar)\b/i,
];

// Floskeln – ein "in Deutschland bei Netflix" reicht NICHT als News-Anker.
const DACH_SIDE_NOTE_PATTERNS = [
  /\bin\s+deutschland\b[^.]{0,80}(verfugbar|verfuegbar|abrufbar|erhaltlich|erhältlich|zu\s+sehen|laufen|läuft|streamt|gestreamt)/i,
  /\bbereits\s+(in|bei|auf)\s+(deutschland|netflix|sky|wow|disney|amazon|prime|apple\s+tv)\b/i,
  /\b(österreich|austria|schweiz|switzerland|dach)\b[^.]{0,80}(verfugbar|verfuegbar|abrufbar)/i,
];

export interface NonDachCheckInput {
  headline: string;
  body: string;
  sourceTitle?: string;
  metaDescription?: string;
}

export interface NonDachCheckResult {
  blocked: boolean;
  reason: string;
  signals: {
    headlineHasNonDachMarker: boolean;
    nonDachProvidersFound: string[];
    dachProvidersInLead: string[];
    dachIsOnlySideNote: boolean;
    selfAdmissionNoDachLaunch: boolean;
  };
}

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function checkNonDachStreaming(input: NonDachCheckInput): NonDachCheckResult {
  const headlineRaw = input.headline || '';
  const headline = normalize(headlineRaw);
  const sourceTitle = normalize(input.sourceTitle || '');
  const body = stripHtml(input.body || '');
  const bodyNorm = normalize(body);
  const lead = bodyNorm.substring(0, 400);
  const leadFirstHalf = bodyNorm.substring(0, 200);
  const metaDesc = (input.metaDescription || '').toLowerCase();

  // ── 1) Self-Admission: Artikel gibt selbst zu, kein DACH-Start ──
  const selfAdmissionNoDachLaunch =
    NO_DACH_LAUNCH_PATTERNS.some((re) => re.test(body)) ||
    NO_DACH_LAUNCH_PATTERNS.some((re) => re.test(metaDesc));

  // ── 2) Non-DACH-Territoriumsmarker in Headline ODER Body-Lead ──
  //    (nicht nur Headline — manche Artikel packen "britischer Sender" erst
  //    in den Lead und die Headline nennt nur den Show-Namen.)
  const headlineHasNonDachMarker =
    NON_DACH_HEADLINE_MARKERS.some((re) => re.test(headlineRaw)) ||
    NON_DACH_HEADLINE_MARKERS.some((re) => re.test(sourceTitle)) ||
    NON_DACH_HEADLINE_MARKERS.some((re) => re.test(body.substring(0, 400)));

  // ── 3) Non-DACH Provider anywhere in headline OR body ──
  const nonDachProvidersFound = NON_DACH_PROVIDERS.filter(
    (p) => headline.includes(p) || bodyNorm.includes(p),
  );

  // ── 4) DACH-Provider im Lead ──
  const dachProvidersInLead = DACH_PROVIDERS.filter((p) => lead.includes(p));
  const dachInFirstHalf = DACH_PROVIDERS.filter((p) => leadFirstHalf.includes(p));

  const dachIsOnlySideNote =
    dachProvidersInLead.length > 0 &&
    DACH_SIDE_NOTE_PATTERNS.some((re) => re.test(body));

  // ── Blocking-Logik ──
  // A) Self-Admission ist der stärkste Marker → immer blocken.
  //    Wenn der Artikel selbst sagt "kein Deutschland-Start", ist er per
  //    Definition kein DACH-Discover-Kandidat.
  if (selfAdmissionNoDachLaunch) {
    return {
      blocked: true,
      reason: `Non-DACH News (Selbst-Geständnis): Artikel sagt selbst, dass kein Deutschland-Startdatum vorliegt.`,
      signals: {
        headlineHasNonDachMarker,
        nonDachProvidersFound,
        dachProvidersInLead,
        dachIsOnlySideNote,
        selfAdmissionNoDachLaunch,
      },
    };
  }

  // B) Klassischer Non-DACH-Fall: Territoriums-Marker + Non-DACH-Provider +
  //    kein DACH-Provider als News-Anker.
  const leadIsNonDachCentric =
    headlineHasNonDachMarker &&
    nonDachProvidersFound.length > 0 &&
    (dachInFirstHalf.length === 0 || dachIsOnlySideNote);

  const blocked = leadIsNonDachCentric;

  return {
    blocked,
    reason: blocked
      ? `Non-DACH News: Headline ("${headlineRaw.slice(0, 60)}...") + Non-DACH-Provider [${nonDachProvidersFound.join(', ')}]${dachIsOnlySideNote ? ' (DACH nur Floskel)' : ' (kein DACH-Streamer im Lead)'}`
      : `OK (non-dach-marker: ${headlineHasNonDachMarker}, non-dach-provider: ${nonDachProvidersFound.length}, DACH im Lead: ${dachInFirstHalf.length}, side-note: ${dachIsOnlySideNote}, self-admission: ${selfAdmissionNoDachLaunch})`,
    signals: {
      headlineHasNonDachMarker,
      nonDachProvidersFound,
      dachProvidersInLead,
      dachIsOnlySideNote,
      selfAdmissionNoDachLaunch,
    },
  };
}
