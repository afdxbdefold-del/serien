/**
 * INTRO SCORER v1
 * 
 * Scores intro quality for Google Discover (0-100).
 * Purely rule-based, no LLM calls.
 * 
 * Base: 50
 * Boosts: consequence words, emotion, headline match, punchiness, facts, impact
 * Penalties: source-start, generic, no tension, passive/long
 */

// --- CONSEQUENCE / SHIFT WORDS (Satz 1 hook) ---
const CONSEQUENCE_WORDS = [
  'stellt um', 'verändert', 'reagiert', 'muss', 'ersetzt', 'verliert',
  'endet', 'bricht', 'stoppt', 'fällt', 'scheitert', 'überrascht',
  'spaltet', 'eskaliert', 'zwingt', 'bedeutet', 'trifft', 'droht',
  'steht vor', 'kämpft', 'rettet', 'beendet', 'kehrt zurück',
  'gestrichen', 'abgesetzt', 'verschoben', 'bestätigt', 'verlängert',
  'umstritten', 'kritisiert', 'polarisiert', 'schockiert',
];

// --- EMOTION / TENSION WORDS ---
const TENSION_WORDS = [
  'plötzlich', 'überraschend', 'unerwartet', 'ausgerechnet', 'trotz',
  'obwohl', 'bitter', 'dramatisch', 'heftig', 'schmerzhaft',
  'endgültig', 'unwiderruflich', 'kontrovers', 'brisant', 'explosiv',
  'doch', 'allerdings', 'dennoch', 'stattdessen', 'entgegen',
  'nie zuvor', 'erstmals', 'zum letzten mal', 'ein für alle mal',
];

// --- CONCRETE FACT INDICATORS (Satz 2) ---
const FACT_INDICATORS = [
  /staffel\s*\d/i, /folge\s*\d/i, /episode\s*\d/i,
  /\d{4}/, // year
  /\d+\.\s*(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)/i,
  /netflix|disney\+?|amazon|prime video|hbo|paramount\+?|apple tv\+?|sky|wow/i,
  /[A-Z][a-z]+\s+[A-Z][a-z]+/, // Proper name pattern
];

// --- SOURCE-START PENALTY (verboten) ---
const SOURCE_START_PATTERNS = [
  /^(paramount|netflix|disney|amazon|hbo|apple|fox|nbc|abc|cbs|hulu|sky|warner|sony|mgm|lionsgate)\s+(hat|gab|bestätigte|teilte|verkündete|erklärte)/i,
  /^(der\s+sender|die\s+plattform|das\s+studio|der\s+streamer)\s+(hat|gab)/i,
  /^(laut|gemäß|wie)\s+.{0,20}\s+(bekannt|berichtet|mitgeteilt)/i,
  /^.{0,30}\s+hat\s+bekannt\s+gegeben/i,
  /^.{0,30}\s+gab\s+bekannt/i,
];

// --- TIMELINE-START PENALTY ---
const TIMELINE_START_PATTERNS = [
  /^in\s+staffel\s+\d/i,
  /^am\s+\d/i,
  /^im\s+(januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember)/i,
  /^seit\s+(dem|der|den)\s/i,
  /^bereits\s+(im|am|seit)/i,
];

// --- GENERIC STARTS ---
const GENERIC_START_PATTERNS = [
  /^es gibt (neuigkeiten|news|neues)/i,
  /^es wurde bekannt/i,
  /^nun (ist|wurde|steht)/i,
  /^wie (bereits|schon) berichtet/i,
  /^gute nachrichten/i,
  /^schlechte nachrichten/i,
  /^es (ist|bleibt) (spannend|unklar)/i,
];

export interface IntroScoreResult {
  score: number;
  boosts: Array<{ reason: string; value: number }>;
  penalties: Array<{ reason: string; value: number }>;
}

