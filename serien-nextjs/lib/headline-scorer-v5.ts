/**
 * HEADLINE SCORER v5
 * 
 * Intelligentere Unterscheidung zwischen:
 * - echter CTR-Stärke
 * - generischem Clickbait
 * - klarer Topic-Relevanz
 * - Discover-tauglicher Formulierung
 * - Headlines mit echter Outlier-Qualität
 * 
 * Gewichtung:
 *   Hook Strength:           0-22
 *   Topic Clarity:           0-20
 *   Specificity/Event:       0-18
 *   Risk/Conflict:           0-15
 *   Contrast/Pattern:        0-10
 *   CTR Prediction:          0-15
 *   Relative Outlier Bonus:  0-8
 *   Hard-Killer Penalty:    -20..0
 *   Soft-Killer Penalty:    -12..0
 *   Ceiling:                 optional cap
 * 
 * v4 bleibt als Fallback erhalten.
 * Umschaltbar via HEADLINE_SCORER_VERSION.
 */

export const HEADLINE_SCORER_VERSION = 'v5.1';

// ============================================================
// TYPES
// ============================================================

export interface HeadlineScoreV5Result {
  headline: string;
  finalScore: number;
  passedMinimum: boolean;
  isReserve: boolean;
  isStrongCandidate: boolean;
  componentScores: {
    hookStrength: number;
    topicClarity: number;
    visibleTopicClarity: number;
    contextTopicClarity: number;
    specificity: number;
    riskConflict: number;
    contrastPattern: number;
    ctrPrediction: number;
  };
  penalties: Array<{ type: string; phrase: string; value: number }>;
  boosts: Array<{ type: string; reason: string; value: number }>;
  ceilingApplied: string | null;
  relativeOutlierBonus: number;
  rawScoreBeforeCeiling: number;
  meta: {
    hasEntity: boolean;
    hasVisibleEntity: boolean;
    hasSpecificEvent: boolean;
    hasRealConflict: boolean;
    hasConditionalContrast: boolean;
    seriesStartHandling: 'no_penalty' | 'penalty' | 'not_applicable';
  };
}

export interface ArticleContext {
  seriesName?: string;
  persons?: string[];
  keywords?: string[];
}

// ============================================================
// WORD LISTS
// ============================================================

// --- HOOK STRENGTH ---
const STRONG_HOOKS = [
  'plötzlich', 'überraschend', 'ausgerechnet', 'doch noch', 'vor dem aus',
  'abgesetzt', 'gestrichen', 'umstritten', 'eskaliert', 'floppt',
  'heftig kritisiert', 'doch nicht', 'überraschend geändert', 'nie zuvor',
  'erstmals', 'heimlich', 'versehentlich', 'schock', 'endgültig',
  'bitter', 'dramatisch', 'unerwartet',
];

const WEAK_HOOKS = [
  'neue details', 'erste infos', 'weitere infos', 'wurde bekannt',
  'es gibt hinweise', 'könnte', 'möglicherweise', 'eventuell',
];

// --- SPECIFIC EVENTS ---
const SPECIFIC_EVENTS = [
  'abgesetzt', 'verlängert', 'verschoben', 'gestrichen', 'bestätigt',
  'offiziell beendet', 'startet', 'kehrt zurück', 'übernimmt',
  'verlässt', 'ersetzt', 'beendet', 'gesteht', 'widerspricht',
  'enthüllt', 'verrät', 'bricht', 'überrascht', 'schockiert',
  'abgesagt', 'angekündigt', 'gedreht', 'erscheint', 'premiere',
  'finale', 'comeback', 'neustart', 'reboot',
];

// --- REAL RISK / CONFLICT ---
const REAL_RISK_WORDS = [
  'abgesetzt', 'gestrichen', 'floppt', 'eskaliert', 'umstritten',
  'vor dem aus', 'heftig kritisiert', 'doch nicht', 'gescheitert',
  'kontroverse', 'skandal', 'vorwürfe', 'klage', 'boykott',
  'gefeuert', 'rausgeworfen', 'suspendiert', 'entlassen', 'gecancelt',
  'shitstorm', 'desaster', 'katastrophe', 'flop',
];

