/**
 * HEADLINE SCORER v3
 * 
 * Optimiert für maximale Google Discover CTR.
 * Weniger Blocker, mehr Exploration, Outlier-Förderung.
 * 
 * Score-Komponenten:
 * - scrollStop:        0-30  (Überraschung, Emotion, Konflikt)
 * - clarity:           0-20  (Verständlichkeit, Verb, Serienname)
 * - curiosity:         0-20  (Neugier, Informationslücke)
 * - keyword:           0-10  (Serie, Staffel, Platform)
 * - length:            0-10  (Sweet Spot 35-65 Zeichen)
 * - patternBoost:      0-15  (CTR-Pattern Match)
 * - riskScore:         0-20  (Mut, Ungewöhnlichkeit, Spannung)
 * - outlierBoost:      0-20  (Deutlich anders als Standard)
 * - genericPenalty:   -20..0 (Abzug für Generik, NICHT mehr -30)
 * - noTriggerPenalty: -15..0 (Statt hartem Cap)
 * 
 * KEINE harten Blocker mehr. KEINE Score-Caps.
 * Alles durch Penalties geregelt — jede Headline hat eine Chance.
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
  };
  penalties: string[];
}

// ===== GENERISCHE PHRASEN: Penalty statt Block =====
const GENERIC_PHRASES: [string, number][] = [
  ['sorgt für aufsehen', -8],
  ['fans dürfen sich freuen', -8],
  ['kommt gut an', -6],
  ['das solltest du wissen', -8],
  ['das musst du wissen', -8],
  ['alles was du wissen musst', -8],
  ['alles was wir wissen', -6],
  ['das erwartet uns', -6],
  ['das erwartet dich', -6],
  ['hier sind die details', -8],
  ['was wir bisher wissen', -6],
  ['es ist soweit', -6],
  ['es wurde bekannt', -6],
  ['große neuigkeiten', -8],
  ['spannende neuigkeiten', -8],
  ['aufregende neuigkeiten', -8],
  ['jetzt wird es spannend', -6],
  ['es wird ernst', -6],
  ['neue details enthüllt', -4],
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

// ===== RISK DETECTION =====
const RISK_INDICATORS = [
  // Ungewöhnlicher Satzbau
  { pattern: /^(erst|trotz|obwohl|gegen|nach|ohne|statt)\b/i, score: 6 },
  // Kontrast-Struktur (A, aber/doch/dann B)
  { pattern: /,\s*(aber|doch|dann|jetzt|nun)\b/i, score: 5 },
  // Gedankenstrich als Spannungsbogen
  { pattern: /\s[–—]\s/, score: 4 },
  // Direkte Ansprache / provokant
  { pattern: /(ausgerechnet|gerade jetzt|mitten in)/i, score: 5 },
  // Nicht mit Substantiv/Artikel beginnen
  { pattern: /^(plötzlich|darum|warum|trotz|erst|doch|gegen|so|nie)/i, score: 4 },
  // Emotionale Reibung
  { pattern: /(spaltet|polarisiert|kontroverse|umstritten|bitter)/i, score: 5 },
  // Rhetorische Frage
  { pattern: /\?$/, score: 3 },
];

// ===== OUTLIER DETECTION =====
function calculateOutlierBoost(headline: string, seriesName: string): number {
  const lower = headline.toLowerCase();
  let boost = 0;

  // Beginnt NICHT mit Serienname → Bonus (ungewöhnlicher)
  if (!lower.startsWith(seriesName.toLowerCase())) boost += 5;

  // Kein Doppelpunkt nach erstem Wort (nicht "X: ...") → Bonus
  const firstColon = headline.indexOf(':');
  if (firstColon === -1 || firstColon > 20) boost += 3;

  // Enthält Kontrast (A → B Wechsel)
  if (/,\s*(aber|doch|dann|jetzt|nun|und dann)\b/i.test(headline)) boost += 5;
  if (/(erst.*jetzt|erst.*dann|trotz.*doch)/i.test(lower)) boost += 5;

  // Sichtbarer Spannungsbogen (Gedankenstrich)
  if (/\s[–—]\s/.test(headline)) boost += 4;

  // Ungewöhnlich kurz + punchy (unter 45 Zeichen)
  if (headline.length >= 25 && headline.length <= 45) boost += 3;

  return Math.min(20, boost);
}

export function scoreHeadline(headline: string, seriesName: string, allVariants: string[] = []): HeadlineScoreResult {
  const lower = headline.toLowerCase();
  const penalties: string[] = [];

  // ===== SCROLL-STOP-POTENZIAL (0-30) =====
  let scrollStop = 0;

  const surpriseHits = SURPRISE_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, surpriseHits * 5);

  const emotionHits = EMOTION_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, emotionHits * 5);

  const conflictHits = CONFLICT_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, conflictHits * 5);

  scrollStop = Math.min(30, scrollStop);

  // ===== INFORMATIONSKLARHEIT (0-20) =====
  let clarity = 10;

  if (lower.includes(seriesName.toLowerCase())) clarity += 5;
  if (STRONG_VERBS.some(v => lower.includes(v))) clarity += 5;

  const FILLERS = ['tatsächlich', 'offenbar', 'anscheinend', 'möglicherweise', 'eventuell', 'gewissermaßen', 'grundsätzlich', 'eigentlich', 'sozusagen', 'quasi'];
  const fillerCount = FILLERS.filter(f => lower.includes(f)).length;
  clarity -= fillerCount * 3;

  clarity = Math.max(0, Math.min(20, clarity));

  // ===== NEUGIER (0-20) =====
  let curiosity = 0;

  const curiosityHits = CURIOSITY_TRIGGERS.filter(t => lower.includes(t)).length;
  curiosity += Math.min(10, curiosityHits * 5);

  if (headline.includes(':') || headline.includes('–') || headline.includes('—')) curiosity += 4;
  if (/^(warum|wieso|was|wie)\b/.test(lower)) curiosity += 4;
  if (/dahinter|wahrer? grund|hintergrund|geheimnis|was wirklich/.test(lower)) curiosity += 4;

  curiosity = Math.min(20, curiosity);

  // ===== KEYWORD-PRÄSENZ (0-10) =====
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

  // ===== RISK SCORE (0-20) =====
  let riskScore = 0;
  for (const indicator of RISK_INDICATORS) {
    if (indicator.pattern.test(headline)) {
      riskScore += indicator.score;
    }
  }
  riskScore = Math.min(20, riskScore);

  // ===== OUTLIER BOOST (0-20) =====
  const outlierBoost = calculateOutlierBoost(headline, seriesName);

  // ===== GENERIK-ABZUG (-20 max, abgeschwächt von -30) =====
  let genericPenalty = 0;
  for (const [phrase, penalty] of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      genericPenalty += penalty;
      penalties.push(`Generisch: "${phrase}"`);
    }
  }
  genericPenalty = Math.max(-20, genericPenalty);

  // Identische Satzanfänge
  if (allVariants.length > 1) {
    const myStart = lower.split(/\s+/).slice(0, 3).join(' ');
    const dupes = allVariants.filter(v => v.toLowerCase().startsWith(myStart)).length;
    if (dupes > 1) {
      genericPenalty = Math.max(-20, genericPenalty - 3);
      penalties.push('Gleicher Satzanfang');
    }
  }

  // ===== NO-TRIGGER PENALTY (statt hartem Cap) =====
  let noTriggerPenalty = 0;
  const hasTrigger = scrollStop >= 5 || patternBoost >= 5 || riskScore >= 5;
  if (!hasTrigger) {
    noTriggerPenalty = -15;
    penalties.push('Keine Trigger-Wörter (-15)');
  }

  // ===== "{Serie}:" PENALTY (statt Blocker) =====
  if (lower.startsWith(seriesName.toLowerCase() + ':')) {
    genericPenalty = Math.max(-20, genericPenalty - 10);
    penalties.push('"Serie:"-Start (-10)');
  }

  // ===== TOTAL =====
  const total = Math.max(0, Math.min(100,
    scrollStop + clarity + curiosity + keyword + length +
    patternBoost + riskScore + outlierBoost +
    genericPenalty + noTriggerPenalty
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
    },
    penalties,
  };
}
