/**
 * HEADLINE SCORER v4
 * 
 * Feintuning für konsistente Outlier-Performance.
 * Kontrolliertes Chaos mit Qualitätssicherung.
 * 
 * Änderungen vs v3:
 * - Outlier-Qualitätssicherung: Hoher Outlier + niedrige Clarity = Penalty
 * - Risk Score nicht mehr linear: Skaliert mit Basisqualität
 * - Kontrast-Pattern Extra-Boost +12
 * - Generik härter bestraft (-15 statt -8 für Discover-Killer)
 * - "Serie:"-Penalty intelligent: Hook nach Doppelpunkt = kein Penalty
 * - Micro-CTR-Prediction als unsichtbarer Boost
 * - ctrPredictionScore fließt mit 50% in Final Score
 */

import { matchPattern } from './headline-patterns';

export interface HeadlineScoreResult {
  total: number;
  breakdown: {
    scrollStop: number;
    clarity: number;
    curiosity: number;
    keyword: number;
    length: number;
    patternBoost: number;
    riskScore: number;
    outlierBoost: number;
    genericPenalty: number;
    noTriggerPenalty: number;
    contrastBoost: number;
    ctrPrediction: number;
    outlierQualityPenalty: number;
  };
  penalties: string[];
  // Logging-Felder für spätere Analyse
  meta: {
    wasOutlier: boolean;
    hadContrast: boolean;
    hadGenericPenalty: boolean;
    riskMultiplier: number;
  };
}

// ===== DISCOVER-KILLER: -15 (härter als v3) =====
const DISCOVER_KILLERS: [string, number][] = [
  ['sorgt für aufsehen', -15],
  ['fans dürfen sich freuen', -15],
  ['kommt gut an', -12],
  ['das solltest du wissen', -15],
  ['das musst du wissen', -15],
  ['alles was du wissen musst', -15],
  ['alles was wir wissen', -12],
  ['das erwartet uns', -12],
  ['das erwartet dich', -12],
  ['hier sind die details', -15],
  ['was wir bisher wissen', -12],
  ['es ist soweit', -12],
  ['es wurde bekannt', -12],
  ['große neuigkeiten', -15],
  ['spannende neuigkeiten', -15],
  ['aufregende neuigkeiten', -15],
  ['jetzt wird es spannend', -12],
  ['es wird ernst', -12],
  ['neue details enthüllt', -10],
  ['kommt bald', -12],
  ['startet im', -8],
];

// ===== SCROLL-STOP WÖRTER =====
const SURPRISE_WORDS = [
  'plötzlich', 'überraschend', 'unerwartet', 'niemand', 'keiner',
  'gegen alle', 'doch noch', 'schock', 'anders als', 'zum ersten mal',
  'nie zuvor', 'erstmals', 'heimlich', 'versehentlich', 'ausgerechnet',
];

const EMOTION_WORDS = [
  'fans', 'reaktion', 'tränen', 'wut', 'gänsehaut', 'emotional',
  'begeisterung', 'enttäuschung', 'abschied', 'comeback', 'ende',
  'letzt', 'final', 'nie wieder', 'endgültig', 'bitter', 'dramatisch',
  'kontroverse', 'polarisiert', 'spaltet',
];

const CONFLICT_WORDS = [
  'trotz', 'obwohl', 'statt', 'doch', 'aber', 'erst gefeiert',
  'umstritten', 'kritik', 'streit', 'diskussion', 'kontroverse',
  'spaltet', 'gegen', 'widerspruch', 'vorwürfe',
];

const CURIOSITY_TRIGGERS = [
  'warum', 'wieso', 'darum', 'deshalb', 'so', 'dahinter',
  'wirklich', 'was steckt', 'was bedeutet', 'der wahre grund',
  'geheimnis', 'hintergrund', 'was jetzt', 'was passiert',
];