const FAKE_RISK_WORDS = [
  'sorgt für aufsehen', 'fans diskutieren', 'macht hoffnung',
  'könnte wichtig werden', 'wird spannend', 'es wird ernst',
  'sorgt für aufregung', 'fans rätseln',
];

// --- CONTRAST PATTERNS (semantic: positive→negative, expectation→reality) ---
const SEMANTIC_CONTRAST_PATTERNS = [
  { pattern: /trotz\s+(rekord|erfolg|hit|hype|lob|begeisterung|quoten)/i, label: 'trotz+Erfolg' },
  { pattern: /erst\s+gefeiert.*(?:jetzt|nun|doch|dann)\s+(?:umstritten|abgesetzt|gestrichen|kritisiert|gescheitert)/i, label: 'erst gefeiert→negativ' },
  { pattern: /erst\s+(?:totgesagt|abgeschrieben|aufgegeben).*(?:jetzt|nun|doch|dann)\s+(?:verlängert|zurück|comeback|hit)/i, label: 'erst totgesagt→positiv' },
  { pattern: /doch\s+noch\s+(?:abgesetzt|gestrichen|verlängert|zurück|bestätigt)/i, label: 'doch noch+Event' },
  { pattern: /niemand\s+(?:hat\s+damit\s+)?(?:gerechnet|erwartet).*(?:abgesetzt|verlängert|zurück|gestrichen|ende)/i, label: 'niemand erwartet+Event' },
  { pattern: /gegen\s+alle\s+erwartungen/i, label: 'gegen alle Erwartungen' },
  { pattern: /statt\s+(?:verlängerung|fortsetzung|staffel).*(?:abgesetzt|gestrichen|ende)/i, label: 'statt X→Ende' },
];

// --- HARD KILLERS (-15 to -20) ---
const HARD_KILLERS: Array<{ phrase: string; penalty: number }> = [
  { phrase: 'sorgt für aufsehen', penalty: -18 },
  { phrase: 'fans dürfen sich freuen', penalty: -18 },
  { phrase: 'das musst du wissen', penalty: -20 },
  { phrase: 'so geht es weiter', penalty: -15 },
  { phrase: 'das steckt dahinter', penalty: -15 },
  { phrase: 'wie es weitergeht', penalty: -15 },
  { phrase: 'nun ist es offiziell', penalty: -15 },
  { phrase: 'mit diesen worten', penalty: -15 },
  { phrase: 'sorgt jetzt für diskussionen', penalty: -15 },
  { phrase: 'lässt fans hoffen', penalty: -15 },
  { phrase: 'alles was du wissen musst', penalty: -20 },
  { phrase: 'alles was wir wissen', penalty: -15 },
  { phrase: 'große neuigkeiten', penalty: -18 },
  { phrase: 'spannende neuigkeiten', penalty: -18 },
  { phrase: 'hier sind die details', penalty: -18 },
  { phrase: 'jetzt wird es spannend', penalty: -15 },
  { phrase: 'fans dürfen gespannt sein', penalty: -15 },
  { phrase: 'das erwartet uns', penalty: -15 },
  { phrase: 'das erwartet dich', penalty: -15 },
];

// --- SOFT KILLERS (-6 to -12) ---
const SOFT_KILLERS: Array<{ phrase: string; penalty: number }> = [
  { phrase: 'neue details', penalty: -8 },
  { phrase: 'erste infos', penalty: -8 },
  { phrase: 'weitere infos', penalty: -8 },
  { phrase: 'wurde bekannt', penalty: -8 },
  { phrase: 'könnte', penalty: -6 },
  { phrase: 'möglicherweise', penalty: -8 },
  { phrase: 'eventuell', penalty: -8 },
  { phrase: 'irgendwie', penalty: -10 },
  { phrase: 'wohl', penalty: -6 },
  { phrase: 'startet im', penalty: -6 },
  { phrase: 'erscheint im', penalty: -6 },
  { phrase: 'erscheint bald', penalty: -8 },
  { phrase: 'kommt bald', penalty: -8 },
  { phrase: 'es gibt hinweise', penalty: -8 },
  { phrase: 'offenbar', penalty: -6 },
  { phrase: 'anscheinend', penalty: -8 },
];