export function scoreIntro(intro: string, headlineType?: string): IntroScoreResult {
  const boosts: Array<{ reason: string; value: number }> = [];
  const penalties: Array<{ reason: string; value: number }> = [];
  const lower = intro.toLowerCase();
  const sentences = intro.match(/[^.!?]+[.!?]+/g) || [intro];
  const firstSentence = (sentences[0] || '').toLowerCase();
  const secondSentence = (sentences[1] || '').toLowerCase();
  const thirdSentence = (sentences[2] || '').toLowerCase();

  let score = 50;

  // === BOOSTS ===

  // +15: First sentence contains consequence/shift
  if (CONSEQUENCE_WORDS.some(w => firstSentence.includes(w))) {
    boosts.push({ reason: 'Satz 1: Konsequenz/Shift', value: 15 });
    score += 15;
  }

  // +10: First sentence is short + punchy (max 12 words)
  const firstSentenceWords = (sentences[0] || '').trim().split(/\s+/).length;
  if (firstSentenceWords <= 12 && firstSentenceWords >= 3) {
    boosts.push({ reason: 'Satz 1: Kurz + punchy (≤12 Wörter)', value: 10 });
    score += 10;
  } else if (firstSentenceWords > 18) {
    penalties.push({ reason: `Satz 1 zu lang: ${firstSentenceWords} Wörter`, value: -10 });
    score -= 10;
  }

  // +10: Emotion/tension words present
  if (TENSION_WORDS.some(w => lower.includes(w))) {
    boosts.push({ reason: 'Spannungswörter vorhanden', value: 10 });
    score += 10;
  }

  // +10: Matches headline intent
  if (headlineType) {
    const intentMatch =
      (headlineType === 'conflict' && /trotz|obwohl|spaltet|umstritten|kontrovers/i.test(lower)) ||
      (headlineType === 'surprise' && /plötzlich|überraschend|unerwartet|niemand/i.test(lower)) ||
      (headlineType === 'twist' && /doch|stattdessen|entgegen|allerdings/i.test(lower)) ||
      (headlineType === 'impact' && /bestätigt|offiziell|endgültig|jetzt/i.test(lower)) ||
      (headlineType === 'reaction' && /fans|zuschauer|reaktion|diskussion/i.test(lower)) ||
      (headlineType === 'curiosity' && /warum|dahinter|wirklich|grund/i.test(lower));
    if (intentMatch) {
      boosts.push({ reason: `Headline-Intent "${headlineType}" matched`, value: 10 });
      score += 10;
    }
  }

  // +10: Sentences are short + punchy (avg < 20 words)
  const avgWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1);
  if (avgWords <= 18 && sentences.length >= 2) {
    boosts.push({ reason: 'Kurze, punchy Sätze', value: 10 });
    score += 10;
  }

  // +5: Second sentence has concrete facts
  if (FACT_INDICATORS.some(p => p.test(secondSentence || thirdSentence || ''))) {
    boosts.push({ reason: 'Satz 2/3: Konkrete Fakten', value: 5 });
    score += 5;
  }

  // +5: Third sentence explains impact/relevance
  if (/bedeutet|heißt|folge|konsequenz|auswirkung|zukunft|fans|zuschauer|publikum|damit/i.test(thirdSentence)) {
    boosts.push({ reason: 'Satz 3: Impact/Relevanz', value: 5 });
    score += 5;
  }

  // === PENALTIES ===

  // -20: Starts with source attribution
  if (SOURCE_START_PATTERNS.some(p => p.test(intro))) {
    penalties.push({ reason: 'Startet mit Quelle', value: -20 });
    score -= 20;
  }

  // -15: Starts with timeline
  if (TIMELINE_START_PATTERNS.some(p => p.test(intro))) {
    penalties.push({ reason: 'Startet mit Zeitangabe', value: -15 });
    score -= 15;
  }

  // -15: Starts with slow buildup ("Jahrelang galt", "Seit langem", "Schon immer")
  if (/^(jahrelang|seit langem|seit langer zeit|schon immer|seit jeher|lange zeit)/i.test(intro.trim())) {
    penalties.push({ reason: 'Langsamer Einstieg', value: -15 });
    score -= 15;
  }

  // -15: Generic start
  if (GENERIC_START_PATTERNS.some(p => p.test(intro))) {
    penalties.push({ reason: 'Generischer Start', value: -15 });
    score -= 15;
  }

  // -10: No tension words at all
  if (!TENSION_WORDS.some(w => lower.includes(w)) && !CONSEQUENCE_WORDS.some(w => firstSentence.includes(w))) {
    penalties.push({ reason: 'Keine Spannung', value: -10 });
    score -= 10;
  }

  // -10: Too long or passive
  if (avgWords > 25) {
    penalties.push({ reason: 'Zu lange Sätze', value: -10 });
    score -= 10;
  }
  if (/wurde\s+\w+\s+(dass|ob|wie)/i.test(firstSentence)) {
    penalties.push({ reason: 'Passiver Satz 1', value: -5 });
    score -= 5;
  }

  // -5: Only 1 sentence
  if (sentences.length < 2) {
    penalties.push({ reason: 'Weniger als 2 Sätze', value: -5 });
    score -= 5;
  }

  return { score: Math.max(0, Math.min(100, score)), boosts, penalties };
}
