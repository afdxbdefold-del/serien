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
 * PASS: ≥ 91 Punkte (~70%) → publishMode = "DISCOVER"
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
const EMOTIONAL_WORDS = [
  'abschied', 'schock', 'drama', 'enttäuscht', 'enttäuschung', 'durchbruch',
  'überraschung', 'überrascht', 'rückkehr', 'comeback', 'trauer', 'trauert',
  'triumph', 'verlust', 'verrat', 'verraten', 'krise', 'skandal',
  'neustart', 'wende', 'bruch', 'mysterium', 'rätsel',
  'kampf', 'angst', 'hoffnung', 'liebe', 'hass', 'wut', 'streit',
  'eskalation', 'aus', 'ende', 'finale', 'neubeginn',
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

// Strong action verbs that signal something happened
const STRONG_VERBS = [
  'beendet', 'kippt', 'streicht', 'verlässt', 'überrascht',
  'schockiert', 'bricht', 'stürmt', 'zerreißt', 'erobert',
  'kehrt zurück', 'kehrt', 'stirbt', 'verschwindet', 'entlarvt',
  'setzt', 'kündigt', 'stoppt', 'enthüllt', 'bestätigt',
  'verliert', 'gewinnt', 'entdeckt', 'verrät', 'feuert',
  'zerstört', 'rettet', 'triumphiert', 'scheitert', 'eskaliert',
  'dreht', 'beendet', 'kassiert', 'holt', 'verpasst',
  'warnt', 'droht', 'erhebt', 'zieht', 'wirft',
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

function scoreHeadlinePerformance(headline: string, fail_reasons: string[]) {
  const reasons: string[] = [];
  let score = 0;
  const safe = (headline || '').trim();
  const lower = safe.toLowerCase();
  const words = safe.split(/\s+/);
  const firstWord = words[0]?.replace(/[^\wäöüß]/gi, '').toLowerCase() || '';

  // 1. CURIOSITY / OPEN LOOP (5)
  const has_curiosity = CURIOSITY_PATTERNS.some((p) => p.test(safe));
  if (has_curiosity) {
    score += 5;
  } else {
    reasons.push('Kein Open-Loop / Neugier-Trigger');
  }

  // 2. EMOTIONAL PULL (5)
  const has_emotion = EMOTIONAL_WORDS.some((w) => lower.includes(w));
  if (has_emotion) {
    score += 5;
  } else {
    reasons.push('Keine emotionale Verankerung');
  }

  // 3. SCROLL-STOP POWER (5) — first word matters on feed cards
  const starts_with_number = /^\d/.test(safe);
  const starts_with_name = /^[A-ZÄÖÜ][a-zäöüß]+/.test(safe) && !WEAK_FIRST_WORDS.has(firstWord);
  const starts_strong = starts_with_number || starts_with_name;
  if (starts_strong) {
    score += 5;
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
  const has_strong_verb = STRONG_VERBS.some((v) => lower.includes(v));
  if (has_strong_verb) {
    score += 5;
  } else {
    reasons.push('Kein starkes Handlungs-Verb');
  }

  // 6. FEED CTR POTENTIAL (5) — sweet-spot length + no colon-title + concreteness
  let ctr_score = 0;
  const len = safe.length;
  const length_sweet_spot = len >= 40 && len <= 70;
  if (length_sweet_spot) {
    ctr_score += 2;
  } else if (len < 40) {
    reasons.push(`Zu kurz für Feed-Card (${len} Zeichen, ideal 40–70)`);
  } else {
    reasons.push(`Zu lang für Feed-Card (${len} Zeichen, ideal 40–70)`);
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

  // === TOTAL SCORE (out of 130) ===
  const total_score =
    headlineMetrics.score +
    headlinePerformanceMetrics.score +
    freshnessMetrics.score +
    contentMetrics.score +
    imageMetrics.score +
    trustMetrics.score;

  const discover_eligible = total_score >= 91;

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
  
  const clarity_specific = !isGeneric && safeHeadline.length <= 70 && safeHeadline.length >= 20;
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
  
  // 3. News-Wert erkennbar (10 Punkte)
  const newsWords = ['bestätigt', 'startet', 'endet', 'angekündigt', 'veröffentlicht', 'beendet', 'erhält'];
  const news_value_clear = newsWords.some(word => safeHeadline.toLowerCase().includes(word));
  if (news_value_clear) {
    score += 10;
  } else {
    reasons.push('News-Wert nicht erkennbar');
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
    news_value_clear,
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