// --- FILLER / WEAK VERBS ---
const FILLERS = [
  'tatsächlich', 'gewissermaßen', 'grundsätzlich', 'eigentlich',
  'sozusagen', 'quasi', 'irgendwie', 'relativ', 'ziemlich',
];

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

// --- ENTITY HINTS für visible detection (ohne Context) ---
const ENTITY_HINTS = [
  'netflix', 'disney', 'amazon', 'prime video', 'hbo', 'apple tv',
  'paramount', 'sky', 'wow', 'hulu', 'marvel', 'star wars', 'dc',
  'staffel', 'serie', 'showrunner', 'regisseur',
];

/**
 * FIX 1: Visible Topic-Clarity — nur was IM HEADLINE steht
 */
export function detectVisibleTopicClarity(headline: string, seriesName?: string): number {
  const lower = headline.toLowerCase();
  let score = 0;

  // Serienname sichtbar im Headline
  if (seriesName && lower.includes(seriesName.toLowerCase())) {
    score += 15;
  }

  // Doppelpunkt + Name-Pattern = sehr sichtbar
  if (score === 0 && headline.includes(':')) {
    // Etwas vor dem Doppelpunkt = potenzieller Entity-Name
    const beforeColon = headline.substring(0, headline.indexOf(':')).trim();
    if (beforeColon.length >= 3 && beforeColon.length <= 40) score += 8;
  }

  // Bekannte Platform/Brand-Keywords
  if (ENTITY_HINTS.some(kw => lower.includes(kw))) {
    score += 4;
  }

  // "Staffel X" = konkrete Serien-Referenz
  if (/staffel\s*\d/i.test(lower)) score += 4;

  return Math.min(20, score);
}

/**
 * FIX 1: Context Topic-Clarity — aus Artikel-Kontext, NICHT aus Headline
 */
export function detectContextTopicClarity(context?: ArticleContext): number {
  if (!context) return 0;
  let score = 0;

  if (context.seriesName) score += 6;
  if (context.persons && context.persons.length > 0) score += 2;

  return Math.min(8, score);
}

/**
 * FIX 1: Kombinierte Topic-Clarity mit Cap wenn nur Context
 */
export function detectTopicClarity(headline: string, context?: ArticleContext): { total: number; visible: number; context: number } {
  const visible = detectVisibleTopicClarity(headline, context?.seriesName);
  const ctx = detectContextTopicClarity(context);

  let total = visible + ctx;

  // KEY FIX: Wenn keine sichtbare Entität → Context allein maximal 8
  if (visible === 0) {
    total = Math.min(total, 8);
  }

  total = Math.min(20, total);

  return { total, visible, context: ctx };
}

export function detectSpecificEvent(headline: string): number {
  const lower = headline.toLowerCase();
  let score = 0;

  const hits = SPECIFIC_EVENTS.filter(e => lower.includes(e));
  score += Math.min(12, hits.length * 6);

  // Numbers = concrete
  if (/\d/.test(headline)) score += 3;

  // Temporal markers = specificity
  if (/\b(jetzt|sofort|ab sofort|offiziell|bestätigt|endgültig)\b/i.test(lower)) score += 3;

  return Math.min(18, score);
}