const STRONG_VERBS = [
  'enthüllt', 'verrät', 'bestätigt', 'bricht', 'zerstört', 'verändert',
  'stoppt', 'rettet', 'verlässt', 'kehrt zurück', 'übernimmt', 'ersetzt',
  'warnt', 'verteidigt', 'gesteht', 'widerspricht', 'droht', 'überrascht',
  'schockiert', 'beweist', 'beendet', 'startet', 'abgesetzt', 'verlängert',
];

// ===== KONTRAST-PATTERNS: Extra +12 =====
const CONTRAST_PATTERNS = [
  /erst\s.*,?\s*(jetzt|dann|nun|doch)\b/i,
  /^trotz\b/i,
  /^doch noch\b/i,
  /niemand hat (damit )?(?:gerechnet|erwartet)/i,
  /gegen alle erwartungen/i,
  /,\s*(aber|doch|jetzt|dann)\s/i,
  /erst gefeiert/i,
  /statt\s.*(?:kommt|macht|geht)/i,
];

// ===== RISK INDICATORS =====
const RISK_INDICATORS = [
  { pattern: /^(erst|trotz|obwohl|gegen|nach|ohne|statt)\b/i, score: 6 },
  { pattern: /,\s*(aber|doch|dann|jetzt|nun)\b/i, score: 5 },
  { pattern: /\s[–—]\s/, score: 4 },
  { pattern: /(ausgerechnet|gerade jetzt|mitten in)/i, score: 5 },
  { pattern: /^(plötzlich|darum|warum|trotz|erst|doch|gegen|so|nie)/i, score: 4 },
  { pattern: /(spaltet|polarisiert|kontroverse|umstritten|bitter)/i, score: 5 },
  { pattern: /\?$/, score: 3 },
];

// ===== OUTLIER DETECTION =====
function calculateOutlierBoost(headline: string, seriesName: string): number {
  const lower = headline.toLowerCase();
  let boost = 0;

  if (!lower.startsWith(seriesName.toLowerCase())) boost += 5;

  const firstColon = headline.indexOf(':');
  if (firstColon === -1 || firstColon > 20) boost += 3;

  if (/,\s*(aber|doch|dann|jetzt|nun|und dann)\b/i.test(headline)) boost += 5;
  if (/(erst.*jetzt|erst.*dann|trotz.*doch)/i.test(lower)) boost += 5;

  if (/\s[–—]\s/.test(headline)) boost += 4;

  if (headline.length >= 25 && headline.length <= 45) boost += 3;

  return Math.min(20, boost);
}

// ===== MICRO CTR PREDICTION =====
function predictCTR(headline: string, seriesName: string): number {
  const lower = headline.toLowerCase();
  let ctr = 0;

  // Starke Emotion
  const emotionHits = EMOTION_WORDS.filter(w => lower.includes(w)).length;
  if (emotionHits >= 1) ctr += 10;

  // Kontrast
  if (CONTRAST_PATTERNS.some(p => p.test(headline))) ctr += 10;

  // Offene Frage / Spannung
  if (/\?$/.test(headline) || CURIOSITY_TRIGGERS.some(t => lower.includes(t))) ctr += 8;

  // Ungewöhnliche Struktur (beginnt nicht mit Serie oder Artikel)
  if (!/^(der|die|das|ein|eine)\s/i.test(headline) && !lower.startsWith(seriesName.toLowerCase())) ctr += 5;

  // Generisch
  if (DISCOVER_KILLERS.some(([phrase]) => lower.includes(phrase))) ctr -= 10;

  // Rein faktisch ohne Hook
  const hasHook = SURPRISE_WORDS.some(w => lower.includes(w)) ||
    EMOTION_WORDS.some(w => lower.includes(w)) ||
    CONFLICT_WORDS.some(w => lower.includes(w)) ||
    CURIOSITY_TRIGGERS.some(t => lower.includes(t));
  if (!hasHook) ctr -= 10;

  return ctr; // Kann negativ sein
}

