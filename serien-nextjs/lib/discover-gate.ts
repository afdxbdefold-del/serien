/**
 * EMERGENT_DISCOVER_GATE - 130 Punkte System
 *
 * A1) HEADLINE_HYGIENE:     30 Punkte (clear, series, news value, no dupes, no clickbait)
 * A2) HEADLINE_PERFORMANCE: 30 Punkte (curiosity, emotion, scroll-stop, natural, strong verb, CTR)
 * B)  FRESHNESS:            20 Punkte
 * C)  CONTENT_OPENING:      20 Punkte
 * D)  IMAGE/VISUAL:         15 Punkte
 * E)  TRUST/CLARITY:        15 Punkte
 *
 * PASS: ≥ 100 Punkte (~77%) → publishMode = "DISCOVER"
 *   (raised from 91 in v5.7: 7d-Median lag bei 111, das alte 91-Limit war zu
 *   lasch und ließ "Just-Miss"-Schwächen wie dünne Hooks, generische Hero-
 *   Images und unklare Quellangaben durchsickern.)
 *
 * Philosophy: Not just safe headlines — winning headlines.
 * Hygiene keeps us out of trouble; performance wins the feed card.
 */

import { getLLMFetchConfig } from './llm-config';

const { url: LLM_PROXY_URL, headers: LLM_HEADERS, model: LLM_MODEL } = getLLMFetchConfig();

interface DiscoverGateInput {
  final_headline: string;
  article_html: string;
  hero_image_metadata: {
    url: string;
    width: number;
    height: number;
    source: 'TMDB_BACKDROP' | 'TMDB_POSTER' | 'CUSTOM';
  };
  publishedAt: Date;
  primary_series: string;
  /**
   * Optional source-reputation penalty (Halluzinations-Greylist).
   * Pipeline-v2 looks up `hallucination_log` for the article's source host;
   * if the host produced ≥3 hallucinations in the last 7 days, it injects
   * a -10 penalty here, which is then subtracted from `trust_clarity`.
   * Caps at 15 (= the entire trust budget) so a single source can't drag
   * the total below the rest of the model.
   */
  source_reputation_penalty?: number;
}

interface DiscoverScoreBreakdown {
  headline_hygiene: number; // 0-30
  headline_performance: number; // 0-30
  headline_quality: number; // 0-60 (hygiene + performance, kept for backwards-compat)
  freshness: number; // 0-20
  content_opening: number; // 0-20
  image_visual: number; // 0-15
  trust_clarity: number; // 0-15
  total: number; // 0-130
}

interface DiscoverGateResult {
  discover_eligible: boolean;
  scores: DiscoverScoreBreakdown;
  fail_reasons: string[];
  dashboard: DiscoverDashboardMetrics;
}