export function detectRealConflict(headline: string): number {
  const lower = headline.toLowerCase();
  let score = 0;

  // Real risk/conflict
  const realHits = REAL_RISK_WORDS.filter(w => lower.includes(w));
  score += Math.min(12, realHits.length * 6);

  // Fake risk? Reduce
  const fakeHits = FAKE_RISK_WORDS.filter(w => lower.includes(w));
  score -= fakeHits.length * 4;

  // Bonus for hard negative outcomes
  if (/abgesetzt|gestrichen|gefeuert|gecancelt|vor dem aus/i.test(lower)) score += 3;

  return Math.max(0, Math.min(15, score));
}

export function detectConditionalContrast(headline: string): number {
  let score = 0;

  for (const { pattern, label } of SEMANTIC_CONTRAST_PATTERNS) {
    if (pattern.test(headline)) {
      score += 8;
      break; // One strong match is enough
    }
  }

  // Simple structural contrast (weaker, only +3)
  if (score === 0) {
    if (/,\s*(aber|doch|dann|jetzt|nun)\s/i.test(headline)) score += 3;
    if (/\s[–—]\s/.test(headline)) score += 2;
  }

  return Math.min(10, score);
}

export function detectHardKillers(headline: string): Array<{ type: string; phrase: string; value: number }> {
  const lower = headline.toLowerCase();
  const hits: Array<{ type: string; phrase: string; value: number }> = [];

  for (const k of HARD_KILLERS) {
    if (lower.includes(k.phrase)) {
      hits.push({ type: 'hard_killer', phrase: k.phrase, value: k.penalty });
    }
  }

  return hits;
}

export function detectSoftKillers(headline: string): Array<{ type: string; phrase: string; value: number }> {
  const lower = headline.toLowerCase();
  const hits: Array<{ type: string; phrase: string; value: number }> = [];

  for (const k of SOFT_KILLERS) {
    if (lower.includes(k.phrase)) {
      hits.push({ type: 'soft_killer', phrase: k.phrase, value: k.penalty });
    }
  }

  // Filler words
  for (const f of FILLERS) {
    if (lower.includes(f)) {
      hits.push({ type: 'filler', phrase: f, value: -4 });
    }
  }

  return hits;
}

export function applyScoreCeiling(
  rawScore: number,
  topicClarity: number,
  specificity: number
): { score: number; ceiling: string | null } {
  // No entity + no specific event → hard cap
  if (topicClarity < 8 && specificity < 6) {
    const cap = 75;
    if (rawScore > cap) return { score: cap, ceiling: `Cap 75: keine Entität + kein Event` };
  }

  // Low topic clarity alone
  if (topicClarity < 12 && rawScore > 85) {
    return { score: 85, ceiling: `Cap 85: schwache Topic-Clarity` };
  }

  return { score: rawScore, ceiling: null };
}

export function computeRelativeOutlierBonus(
  headline: string,
  peerHeadlines: string[] | null,
  context?: ArticleContext
): number {
  if (!peerHeadlines || peerHeadlines.length < 2) return 0;

  const lower = headline.toLowerCase();
  const seriesLower = context?.seriesName?.toLowerCase() || '';

  // Compute average characteristics of peers
  let peerGenericCount = 0;
  let peerStartsSame = 0;
  const myStart = lower.split(/\s+/).slice(0, 2).join(' ');

  for (const peer of peerHeadlines) {
    if (peer === headline) continue;
    const pLower = peer.toLowerCase();

    // Count generic peers
    if (SOFT_KILLERS.some(k => pLower.includes(k.phrase)) || HARD_KILLERS.some(k => pLower.includes(k.phrase))) {
      peerGenericCount++;
    }

    // Same start
    if (pLower.startsWith(myStart)) peerStartsSame++;
  }

  let bonus = 0;

  // This headline is NOT generic while peers are → outlier bonus
  const myIsGeneric = SOFT_KILLERS.some(k => lower.includes(k.phrase)) || HARD_KILLERS.some(k => lower.includes(k.phrase));
  if (!myIsGeneric && peerGenericCount >= 2) bonus += 4;

  // This headline has unique start
  if (peerStartsSame === 0) bonus += 2;

  // This headline doesn't start with series name while others do
  const peersStartWithSeries = peerHeadlines.filter(p => p !== headline && p.toLowerCase().startsWith(seriesLower + ':')).length;
  if (!lower.startsWith(seriesLower + ':') && peersStartWithSeries >= 2) bonus += 2;

  return Math.min(8, bonus);
}