// ===== "SERIE:" INTELLIGENT =====
function seriesStartPenalty(headline: string, seriesName: string): number {
  const lower = headline.toLowerCase();
  const seriesLower = seriesName.toLowerCase();

  if (!lower.startsWith(seriesLower + ':') && !lower.startsWith(seriesLower + ' :')) return 0;

  // Check: Kommt nach dem Doppelpunkt ein starker Hook?
  const afterColon = headline.substring(headline.indexOf(':') + 1).trim().toLowerCase();

  const hasHookAfter = SURPRISE_WORDS.some(w => afterColon.includes(w)) ||
    CONFLICT_WORDS.some(w => afterColon.includes(w)) ||
    /^(plötzlich|überraschend|doch|trotz|niemand|ausgerechnet|erst)/i.test(afterColon);

  if (hasHookAfter) return 0; // Gut: "The Boys: Plötzlich abgesetzt?"
  return -15; // Schlecht: "The Boys: Neue Details..."
}

export function scoreHeadline(headline: string, seriesName: string, allVariants: string[] = []): HeadlineScoreResult {
  const lower = headline.toLowerCase();
  const penalties: string[] = [];

  // ===== SCROLL-STOP-POTENZIAL (0-30) =====
  let scrollStop = 0;
  scrollStop += Math.min(10, SURPRISE_WORDS.filter(w => lower.includes(w)).length * 5);
  scrollStop += Math.min(10, EMOTION_WORDS.filter(w => lower.includes(w)).length * 5);
  scrollStop += Math.min(10, CONFLICT_WORDS.filter(w => lower.includes(w)).length * 5);
  scrollStop = Math.min(30, scrollStop);

  // ===== CLARITY (0-20) =====
  let clarity = 10;
  if (lower.includes(seriesName.toLowerCase())) clarity += 5;
  if (STRONG_VERBS.some(v => lower.includes(v))) clarity += 5;
  const FILLERS = ['tatsächlich', 'offenbar', 'anscheinend', 'möglicherweise', 'eventuell', 'gewissermaßen', 'grundsätzlich', 'eigentlich', 'sozusagen', 'quasi'];
  clarity -= FILLERS.filter(f => lower.includes(f)).length * 3;
  clarity = Math.max(0, Math.min(20, clarity));

  // ===== NEUGIER (0-20) =====
  let curiosity = 0;
  curiosity += Math.min(10, CURIOSITY_TRIGGERS.filter(t => lower.includes(t)).length * 5);
  if (headline.includes(':') || headline.includes('–') || headline.includes('—')) curiosity += 4;
  if (/^(warum|wieso|was|wie)\b/.test(lower)) curiosity += 4;
  if (/dahinter|wahrer? grund|hintergrund|geheimnis|was wirklich/.test(lower)) curiosity += 4;
  curiosity = Math.min(20, curiosity);

  // ===== KEYWORD (0-10) =====
  let keyword = 0;
  if (lower.includes(seriesName.toLowerCase())) keyword += 5;
  else { penalties.push('Serienname fehlt'); keyword -= 5; }
  if (/staffel\s*\d/.test(lower)) keyword += 3;
  if (/netflix|disney|amazon|prime|trailer|start|premiere|finale|abgesetzt|verlängert/.test(lower)) keyword += 2;
  keyword = Math.max(-5, Math.min(10, keyword));

  // ===== LÄNGE (0-10) =====
  let length = 0;
  const charCount = headline.length;
  if (charCount >= 35 && charCount <= 65) length = 10;
  else if (charCount >= 28 && charCount <= 70) length = 6;
  else if (charCount >= 20 && charCount <= 80) length = 3;
  else { length = 0; penalties.push(`Länge ${charCount}z`); }

  // ===== PATTERN CTR-BOOST (0-15) =====
  const patternMatch = matchPattern(headline);
  const patternBoost = patternMatch.ctrBoost;

  // ===== KONTRAST-BOOST (+12) =====
  let contrastBoost = 0;
  const hadContrast = CONTRAST_PATTERNS.some(p => p.test(headline));
  if (hadContrast) contrastBoost = 12;

  // ===== RAW RISK SCORE (0-20, vor Skalierung) =====
  let rawRisk = 0;
  for (const ind of RISK_INDICATORS) {
    if (ind.pattern.test(headline)) rawRisk += ind.score;
  }
  rawRisk = Math.min(20, rawRisk);

  // ===== OUTLIER BOOST (0-20) =====
  const outlierBoost = calculateOutlierBoost(headline, seriesName);
  const wasOutlier = outlierBoost >= 10;

  // ===== GENERIK-PENALTY (-20 max) =====
  let genericPenalty = 0;
  let hadGenericPenalty = false;
  for (const [phrase, penalty] of DISCOVER_KILLERS) {
    if (lower.includes(phrase)) {
      genericPenalty += penalty;
      hadGenericPenalty = true;
      penalties.push(`"${phrase}" (${penalty})`);
    }
  }
  genericPenalty = Math.max(-20, genericPenalty);

  // Identische Satzanfänge
  if (allVariants.length > 1) {
    const myStart = lower.split(/\s+/).slice(0, 3).join(' ');
    if (allVariants.filter(v => v.toLowerCase().startsWith(myStart)).length > 1) {
      genericPenalty = Math.max(-20, genericPenalty - 3);
      penalties.push('Gleicher Satzanfang');
    }
  }

  // ===== NO-TRIGGER PENALTY =====
  let noTriggerPenalty = 0;
  const hasTrigger = scrollStop >= 5 || patternBoost >= 5 || rawRisk >= 5;
  if (!hasTrigger) {
    noTriggerPenalty = -15;
    penalties.push('Keine Trigger (-15)');
  }

  // ===== "SERIE:" INTELLIGENT =====
  const seriesPenalty = seriesStartPenalty(headline, seriesName);
  if (seriesPenalty < 0) {
    genericPenalty = Math.max(-20, genericPenalty + seriesPenalty);
    penalties.push('"Serie: ..." ohne Hook (-15)');
  }

  // ===== BASISQUALITÄT BERECHNEN (für Risk-Skalierung) =====
  const baseScore = scrollStop + clarity + curiosity + keyword + length + patternBoost + contrastBoost + genericPenalty + noTriggerPenalty;

  // ===== RISK SCORE SKALIEREN (nicht linear) =====
  let riskMultiplier: number;
  if (baseScore < 30) {
    riskMultiplier = 0.5; // Schwache Basis = halber Risk
  } else if (baseScore <= 50) {
    riskMultiplier = 0.8;
  } else if (baseScore <= 70) {
    riskMultiplier = 1.0;
  } else {
    riskMultiplier = 1.2; // Starke Basis = Risk-Boost
  }
  const riskScore = Math.round(rawRisk * riskMultiplier);

  // ===== OUTLIER-QUALITÄTSSICHERUNG =====
  let outlierQualityPenalty = 0;
  if (outlierBoost > 10 && clarity < 10) {
    // clarity < 10 bedeutet: clarity < 50% von max (20)
    outlierQualityPenalty = -15;
    penalties.push('Outlier ohne Substanz (-15)');
  }

  // ===== MICRO CTR PREDICTION =====
  const ctrRaw = predictCTR(headline, seriesName);
  const ctrPrediction = Math.round(ctrRaw * 0.5); // 50% Einfluss

  // ===== TOTAL =====
  const total = Math.max(0, Math.min(100,
    scrollStop + clarity + curiosity + keyword + length +
    patternBoost + contrastBoost + riskScore + outlierBoost +
    genericPenalty + noTriggerPenalty + outlierQualityPenalty +
    ctrPrediction
  ));

  return {
    total,
    breakdown: {
      scrollStop,
      clarity,
      curiosity,
      keyword,
      length,
      patternBoost,
      riskScore,
      outlierBoost,
      genericPenalty,
      noTriggerPenalty,
      contrastBoost,
      ctrPrediction,
      outlierQualityPenalty,
    },
    penalties,
    meta: {
      wasOutlier,
      hadContrast,
      hadGenericPenalty,
      riskMultiplier,
    },
  };
}