interface DiscoverDashboardMetrics {
  headline: {
    clarity_specific: boolean;
    series_name_present: boolean;
    news_value_clear: boolean;
    news_value_kind: 'event' | 'development' | 'measurable' | null;
    has_duplicates: boolean;
    is_clickbait: boolean;
    score: number; // 0-30 (hygiene)
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  headline_performance: {
    has_curiosity: boolean;
    has_emotion: boolean;
    starts_strong: boolean;
    first_word: string;
    no_ai_phrase: boolean;
    has_strong_verb: boolean;
    length_sweet_spot: boolean;
    has_colon_title_pattern: boolean;
    has_number: boolean;
    feed_ctr_sub_score: number; // 0-5
    score: number; // 0-30
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  freshness: {
    published_at: string;
    is_today: boolean;
    age_hours: number;
    source_date_mismatch: boolean;
    score: number; // 0-20
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  content_opening: {
    paragraph_1_covers_what_who_where: boolean;
    paragraph_2_provides_context: boolean;
    is_paragraph_desert: boolean;
    has_hype_language: boolean;
    score: number; // 0-20
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  image_visual: {
    is_tmdb_backdrop: boolean;
    width_px: number;
    width_sufficient: boolean;
    clearly_series_related: boolean;
    score: number; // 0-15
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  trust_clarity: {
    facts_separated_from_opinion: boolean;
    no_ai_bloat: boolean;
    no_speculation: boolean;
    no_superlatives: boolean;
    score: number; // 0-15
    verdict: 'PASS' | 'FAIL';
    reasons: string[];
  };
  aggregation: {
    total_score: number; // 0-130
    final_verdict: 'DISCOVER' | 'SEARCH_ONLY';
    primary_blockers: string[];
    improvement_hints: string[];
  };
}

const CLICKBAIT_PATTERNS = [
  'Das musst du wissen',
  'Fans dürfen sich freuen',
  'Was wir wissen',
  'Endlich',
  'Mega',
  'Unglaublich',
];

const HYPE_PHRASES = [
  'Fans dürfen sich freuen',
  'endlich',
  'mega',
  'unglaublich',
  'spektakulär',
];

const GENERIC_HEADLINE_PATTERNS = [
  'bestätigt zweite Staffel der Serie',
  'bekommt neue Staffel',
  'kehrt zurück',
];

// ═══════════════════════════════════════════════════════════════════════
// HEADLINE PERFORMANCE SCORING — Not just safe, winning headlines
// ═══════════════════════════════════════════════════════════════════════

// Open-loop / curiosity triggers — creates a gap the reader wants to close
const CURIOSITY_PATTERNS: RegExp[] = [
  /\bwarum\b/i,
  /\bwieso\b/i,
  /\bwas.*bedeutet/i,
  /\bwas.*steckt/i,
  /\bwie.*schafft/i,
  /\bhinter.*steckt/i,
  /steckt dahinter/i,
  /\bgeheimnis\b/i,
  /\brätsel\b/i,
  /\btrick\b/i,
  /\bwendung\b/i,
  /\bplan\b/i,
  /bringt.*ans licht/i,
  /\bführt zu\b/i,
  /deshalb\b/i,
  /darum\b/i,
];

// Emotional anchors (concrete emotions, NOT hype-words like "mega")
// v5.3-Erweiterung: deckt natürliche Feature-Writing-Verben ab, die emotionale
// Resonanz signalisieren — "berührt", "nachwirkt", "bedroht", "zerbricht" usw.
// v5.4: idiomatische Phrasen + echte deutsche Gefühls-Alltagsworte ergänzt.
const EMOTIONAL_WORDS = [
  // Status / Wende
  'abschied', 'schock', 'drama', 'enttäuscht', 'enttäuschung', 'durchbruch',
  'überraschung', 'überrascht', 'rückkehr', 'comeback', 'trauer', 'trauert',
  'triumph', 'verlust', 'verrat', 'verraten', 'krise', 'skandal',
  'neustart', 'wende', 'bruch', 'mysterium', 'rätsel',
  'kampf', 'angst', 'hoffnung', 'liebe', 'hass', 'wut', 'streit',
  'eskalation', 'aus', 'ende', 'finale', 'neubeginn',
  // v5.3: Gefühle-in-Aktion
  'berührt', 'berühren', 'bewegt', 'bewegen', 'rührt', 'ergreift',
  'mitreißt', 'fesselt', 'fasziniert', 'packt', 'überwältigt',
  'nachwirkt', 'prägt', 'bleibt hängen', 'überdauert',
  'bedroht', 'gefährdet', 'riskiert', 'droht',
  'zerbricht', 'zerfällt', 'spaltet', 'entzweit',
  'scheitert', 'versagt', 'erschüttert', 'erschüttern',
  'quält', 'peinigt', 'verfolgt',
  'sehnsucht', 'verzweiflung', 'einsamkeit', 'leidenschaft',
  'todesangst', 'panik', 'wahnsinn', 'chaos', 'eiskalt',
  // v5.4: idiomatische + zusätzliche Gefühls-Alltagsworte
  'begeistert', 'begeistern', 'verblüfft', 'verblüffen',
  'entsetzt', 'entsetzen', 'empört', 'empören', 'enttäuscht',
  'verlor', 'verloren', 'gewann', 'gewinnt',
  'erwischt', 'ertappt', 'erwischen',
  'vermisst', 'vermissen',
  'herz', 'haut', 'nerv', 'seele', 'tränen', 'lächeln',
  'mut', 'stolz', 'demütigung', 'schmerz', 'schuld', 'rache',
  'sucht', 'zweifel', 'vertrauen', 'freundschaft', 'feindschaft',
];

/**
 * v5.4: Idiomatic phrase patterns — catch emotional register that
 * dictionary-lookup misses ("unter die Haut gehen", "ans Herz gehen").
 */
const EMOTIONAL_PHRASE_PATTERNS: RegExp[] = [
  /unter\s+die\s+haut/i,
  /(ans|zu)\s+herzen?/i,
  /aus\s+der\s+(fassung|bahn)/i,
  /in\s+den\s+bann/i,
  /an\s+den\s+nerv/i,
  /ins\s+herz(en)?/i,
  /ins\s+schwarze/i,
  /von\s+den\s+socken/i,
  /außer\s+sich/i,
  /bricht\s+das\s+herz/i,
  /tief\s+unter/i,
  /ein\s+letztes\s+mal/i,
  /für\s+immer/i,
];

// "Weak" first words — article/preposition starts kill scroll-stop power
const WEAK_FIRST_WORDS = new Set([
  'die', 'der', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'in', 'im', 'auf', 'nach', 'bei', 'mit', 'zu', 'zum', 'zur',
  'von', 'vor', 'vom', 'über', 'unter', 'für', 'aus',
  'und', 'aber', 'oder', 'denn',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben',
  'so', 'diese', 'dieser', 'dieses',
]);

// Strong action verbs that signal something happened.
// v5.3-Erweiterung: deckt auch Feature-Narrativ-Verben ab, die redaktionelle
// Qualität signalisieren ("berührt", "riskiert", "stiehlt", "entlockt").
// v5.4: Alltags-Aktionsverben (begeistert, vereint, wirkt, verlor) + Präteritum-Formen.
const STRONG_VERBS = [
  // Plot-Beats
  'beendet', 'kippt', 'streicht', 'verlässt', 'überrascht',
  'schockiert', 'bricht', 'stürmt', 'zerreißt', 'erobert',
  'kehrt zurück', 'kehrt', 'verschwindet', 'entlarvt',
  'setzt', 'kündigt', 'stoppt', 'enthüllt', 'bestätigt',
  'verliert', 'gewinnt', 'entdeckt', 'verrät', 'feuert',
  'rettet', 'triumphiert', 'scheitert',
  'dreht', 'kassiert', 'holt', 'verpasst',
  'warnt', 'droht', 'erhebt', 'zieht', 'wirft',
  // v5.3: Feature / Analyse-Verben
  'berührt', 'bewegt', 'rührt', 'ergreift', 'mitreißt', 'fesselt',
  'fasziniert', 'packt', 'überwältigt',
  'nachwirkt', 'prägt', 'überdauert',
  'bedroht', 'gefährdet', 'riskiert',
  'stiehlt', 'raubt', 'schnappt',
  'zerbricht', 'zerfällt', 'spaltet',
  'versetzt', 'tauscht', 'ersetzt', 'wechselt',
  'verändert', 'wandelt', 'transformiert',
  'entlockt', 'zwingt',
  // v5.4: Alltags-Aktionsverben
  'begeistert', 'verblüfft', 'entsetzt', 'empört',
  'vereint', 'spaltet', 'trennt', 'bindet',
  'verlor', 'gewann', 'rettete', 'scheiterte',
  'verwandelt', 'formt', 'schleudert',
  'platzt',
  'trifft', 'erwischt', 'ertappt', 'vermisst',
  'lenkt', 'treibt', 'hetzt', 'peitscht',
  'lockt', 'reißt', 'zerrt', 'drängt',
  'überholt', 'überschlägt', 'übertrifft',
  'begegnet', 'konfrontiert', 'fordert',
  'wendet', 'kippt um', 'stiehlt die schau',
];

// AI-smell patterns (feel robotic, over-formal, template-like)
const AI_GENERIC_PATTERNS: RegExp[] = [
  /offiziell (bestätigt|angekündigt|verkündet)/i,
  /verständlich (erklärt|zusammengefasst)/i,
  /mit.*wichtigen.*details/i,
  /alles.*was.*(wir|ihr|du).*wissen/i,
  /alle.*infos.*im.*überblick/i,
  /im.*überblick\b/i,
  /das.*große\s(ende|finale)/i,
  /im folgenden/i,
  /zusammengefasst/i,
];

/**

/**
 * v5.6: Klassifiziert eine Headline nach drei strikten News-Wert-Kategorien.
 * Pflicht für jede publizierte Headline — sonst Reject im Pipeline-Layer.
 *
 *   - 'event'        — klares Ereignis (Plot-Beat, Cast-Wechsel, Premiere, Tod, Rückkehr …)
 *   - 'development'  — bestätigte Entwicklung (verlängert, abgesetzt, offiziell, fix …)
 *   - 'measurable'   — messbare Veränderung (Quoten-Zahl, Platzierung, Staffel-N, +/-%)
 *
 * Reine Hook-Phrasen ("Warum X überrascht", "Darum kehrt Y zurück") zählen NICHT
 * als News-Wert — der News-Wert muss IM Satz stecken, nicht im Hook-Wort.
 */
const NEWS_EVENT_VERBS = [
  // Karriere / Premiere
  'startet', 'endet', 'beginnt', 'läuft an', 'kommt zu', 'erscheint',
  'debütiert', 'feiert premiere', 'premiert', 'startet dreh',
  // Plot / Charaktere
  'kehrt zurück', 'kehrt heim', 'verlässt', 'tritt ab', 'übernimmt',
  'überlebt', 'verliert', 'gewinnt', 'rettet', 'tötet',
  'verschwindet', 'enttarnt', 'entlarvt', 'erwischt',
  // Casting & Personnel
  'castet', 'verpflichtet', 'engagiert', 'feuert', 'entlässt',
  'ersetzt', 'tritt bei', 'steigt ein', 'steigt aus', 'wirft hin',
  // Produktion
  'dreht', 'verfilmt', 'adaptiert', 'remake', 'produziert', 'plant',
  'kündigt fortsetzung', 'kündigt prequel', 'kündigt spin-off',
  // Plot-Wendungen (echtes Ereignis im Sinn von "ist passiert")
  'enthüllt', 'offenbart', 'bricht', 'überrascht', 'schockt',
];
const NEWS_DEVELOPMENT_MARKERS = [
  // Statusbestätigung
  'bestätigt', 'verkündet', 'kündigt an', 'gibt bekannt', 'meldet',
  'dementiert', 'widerspricht', 'stellt klar',
  // Renewal / Cancellation
  'verlängert', 'verlängerung', 'abgesetzt', 'gecancelt', 'cancelled',
  'eingestellt', 'gestrichen', 'gestoppt', 'beendet',
  'pickt auf', 'orders', 'bestellt',
  // Deals
  'unterschrieben', 'einigt sich', 'einigung', 'beschlossen',
  'genehmigt', 'übernommen',
  // Status-Adjektive
  'offiziell', 'fix', 'definitiv', 'final', 'feststehend',
];
const NEWS_MEASURABLE_PATTERNS: RegExp[] = [
  /\b(staffel|season)\s*\d+/i,
  /\b(episode|folge)\s*\d+/i,
  /\bkapitel\s*\d+/i,
  /\bteil\s*\d+/i,
  /\bjahr\s*\d{4}/i,
  /\b\d{4}er\b/i,                                     // 2020er, 90er
  /\b\d+\s*(jahre?|monate?|wochen?|tage?)\b/i,
  /\bplatz\s*\d+|\bnummer\s*(eins|1|zwei|2)\b|\btop[\s-]*\d+/i,
  /\b\d+[.,]?\d*\s*(mio|millionen?|mrd|milliarden?)\b/i,
  /\b\d+\s*[%‰]/,
  /\b[+\-−–]\s*\d+\s*[%]?/,
  /\b\d+\s*x\b/i,                                     // 5x nominiert
  /\b(rang|ranking|charts?)\b/i,
  /\b\d+\s+millionen\b/i,
];
function detectNewsValueCategory(headline: string): {
  kind: 'event' | 'development' | 'measurable' | null;
  hit?: string;
} {
  const lower = headline.toLowerCase();
  // Order matters: development first because "bestätigt", "verlängert" etc.
  // are stronger signals than the more generic event verbs.
  const dev = NEWS_DEVELOPMENT_MARKERS.find((w) => lower.includes(w));
  if (dev) return { kind: 'development', hit: dev };
  const evt = NEWS_EVENT_VERBS.find((w) => lower.includes(w));
  if (evt) return { kind: 'event', hit: evt };
  const mes = NEWS_MEASURABLE_PATTERNS.find((p) => p.test(headline));
  if (mes) return { kind: 'measurable', hit: mes.source };
  return { kind: null };
}

/** Public helper used by the pipeline reject-gate. */
export function hasNewsValue(headline: string): boolean {
  // Hard-blacklist user-banned emotional metaphors first — these always win,
  // even if the headline also contains a legitimate news-value signal.
  if (containsBannedMetaphor(headline)) return false;
  return detectNewsValueCategory(headline).kind !== null;
}

/**
 * v5.6 / Editor-Regel: Emotionale Metaphern, die im Entertainment-Journalismus
 * fast immer als Übertreibung benutzt werden, nicht als Fakt. User-Blacklist:
 *   - stirbt, explodiert, bricht ein, zerstört, eskaliert
 * Headlines mit diesen Wörtern werden hart verworfen, auch wenn andere
 * News-Wert-Signale vorhanden sind.
 */
const BANNED_METAPHOR_PATTERNS: RegExp[] = [
  /(?<![a-zäöüß])stirbt(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(explodiert|explodieren)(?![a-zäöüß])/i,
  /(?<![a-zäöüß])bricht\s+ein(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(zerstört|zerstoeren|zerstoert)(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(eskaliert|eskalieren)(?![a-zäöüß])/i,
];

/** Public helper — exported for tests + pipeline reject-gate. */
export function containsBannedMetaphor(headline: string): boolean {
  return BANNED_METAPHOR_PATTERNS.some((p) => p.test(headline));
}

/**
 * German grammar incompleteness detector.
 * Used by both the headline rewriter (via discoverGate) and the V5 scorer to
 * penalize headlines that are grammatically broken — typically reflexive verbs
 * without object, transitive verbs at the end of a clause without object, or
 * "warum/wie"-subclauses that never resolve their question.
 */

/**
 * v5.4: Detect opinion-tone markers — first-person pronouns, reader directives,
 * editorialising openers, verdict phrases. Each hit returns a penalty so the
 * Rewrite-Loop is triggered even if Hygiene + hook checks pass.
 *
 * Allowed: third-person emotion ("Hacks erschüttert Zuschauer"), curiosity hooks
 * ("Warum X scheitert"). Blocked: "Ich finde …", "Endlich …", "Pflichtprogramm".
 */
const OPINION_PATTERNS: Array<{ regex: RegExp; label: string; penalty: number }> = [
  // First-person pronouns — dead giveaway of personal column tone.
  { regex: /(?<![a-zäöüß])(ich|mir|mich|mein(e|er|en|em|es)?|unser(e|er|en|em|es)?)(?![a-zäöüß])/i, label: 'Erste-Person-Pronomen', penalty: -12 },
  { regex: /\b(meiner|meine)\s+meinung\b/i, label: 'Meiner Meinung nach', penalty: -15 },
  { regex: /\baus\s+meiner\s+sicht\b/i, label: 'Aus meiner Sicht', penalty: -15 },
  { regex: /\bich\s+(finde|liebe|hasse|denke|glaube)\b/i, label: 'Ich-Stance', penalty: -15 },
  { regex: /(verzaubert|überzeugt|ueberzeugt|beeindruckt)\s+mich\b/i, label: 'Personal-Eindruck', penalty: -12 },
  // Editorialising opener.
  { regex: /^endlich\b/i, label: 'Editorialisierender Auftakt (Endlich …)', penalty: -12 },
  { regex: /^zum\s+glück\b/i, label: 'Editorialisierender Auftakt (Zum Glück)', penalty: -12 },
  { regex: /^leider\b/i, label: 'Editorialisierender Auftakt (Leider)', penalty: -10 },
  { regex: /^glücklicherweise\b/i, label: 'Editorialisierender Auftakt (Glücklicherweise)', penalty: -12 },
  { regex: /^ein\s+hoch\s+auf\b/i, label: 'Beifalls-Phrase (Ein Hoch auf …)', penalty: -15 },
  { regex: /^bravo\b/i, label: 'Beifalls-Phrase (Bravo)', penalty: -15 },
  { regex: /\bbitte\s+mehr\s+(davon|hiervon|von)\b/i, label: 'Appell-Phrase (Bitte mehr)', penalty: -12 },
  // Reader directives / imperatives.
  { regex: /\b(solltest|solltet|müsst|muesst)\b[^.]*?\b(sehen|schauen|gucken|streamen|verpassen)\b/i, label: 'Leser-Imperativ', penalty: -12 },
  { regex: /\bmuss\s+man\s+(gesehen|geschaut)\s+haben\b/i, label: 'Verdikt (muss man gesehen haben)', penalty: -15 },
  { regex: /\bunbedingt\s+(sehen|schauen|streamen|gucken)\b/i, label: 'Imperativ (unbedingt …)', penalty: -12 },
  // Verdict phrases.
  { regex: /\bgehört\s+zu\s+den\s+(besten|größten|grandiosesten|genialsten)\b/i, label: 'Verdikt (gehört zu den besten)', penalty: -15 },
  { regex: /\bein\s+muss\s+f(ü|u|ue)r\b/i, label: 'Verdikt (ein Muss für …)', penalty: -12 },
  { regex: /\bpflicht(programm|serie|film)\b/i, label: 'Verdikt (Pflichtprogramm)', penalty: -12 },
  { regex: /\bperfekteste\b/i, label: 'Superlativ-Verdikt (perfekteste)', penalty: -15 },
  { regex: /\bbeste\s+(serie|comedy|sitcom|drama)\s+aller\s+zeiten\b/i, label: 'Superlativ-Verdikt (beste … aller Zeiten)', penalty: -15 },
];
function detectOpinionTone(headline: string): Array<{ label: string; penalty: number }> {
  // Phase-A Stop-Loss: Standard AUS bis GSC-Daten zeigen, dass es CTR hilft.
  if (process.env.HEADLINE_OPINION_KILLER !== 'true') return [];
  const hits: Array<{ label: string; penalty: number }> = [];
  for (const { regex, label, penalty } of OPINION_PATTERNS) {
    if (regex.test(headline)) hits.push({ label, penalty });
  }
  return hits;
}


function detectGrammarFailures(headline: string): Array<{ label: string; penalty: number }> {
  const out: Array<{ label: string; penalty: number }> = [];
  const trimmed = headline.trim();

  // A) Reflexive verb followed by clause break — verb missing its object/predicate.
  //    "Chad Powers sichert sich, warum…"  → broken
  if (/\b(sichert|lässt|stellt|fragt|fühlt|gibt|wendet|nimmt|fügt|hält|setzt|zeigt|holt|spielt|treibt|schiebt|bringt)\s+sich\s*[,–—]/i.test(trimmed)) {
    out.push({ label: 'reflexives Verb ohne Objekt', penalty: -25 });
  }

  // B) Transitive verb at sentence end without object marker in last clause.
  //    "warum X verändert" / "wie das alles bricht" — verb wants an object.
  if (/\b(verändert|verlässt|bricht|kippt|zerstört|verliert|beendet|rettet|zwingt|verrät|ändert|stoppt|verbietet|ergreift|schickt|öffnet|schliesst|schließt)\.?\s*$/i.test(trimmed)) {
    const lastClause = trimmed.split(/[,–—]/).pop() || '';
    const hasObjectMarker = /\b(den|die|das|dem|einen|eine|einem|seinen|seiner|ihre|ihren|alle|alles|nichts|sich)\b/i.test(lastClause);
    if (!hasObjectMarker) {
      out.push({ label: 'transitives Verb ohne Objekt am Satzende', penalty: -25 });
    }
  }

  // C) Orphan "warum/wie/weshalb"-subclause that doesn't resolve.
  //    "Chad Powers sichert sich, warum das Waldrons Comeback verändert"
  if (/[,–—]\s*(warum|wie|weshalb|weil)\s+(das|der|die)\s+\w+\s+\w+\s*$/i.test(trimmed)) {
    out.push({ label: 'unaufgelöster warum/wie-Nebensatz', penalty: -20 });
  }

  return out;
}

/**
 * v5.4: Fallback-heuristic — detects ANY finite German action verb in the
 * headline, as long as it isn't in a short list of weak/filler verbs.
 * This flips the "strong verb" check from whitelist (always-incomplete) to
 * blacklist (much higher recall).
 */
const HEURISTIC_WEAK_VERBS = new Set([
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'worden',
  'hat', 'haben', 'hatte', 'hatten',
  'kann', 'können', 'konnte', 'konnten',
  'muss', 'müssen', 'musste',
  'will', 'wollen', 'wollte',
  'soll', 'sollen', 'sollte',
  'darf', 'dürfen',
  'gibt', 'geben', 'gab',
  'macht', 'machen', 'machte',
  'tut', 'tun', 'tat',
  'sagt', 'sagen', 'sagte',
  'meint', 'meinen', 'gemeint',
  'scheint', 'scheinen',
  'heißt', 'heißen',
  'bleibt', 'bleiben', 'blieb',
  'geht', 'gehen', 'ging', 'gegangen',
  'steht', 'stehen', 'stand',
  'kommt', 'kommen', 'kam',
]);
function detectStrongVerbHeuristic(lower: string): boolean {
  // 3rd-person-singular or past-tense German verb endings.
  // Matches only if the token is not a weak/filler verb and is ≥4 chars.
  const tokens = lower.split(/[^a-zäöüß]+/).filter((t) => t.length >= 4);
  for (const t of tokens) {
    if (HEURISTIC_WEAK_VERBS.has(t)) continue;
    // Common finite-verb endings (present / preterite / participle).
    if (/(iert|isiert|elt|ert|nt|gt|cht|sst|kt|pt|ft|rt|zt|ht|te|ten|tet)$/.test(t)) {
      // Exclude the obvious non-verb adjective/noun forms that share endings.
      if (/^(bunt|kalt|glatt|satt|hart|sanft|zart|roh|toll|stolz|nett|hell|fest|stark|wert|grell|schnell|nackt|stumm|fremd|laut|treu|steif)$/.test(t)) continue;
      return true;
    }
  }
  return false;
}



function scoreHeadlinePerformance(headline: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  const safe = (headline || '').trim();
  const lower = safe.toLowerCase();
  const words = safe.split(/\s+/);
  const firstWord = words[0]?.replace(/[^\wäöüß]/gi, '').toLowerCase() || '';

  // 1. CURIOSITY / OPEN LOOP
  // Phase-A Fix: Bonus von +5 auf +2 halbiert. Begründung: +5 Curiosity plus
  // +2 Strong-Start-Halbbonus für "Warum/Darum" summierten sich zu +7/30 und
  // machten Hook-Eröffnungen dominant — 100% der letzten 25 Headlines starteten
  // mit Warum/Darum. Curiosity bleibt wertvoll, aber als Differenzierer, nicht
  // als Hauptgewicht.
  const has_curiosity = CURIOSITY_PATTERNS.some((p) => p.test(safe));
  if (has_curiosity) {
    score += 2;
  } else {
    reasons.push('Kein Open-Loop / Neugier-Trigger');
  }

  // 2. EMOTIONAL PULL (5)
  // v5.4: dictionary OR idiomatic phrase (unter die Haut, ans Herz, …).
  const has_emotion_word = EMOTIONAL_WORDS.some((w) => lower.includes(w));
  const has_emotion_phrase = EMOTIONAL_PHRASE_PATTERNS.some((p) => p.test(safe));
  const has_emotion = has_emotion_word || has_emotion_phrase;
  if (has_emotion) {
    score += 5;
  } else {
    reasons.push('Keine emotionale Verankerung');
  }

  // 3. SCROLL-STOP POWER — first word matters on feed cards.
  // Phase-A Fix (Feb 2026): Hook-Wörter (Warum/Darum/…) kriegen 0 Punkte statt
  // +2. Eigennamen- & Zahlen-Eröffnungen werden auf +6 angehoben. Grund: die
  // alten +2 Hook-Halbpunkte belohnten die vom Rewrite-Loop erzeugte Warum/
  // Darum-Monokultur. Konkret benannte Protagonisten klicken im Discover-Feed
  // messbar besser als generische Hooks.
  const HOOK_WORDS = new Set(['warum', 'darum', 'wieso', 'weshalb', 'deshalb', 'daher']);
  const starts_with_number = /^\d/.test(safe);
  const starts_with_name = /^[A-ZÄÖÜ][a-zäöüß]+/.test(safe) && !WEAK_FIRST_WORDS.has(firstWord);
  const starts_with_hook = HOOK_WORDS.has(firstWord);
  const starts_strong = starts_with_number || (starts_with_name && !starts_with_hook);
  if (starts_with_number || (starts_with_name && !starts_with_hook)) {
    score += 6;
  } else if (starts_with_hook) {
    score += 0; // Hook-Start bekommt keinen Strong-Start-Bonus mehr
    reasons.push('Eröffnung mit "Warum/Darum" — stärker: Eigenname, Zahl oder Faktenverb');
  } else {
    reasons.push(`Schwacher Einstieg: "${firstWord}" — lieber mit Name, Zahl oder Verb starten`);
  }

  // 4. NATURAL HUMAN WORDING (5) — penalize AI-template phrases
  const ai_phrase_hit = AI_GENERIC_PATTERNS.find((p) => p.test(safe));
  const no_ai_phrase = !ai_phrase_hit;
  if (no_ai_phrase) {
    score += 5;
  } else {
    reasons.push('KI-Template-Phrase erkannt');
  }

  // 5. STRONG VERBS / CONCRETE WORDING (5)
  // v5.4: dictionary OR heuristic fallback — any non-weak finite verb counts.
  // Detects inflected German verbs by pattern (-t/-et/-iert/-elt/-ert ending,
  // not in WEAK_VERBS, not ending in common noun suffixes).
  const has_strong_verb_dict = STRONG_VERBS.some((v) => lower.includes(v));
  const has_strong_verb_heuristic = detectStrongVerbHeuristic(lower);
  const has_strong_verb = has_strong_verb_dict || has_strong_verb_heuristic;
  if (has_strong_verb) {
    score += 5;
  } else {
    reasons.push('Kein starkes Handlungs-Verb');
  }

  // 6. FEED CTR POTENTIAL (5) — sweet-spot length + no colon-title + concreteness
  // v5.3: Google Discover Mobile-Cards zeigen 2-3 Zeilen ≈ 80–90 Zeichen ohne
  // Truncation; harter Cutoff erst bei ~110. Deshalb belohnen wir 45–90 Zeichen
  // statt 40–70 und vergeben Penalty erst ab > 100.
  let ctr_score = 0;
  const len = safe.length;
  const length_sweet_spot = len >= 45 && len <= 90;
  if (length_sweet_spot) {
    ctr_score += 2;
  } else if (len < 45) {
    reasons.push(`Zu kurz für Feed-Card (${len} Zeichen, ideal 45–90)`);
  } else if (len > 100) {
    reasons.push(`Zu lang für Feed-Card (${len} Zeichen, ideal 45–90)`);
  } else {
    // 91–100 → ok aber kein Bonus
    ctr_score += 1;
  }

  // Colon-title pattern like "Wednesday: Staffel 3 kommt" reads as label + detail
  // and performs worse than a declarative sentence in Discover cards.
  const has_colon_title_pattern = /^[^:]{3,30}:\s/i.test(safe);
  if (!has_colon_title_pattern) {
    ctr_score += 2;
  } else {
    reasons.push('Colon-Title-Muster drückt CTR (lieber Aussagesatz)');
  }

  // A number (season, episode, year, count) adds concreteness
  const has_number = /\d/.test(safe);
  if (has_number) ctr_score += 1;

  score += ctr_score;

  // 7. GERMAN GRAMMAR INTEGRITY (penalty up to -25) — fatal because broken sentences
  // confuse readers and damage trust on the SERP. The rewriter previously chose grammatically
  // incomplete candidates because surface CTR patterns (Brand + "warum" hook + Possessiv)
  // were rewarded without checking that the sentence is actually finished.
  const grammarPenalties = detectGrammarFailures(safe);
  if (grammarPenalties.length > 0) {
    const totalPenalty = grammarPenalties.reduce((sum, p) => sum + p.penalty, 0);
    score += totalPenalty; // negative
    grammarPenalties.forEach((p) => reasons.push(`Grammatik: ${p.label}`));
  }

  // 8. OPINION-TONE PENALTY (v5.4) — wir sind eine News-Site.
  // Headlines dürfen emotional und neugier-treibend sein, aber NIE nach
  // Autoren-Meinung klingen. Harter -15-Cut, damit der Rewrite-Loop greift.
  const opinionPenalties = detectOpinionTone(safe);
  if (opinionPenalties.length > 0) {
    const totalOpinion = opinionPenalties.reduce((sum, p) => sum + p.penalty, 0);
    score += totalOpinion;
    opinionPenalties.forEach((p) => reasons.push(`Meinungs-Sound: ${p.label}`));
  }

  const verdict: 'PASS' | 'FAIL' = score >= 18 ? 'PASS' : 'FAIL';
  if (verdict === 'FAIL') {
    fail_reasons.push(`Headline-Performance unter Schwelle (${score}/30)`);
  }

  return {
    has_curiosity,
    has_emotion,
    starts_strong,
    first_word: firstWord,
    no_ai_phrase,
    has_strong_verb,
    length_sweet_spot,
    has_colon_title_pattern,
    has_number,
    feed_ctr_sub_score: ctr_score,
    score: Math.max(0, Math.min(30, score)),
    verdict,
    reasons,
  };
}

export async function discoverGate(input: DiscoverGateInput): Promise<DiscoverGateResult> {
  const fail_reasons: string[] = [];
  
  const plainText = (input.article_html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const paragraphs = (input.article_html || '').match(/<p>(.*?)<\/p>/g) || [];
  const paragraphTexts = paragraphs.map(p => p.replace(/<\/?p>/g, '').trim());

  // === A1) HEADLINE HYGIENE (30 Punkte) ===
  const headlineMetrics = scoreHeadline(input.final_headline, input.primary_series, fail_reasons);

  // === A2) HEADLINE PERFORMANCE (30 Punkte) ===
  const headlinePerformanceMetrics = scoreHeadlinePerformance(input.final_headline, fail_reasons);

  // === B) FRESHNESS (20 Punkte) ===
  const freshnessMetrics = scoreFreshness(input.publishedAt, fail_reasons);
  
  // === C) CONTENT OPENING (20 Punkte) ===
  const contentMetrics = scoreContentOpening(paragraphTexts, fail_reasons);
  
  // === D) IMAGE/VISUAL (15 Punkte) ===
  const imageMetrics = scoreImage(input.hero_image_metadata, fail_reasons);
  
  // === E) TRUST/CLARITY (15 Punkte) ===
  const trustMetrics = scoreTrust(plainText, fail_reasons);

  // === E2) SOURCE-REPUTATION PENALTY (Halluzinations-Greylist) ===
  // Sources that hallucinated ≥3 times in the last 7 days get a -10 penalty
  // on trust_clarity. The penalty is forwarded from the pipeline (which has
  // DB access). Cap at trustMetrics.score to avoid negative values.
  const reputationPenalty = Math.min(input.source_reputation_penalty ?? 0, trustMetrics.score);
  if (reputationPenalty > 0) {
    trustMetrics.score = Math.max(0, trustMetrics.score - reputationPenalty);
    if (Array.isArray(trustMetrics.reasons)) {
      trustMetrics.reasons.push(`source-greylist −${reputationPenalty} (≥3 Halluzinationen in 7T)`);
    }
    fail_reasons.push(`Source-Greylist Penalty: −${reputationPenalty} Punkte`);
  }

  // === TOTAL SCORE (out of 130) ===
  const total_score =
    headlineMetrics.score +
    headlinePerformanceMetrics.score +
    freshnessMetrics.score +
    contentMetrics.score +
    imageMetrics.score +
    trustMetrics.score;

  // v5.7: PASS-Threshold von 91 → 100 angehoben. Begründung: Median lag bei
  // 111/130 — nur "Just-Miss"-Artikel (Score 91-99) fielen weg, und die hatten
  // meist dünne Hooks oder unklare Trust-Signale. Top-Klasse (100+) bleibt drin.
  const discover_eligible = total_score >= 100;

  const dashboard: DiscoverDashboardMetrics = {
    headline: headlineMetrics,
    headline_performance: headlinePerformanceMetrics,
    freshness: freshnessMetrics,
    content_opening: contentMetrics,
    image_visual: imageMetrics,
    trust_clarity: trustMetrics,
    aggregation: {
      total_score,
      final_verdict: discover_eligible ? 'DISCOVER' : 'SEARCH_ONLY',
      primary_blockers: identifyBlockers(headlineMetrics, headlinePerformanceMetrics, freshnessMetrics, contentMetrics, imageMetrics, trustMetrics),
      improvement_hints: generateHints(headlineMetrics, headlinePerformanceMetrics, freshnessMetrics, contentMetrics, imageMetrics, trustMetrics),
    },
  };

  return {
    discover_eligible,
    scores: {
      headline_hygiene: headlineMetrics.score,
      headline_performance: headlinePerformanceMetrics.score,
      headline_quality: headlineMetrics.score + headlinePerformanceMetrics.score,
      freshness: freshnessMetrics.score,
      content_opening: contentMetrics.score,
      image_visual: imageMetrics.score,
      trust_clarity: trustMetrics.score,
      total: total_score,
    },
    fail_reasons,
    dashboard,
  };
}

function scoreHeadline(headline: string, seriesName: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  
  // Safety check
  const safeHeadline = headline || '';
  const safeSeriesName = seriesName || '';
  
  // 1. Klar + spezifisch (10 Punkte)
  const isGeneric = GENERIC_HEADLINE_PATTERNS.some(pattern => 
    safeHeadline.toLowerCase().includes(pattern.toLowerCase())
  );
  
  // v5.3: gleiche Logik wie Performance-Length: Discover-Mobile zeigt 2-3 Zeilen
  // → ideal 25–95 Zeichen, hart > 100.
  const clarity_specific = !isGeneric && safeHeadline.length <= 100 && safeHeadline.length >= 25;
  if (clarity_specific) {
    score += 10;
  } else {
    reasons.push('Headline nicht klar oder zu generisch');
  }
  
  // 2. Serienname explizit genannt (10 Punkte)
  const series_name_present = safeHeadline.toLowerCase().includes(safeSeriesName.toLowerCase());
  if (series_name_present) {
    score += 10;
  } else {
    reasons.push('Serienname fehlt in Headline');
    fail_reasons.push('Serienname nicht in Headline');
  }
  
  // 3. News-Wert erkennbar (10 Punkte) — v5.6 STRIKT.
  // Pflicht: Headline MUSS mind. eines enthalten:
  //   (a) klares Ereignis  (Event-Verb)
  //   (b) bestätigte Entwicklung  (Development-Verb)
  //   (c) messbare Veränderung  (Zahl, Platz, Quote, Prozent)
  // "Warum / Darum / Was / Wie" sind KEIN News-Wert — sie sind nur Hooks.
  const newsValue = detectNewsValueCategory(safeHeadline);
  if (newsValue.kind) {
    score += 10;
  } else {
    reasons.push('Kein klares Ereignis, keine bestätigte Entwicklung, keine messbare Veränderung');
    fail_reasons.push('Headline ohne News-Wert (Ereignis/Entwicklung/Messbares fehlt)');
  }
  
  // FAIL Checks
  const words = safeHeadline.toLowerCase().split(/\s+/);
  const duplicates = words.filter((word, index) => words.indexOf(word) !== index);
  const has_duplicates = duplicates.length > 0;
  
  if (has_duplicates) {
    reasons.push(`Doppelte Wörter: ${duplicates.join(', ')}`);
    fail_reasons.push('Doppelte Wörter in Headline');
    verdict = 'FAIL';
    score = Math.max(0, score - 10);
  }
  
  const is_clickbait = CLICKBAIT_PATTERNS.some(pattern => 
    safeHeadline.toLowerCase().includes(pattern.toLowerCase())
  );
  
  if (is_clickbait) {
    reasons.push('Clickbait ohne Fakt');
    fail_reasons.push('Clickbait-Pattern in Headline');
    verdict = 'FAIL';
    score = 0;
  }
  
  return {
    clarity_specific,
    series_name_present,
    news_value_clear: !!newsValue.kind,
    news_value_kind: newsValue.kind,
    has_duplicates,
    is_clickbait,
    score: Math.max(0, Math.min(30, score)),
    verdict,
    reasons,
  };
}

function scoreFreshness(publishedAt: Date, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  
  const now = new Date();
  const age_hours = (now.getTime() - publishedAt.getTime()) / (60 * 60 * 1000);
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const publishedDay = new Date(publishedAt.getFullYear(), publishedAt.getMonth(), publishedAt.getDate());
  const is_today = todayStart.getTime() === publishedDay.getTime();
  
  if (is_today) {
    score = 20;
  } else if (age_hours <= 24) {
    score = 10;
    reasons.push('Artikel von gestern (10/20 Punkte)');
  } else {
    score = 0;
    reasons.push(`Artikel zu alt: ${Math.round(age_hours)}h`);
    fail_reasons.push('Artikel nicht aktuell genug für Discover');
    verdict = 'FAIL';
  }
  
  // HARTES FAIL: sourcePublishedAt ≠ publishedAt
  // (Dieser Check müsste in der Pipeline erfolgen, hier nehmen wir an, dass publishedAt = NOW)
  const source_date_mismatch = false; // Placeholder
  
  return {
    published_at: publishedAt.toISOString(),
    is_today,
    age_hours: Math.round(age_hours * 10) / 10,
    source_date_mismatch,
    score,
    verdict,
    reasons,
  };
}

function scoreContentOpening(paragraphs: string[], fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  
  if (!paragraphs || paragraphs.length < 2 || !paragraphs[0] || !paragraphs[1]) {
    reasons.push('Zu wenige Absätze für Bewertung');
    fail_reasons.push('Content Opening unvollständig');
    return {
      paragraph_1_covers_what_who_where: false,
      paragraph_2_provides_context: false,
      is_paragraph_desert: true,
      has_hype_language: false,
      score: 0,
      verdict: 'FAIL' as const,
      reasons,
    };
  }
  
  const para1 = paragraphs[0].toLowerCase();
  const para2 = paragraphs[1].toLowerCase();
  
  // Absatz 1: WAS + WER + WO
  const hasWhat = para1.includes('staffel') || para1.includes('serie') || para1.includes('bestätigt') || para1.includes('angekündigt');
  const hasWho = para1.length > 50; // Simple heuristic: longer = more info
  const paragraph_1_covers_what_who_where = hasWhat && hasWho;
  
  if (paragraph_1_covers_what_who_where) {
    score += 10;
  } else {
    reasons.push('Absatz 1 fehlt WAS/WER/WO');
  }
  
  // Absatz 2: Kontext/Einordnung
  const providesContext = para2.length > 40 && !para2.includes('fans dürfen sich freuen');
  const paragraph_2_provides_context = providesContext;
  
  if (paragraph_2_provides_context) {
    score += 10;
  } else {
    reasons.push('Absatz 2 fehlt Kontext');
  }

  // Phase B Feb 2026: DACH-Anker-Check für Discover-Lokalrelevanz.
  // Lead muss in den ersten 2 Absätzen entweder einen DACH-Streamer nennen
  // ODER explizit auf "DACH-Start steht aus" verweisen — sonst -5 Score.
  // Damit verschwinden "Sendet auf BBC One"-Leads, die für DE-Leser nutzlos sind.
  const leadCombined = (paragraphs[0] + ' ' + paragraphs[1]);
  const { hasDachAnchor } = require('./dach-network-mapping');
  const has_dach_anchor = hasDachAnchor(leadCombined);
  if (!has_dach_anchor) {
    reasons.push('Lead ohne DACH-Anker (Streamer in DE/AT/CH nicht genannt, kein "Start in DACH offen")');
    score = Math.max(0, score - 5);
  }

  // FAIL Checks
  const is_paragraph_desert = paragraphs.some(p => p.split(/\s+/).length > 80);
  if (is_paragraph_desert) {
    reasons.push('Absatz-Wüste (> 80 Wörter in einem Absatz)');
    fail_reasons.push('Zu lange Absätze');
    verdict = 'FAIL';
  }
  
  const has_hype_language = HYPE_PHRASES.some(phrase => 
    paragraphs.join(' ').toLowerCase().includes(phrase.toLowerCase())
  );
  
  if (has_hype_language) {
    reasons.push('Hype-Sprache gefunden');
    fail_reasons.push('Marketing-Sprache im Content');
    verdict = 'FAIL';
    score = Math.max(0, score - 10);
  }
  
  return {
    paragraph_1_covers_what_who_where,
    paragraph_2_provides_context,
    is_paragraph_desert,
    has_hype_language,
    score: Math.max(0, Math.min(20, score)),
    verdict,
    reasons,
  };
}

function scoreImage(imageMetadata: any, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  
  const is_tmdb_backdrop = imageMetadata.source === 'TMDB_BACKDROP';
  const width_sufficient = imageMetadata.width >= 1200;
  
  // TMDB Backdrop ≥ 1200px (10 Punkte)
  if (is_tmdb_backdrop && width_sufficient) {
    score += 10;
  } else if (!width_sufficient) {
    reasons.push(`Breite zu gering: ${imageMetadata.width}px (min: 1200px)`);
    fail_reasons.push('Hero Image zu klein für Discover');
    verdict = 'FAIL';
  } else if (!is_tmdb_backdrop) {
    reasons.push('Kein TMDB Backdrop (Poster oder Custom)');
    score += 5; // Partial credit
  }
  
  // Bild eindeutig zur Serie (5 Punkte)
  const clearly_series_related = is_tmdb_backdrop; // Assumption: TMDB Backdrop = clearly related
  if (clearly_series_related) {
    score += 5;
  }
  
  // HARD FAIL
  if (imageMetadata.width < 1200) {
    verdict = 'FAIL';
    score = 0;
  }
  
  return {
    is_tmdb_backdrop,
    width_px: imageMetadata.width,
    width_sufficient,
    clearly_series_related,
    score: Math.max(0, Math.min(15, score)),
    verdict,
    reasons,
  };
}

function scoreTrust(plainText: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 15; // Start with full score
  let verdict: 'PASS' | 'FAIL' = 'PASS';
  
  // Fakten klar getrennt (10 Punkte)
  const facts_separated_from_opinion = !plainText.toLowerCase().includes('meiner meinung nach') && 
                                        !plainText.toLowerCase().includes('ich denke');
  if (!facts_separated_from_opinion) {
    reasons.push('Meinung nicht klar getrennt');
    score -= 5;
  }
  
  // Kein KI-Geschwafel (5 Punkte)
  const aiPhrases = ['es ist wichtig zu beachten', 'zusammenfassend', 'abschließend lässt sich sagen'];
  const no_ai_bloat = !aiPhrases.some(phrase => plainText.toLowerCase().includes(phrase));
  if (!no_ai_bloat) {
    reasons.push('KI-Füllwörter gefunden');
    score -= 3;
  }
  
  // FAIL Checks
  const speculationWords = ['vermutlich', 'wahrscheinlich', 'möglicherweise', 'gerüchten zufolge'];
  const no_speculation = !speculationWords.some(word => plainText.toLowerCase().includes(word));
  
  if (!no_speculation) {
    reasons.push('Spekulation ohne Kennzeichnung');
    fail_reasons.push('Unverifizierte Vermutungen');
    verdict = 'FAIL';
    score -= 5;
  }
  
  const superlatives = ['beste', 'größte', 'erfolgreichste', 'beliebteste'];
  const no_superlatives = !superlatives.some(word => plainText.toLowerCase().includes(word));
  
  if (!no_superlatives) {
    reasons.push('Unnötige Superlative');
    score -= 2;
  }
  
  return {
    facts_separated_from_opinion,
    no_ai_bloat,
    no_speculation,
    no_superlatives,
    score: Math.max(0, Math.min(15, score)),
    verdict,
    reasons,
  };
}

function identifyBlockers(...metrics: any[]): string[] {
  const blockers: string[] = [];
  
  metrics.forEach((metric) => {
    if (metric.verdict === 'FAIL' && metric.reasons.length > 0) {
      blockers.push(...metric.reasons);
    }
  });
  
  return blockers;
}

function generateHints(...metrics: any[]): string[] {
  const hints: string[] = [];

  const [headline, performance, freshness, content, image, trust] = metrics;

  if (headline.score < 20) {
    hints.push('Headline konkreter formulieren (WAS passiert mit WEM)');
  }
  if (performance && performance.score < 20) {
    if (!performance.has_curiosity) hints.push('Open Loop einbauen („Warum …", „Darum …", „Was dahinter steckt")');
    if (!performance.has_emotion) hints.push('Konkrete Emotion anker (Abschied, Rückkehr, Krise, Schock)');
    if (!performance.starts_strong) hints.push('Mit Name, Zahl oder Verb starten — nicht mit „Die" oder „In"');
    if (!performance.has_strong_verb) hints.push('Starkes Handlungs-Verb einsetzen (kippt, streicht, enthüllt, verlässt)');
    if (!performance.no_ai_phrase) hints.push('KI-Template raus („offiziell bestätigt", „im Überblick")');
    if (performance.has_colon_title_pattern) hints.push('Doppelpunkt-Titel vermeiden — Aussagesatz schreibt besser');
  }
  if (freshness.score < 15) {
    hints.push('Artikel zeitnah veröffentlichen (ideal: heute)');
  }
  if (content.score < 15) {
    hints.push('Lead-Absatz muss WAS/WER/WO beantworten');
  }
  if (image.score < 10) {
    hints.push('TMDB Backdrop mit mind. 1200px Breite verwenden');
  }
  if (trust.score < 12) {
    hints.push('Spekulation vermeiden, nur verifizierte Fakten');
  }

  return hints;
}