// ============================================================
// SERIES: INTELLIGENT HANDLING
// ============================================================

function seriesStartHandling(headline: string, seriesName: string): { penalty: number; handling: 'no_penalty' | 'penalty' | 'not_applicable' } {
  const lower = headline.toLowerCase();
  const seriesLower = seriesName.toLowerCase();

  if (!lower.startsWith(seriesLower + ':') && !lower.startsWith(seriesLower + ' :')) {
    return { penalty: 0, handling: 'not_applicable' };
  }

  const afterColon = headline.substring(headline.indexOf(':') + 1).trim().toLowerCase();

  // Strong hook after colon?
  const hasStrongHook = STRONG_HOOKS.some(h => afterColon.includes(h));
  const hasEvent = SPECIFIC_EVENTS.some(e => afterColon.includes(e));
  const hasRisk = REAL_RISK_WORDS.some(r => afterColon.includes(r));

  if (hasStrongHook || hasEvent || hasRisk) {
    return { penalty: 0, handling: 'no_penalty' };
  }

  // Hard killer after colon?
  const hasHardKiller = HARD_KILLERS.some(k => afterColon.includes(k.phrase));
  if (hasHardKiller) {
    return { penalty: -20, handling: 'penalty' };
  }

  return { penalty: -12, handling: 'penalty' };
}

// ============================================================
// HOOK STRENGTH
// ============================================================

function computeHookStrength(headline: string): number {
  const lower = headline.toLowerCase();
  let score = 0;

  // Strong hooks
  const strongHits = STRONG_HOOKS.filter(h => lower.includes(h));
  score += Math.min(15, strongHits.length * 5);

  // Structural hooks
  if (/^(plötzlich|überraschend|ausgerechnet|trotz|erst|doch|gegen|nie|darum|warum)\b/i.test(lower)) score += 4;
  if (headline.includes(':') || /\s[–—]\s/.test(headline)) score += 3;

  // Weak hooks reduce
  const weakHits = WEAK_HOOKS.filter(h => lower.includes(h));
  score -= weakHits.length * 3;

  return Math.max(0, Math.min(22, score));
}

// ============================================================
// CTR PREDICTION
// ============================================================

function computeCtrPrediction(headline: string, topicClarity: number, specificity: number): number {
  const lower = headline.toLowerCase();
  let ctr = 0;

  // Neugier
  if (/warum|wieso|darum|was steckt|der wahre grund|was wirklich/i.test(lower)) ctr += 5;
  if (/\?$/.test(headline)) ctr += 3;

  // Reibung / emotional
  if (REAL_RISK_WORDS.some(w => lower.includes(w))) ctr += 5;
  if (/fans|zuschauer|publikum/i.test(lower)) ctr += 2;

  // Concrete + clear = discoverable
  if (topicClarity >= 12 && specificity >= 8) ctr += 5;

  // Generic = anti-CTR
  if (HARD_KILLERS.some(k => lower.includes(k.phrase))) ctr -= 8;
  if (SOFT_KILLERS.some(k => lower.includes(k.phrase))) ctr -= 4;

  // Austauschbar / zu offen
  const hasEntity = topicClarity >= 8;
  if (!hasEntity) ctr -= 5;

  return Math.max(0, Math.min(15, ctr));
}

// ============================================================
// MAIN SCORER
// ============================================================

export function scoreHeadlineV5(
  headline: string,
  articleContext?: ArticleContext,
  peerHeadlines?: string[]
): HeadlineScoreV5Result {
  const seriesName = articleContext?.seriesName || '';
  const penalties: Array<{ type: string; phrase: string; value: number }> = [];
  const boosts: Array<{ type: string; reason: string; value: number }> = [];

  // --- COMPONENT SCORES ---
  const hookStrength = computeHookStrength(headline);
  
  // FIX 1: Visible vs Context Topic-Clarity
  const topicClarityResult = detectTopicClarity(headline, articleContext);
  const topicClarity = topicClarityResult.total;
  const visibleTopicClarity = topicClarityResult.visible;
  const contextTopicClarity = topicClarityResult.context;
  
  const specificity = detectSpecificEvent(headline);
  const riskConflict = detectRealConflict(headline);
  const contrastPattern = detectConditionalContrast(headline);
  const ctrPrediction = computeCtrPrediction(headline, topicClarity, specificity);

  // --- PENALTIES ---
  // FIX 2: Hard vs Soft strikt getrennt
  const hardKillerHits = detectHardKillers(headline);
  penalties.push(...hardKillerHits);
  let totalHardPenalty = hardKillerHits.reduce((s, h) => s + h.value, 0);
  totalHardPenalty = Math.max(-20, totalHardPenalty);

  const softKillerHits = detectSoftKillers(headline);
  penalties.push(...softKillerHits);
  let totalSoftPenalty = softKillerHits.reduce((s, h) => s + h.value, 0);
  totalSoftPenalty = Math.max(-12, totalSoftPenalty);

  // Series: handling
  const seriesHandling = seriesStartHandling(headline, seriesName);
  if (seriesHandling.penalty < 0) {
    penalties.push({ type: 'series_start', phrase: `${seriesName}: ...`, value: seriesHandling.penalty });
  }

  // Length penalty
  const charCount = headline.length;
  let lengthPenalty = 0;
  if (charCount > 70) { lengthPenalty = -5; penalties.push({ type: 'length', phrase: `${charCount}z > 70`, value: -5 }); }
  else if (charCount < 25) { lengthPenalty = -5; penalties.push({ type: 'length', phrase: `${charCount}z < 25`, value: -5 }); }

  // Duplicate start with peers
  let dupePenalty = 0;
  if (peerHeadlines && peerHeadlines.length > 1) {
    const lower = headline.toLowerCase();
    const myStart = lower.split(/\s+/).slice(0, 3).join(' ');
    const dupes = peerHeadlines.filter(p => p !== headline && p.toLowerCase().startsWith(myStart)).length;
    if (dupes > 0) {
      dupePenalty = -3;
      penalties.push({ type: 'dupe_start', phrase: myStart, value: -3 });
    }
  }

  // --- BOOSTS ---
  
  // FIX 3: Premium Pattern Boost (+12 für semantischen Kontrast)
  let premiumBoost = 0;
  if (contrastPattern >= 8) {
    premiumBoost = 12;
    boosts.push({ type: 'premium_contrast', reason: 'Semantischer Kontrast-Pattern erkannt', value: 12 });
  }

  // FIX 3: Combo Bonus — visible entity + specificity + risk zusammen
  let comboBonus = 0;
  if (visibleTopicClarity >= 10 && specificity >= 10 && riskConflict >= 8) {
    comboBonus = 6;
    boosts.push({ type: 'combo_clarity_risk', reason: 'Entity + Event + Conflict', value: 6 });
  }

  // FIX 3: High-Quality Bonus — Hook + Risk + Event + sichtbare Entity
  let hqBonus = 0;
  if (hookStrength >= 5 && riskConflict >= 5 && specificity >= 6 && visibleTopicClarity >= 8) {
    hqBonus = 5;
    boosts.push({ type: 'high_quality', reason: 'Hook + Risk + Event + Entity', value: 5 });
  }

  if (hookStrength >= 15) {
    boosts.push({ type: 'strong_hook', reason: 'Starker Hook', value: 0 });
  }

  // Relative outlier
  const relativeOutlierBonus = computeRelativeOutlierBonus(headline, peerHeadlines || null, articleContext);
  if (relativeOutlierBonus > 0) {
    boosts.push({ type: 'relative_outlier', reason: 'Stärker als Peer-Durchschnitt', value: relativeOutlierBonus });
  }

  // --- RAW SCORE ---
  const totalPenalties = totalHardPenalty + totalSoftPenalty + seriesHandling.penalty + lengthPenalty + dupePenalty;

  let rawScore = hookStrength + topicClarity + specificity + riskConflict +
    contrastPattern + ctrPrediction + relativeOutlierBonus +
    premiumBoost + comboBonus + hqBonus + totalPenalties;

  rawScore = Math.max(0, rawScore);
  const rawScoreBeforeCeiling = rawScore;

  // --- CEILING (FIX 3: erst ganz am Ende) ---
  const { score: cappedScore, ceiling } = applyScoreCeiling(rawScore, topicClarity, specificity);
  const finalScore = Math.max(0, Math.min(100, cappedScore));

  // --- MINIMUM ---
  const passedMinimum = finalScore >= 55;
  const isReserve = finalScore >= 55 && finalScore < 65;
  const isStrongCandidate = finalScore >= 70;

  return {
    headline,
    finalScore,
    passedMinimum,
    isReserve,
    isStrongCandidate,
    componentScores: {
      hookStrength,
      topicClarity,
      visibleTopicClarity,
      contextTopicClarity,
      specificity,
      riskConflict,
      contrastPattern,
      ctrPrediction,
    },
    penalties,
    boosts,
    ceilingApplied: ceiling,
    relativeOutlierBonus,
    rawScoreBeforeCeiling,
    meta: {
      hasEntity: topicClarity >= 8,
      hasVisibleEntity: visibleTopicClarity >= 8,
      hasSpecificEvent: specificity >= 6,
      hasRealConflict: riskConflict >= 6,
      hasConditionalContrast: contrastPattern >= 8,
      seriesStartHandling: seriesHandling.handling,
    },
  };
}

// ============================================================
// WINNER SELECTION
// ============================================================

export function pickWinnerV5(
  headlines: string[],
  articleContext?: ArticleContext
): { winner: HeadlineScoreV5Result; ranked: HeadlineScoreV5Result[]; filteredOut: number } {
  // Score all
  const scored = headlines.map(h => scoreHeadlineV5(h, articleContext, headlines));

  // Sort descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // Filter: under 55 = out
  const eligible = scored.filter(s => s.passedMinimum);
  const filteredOut = scored.length - eligible.length;

  // If nothing passes, take best anyway
  const pool = eligible.length > 0 ? eligible : scored;

  // Tiebreaker for close scores: prefer Topic-Clarity > Specificity > less generic
  if (pool.length >= 3) {
    const top3Spread = pool[0].finalScore - pool[2].finalScore;
    if (top3Spread <= 8) {
      // Close race → sort by topicClarity then specificity
      pool.sort((a, b) => {
        if (Math.abs(a.finalScore - b.finalScore) <= 5) {
          // Prefer topic clarity
          const clarityDiff = b.componentScores.topicClarity - a.componentScores.topicClarity;
          if (clarityDiff !== 0) return clarityDiff;
          // Then specificity
          return b.componentScores.specificity - a.componentScores.specificity;
        }
        return b.finalScore - a.finalScore;
      });
    }
  }

  // Weighted random from top 5 (flache Gewichtung)
  const weights = [0.25, 0.25, 0.20, 0.15, 0.15];
  const n = Math.min(pool.length, weights.length);
  const active = weights.slice(0, n);
  const sum = active.reduce((a, b) => a + b, 0);
  const norm = active.map(w => w / sum);

  const seed = Math.floor(Date.now() / 60000);
  const rand = ((seed * 9301 + 49297) % 233280) / 233280;

  let cum = 0;
  let selectedIdx = 0;
  for (let i = 0; i < norm.length; i++) {
    cum += norm[i];
    if (rand <= cum) { selectedIdx = i; break; }
  }

  return {
    winner: pool[selectedIdx] || pool[0],
    ranked: scored,
    filteredOut,
  };
}
