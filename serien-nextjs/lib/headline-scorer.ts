/**
 * HEADLINE SCORER v2
 * 
 * Bewertet Headlines für maximale Google Discover CTR.
 * Kein LLM-Call — rein regelbasiert und deterministisch.
 * 
 * NEUE Gewichtung (v2):
 * - Scroll-Stop-Potenzial:   0-30
 * - Informationsklarheit:    0-20  
 * - Neugier:                 0-20
 * - Keyword-Präsenz:         0-10
 * - Länge:                   0-10
 * - Pattern CTR-Boost:       0-15 (Bonus)
 * - Generik-Abzug:          -30 (Penalty)
 * 
 * SCORE-CAP: Ohne Trigger-Wörter → max 60
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
    genericPenalty: number;
  };
  penalties: string[];
  capped: boolean;
}

// ===== GENERISCHE PHRASEN: -30 max =====
const GENERIC_PHRASES: [string, number][] = [
  ['sorgt für aufsehen', -10],
  ['fans dürfen sich freuen', -10],
  ['kommt gut an', -8],
  ['das solltest du wissen', -10],
  ['das musst du wissen', -10],
  ['alles was du wissen musst', -10],
  ['alles was wir wissen', -8],
  ['das erwartet uns', -8],
  ['das erwartet dich', -8],
  ['hier sind die details', -10],
  ['was wir bisher wissen', -8],
  ['es ist soweit', -8],
  ['es ist offiziell', -6],
  ['es wurde bekannt', -8],
  ['große neuigkeiten', -10],
  ['spannende neuigkeiten', -10],
  ['aufregende neuigkeiten', -10],
  ['große veränderungen', -8],
  ['wichtige neuigkeit', -8],
  ['es gibt neuigkeiten', -8],
  ['jetzt wird es spannend', -8],
  ['es wird ernst', -8],
  ['neue details enthüllt', -6],
  ['seht her', -10],
  ['das gibt es zu sagen', -8],
];

// ===== SCROLL-STOP: Überraschung, Emotion, Konflikt =====
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

// ===== NEUGIER =====
const CURIOSITY_TRIGGERS = [
  'warum', 'wieso', 'darum', 'deshalb', 'so', 'dahinter',
  'wirklich', 'was steckt', 'was bedeutet', 'der wahre grund',
  'geheimnis', 'hintergrund', 'was jetzt', 'was passiert',
];

// ===== STARKE VERBEN =====
const STRONG_VERBS = [
  'enthüllt', 'verrät', 'bestätigt', 'bricht', 'zerstört', 'verändert',
  'stoppt', 'rettet', 'verlässt', 'kehrt zurück', 'übernimmt', 'ersetzt',
  'warnt', 'verteidigt', 'gesteht', 'widerspricht', 'droht', 'überrascht',
  'schockiert', 'beweist', 'beendet', 'startet', 'abgesetzt', 'verlängert',
];

// ===== HARD FILTER: Komplett blockieren =====
function shouldBlock(headline: string, seriesName: string): string | null {
  const lower = headline.toLowerCase();
  const seriesLower = seriesName.toLowerCase();
  
  // Beginnt mit "{Serie}:" → zu neutral, Nachrichtenagentur-Stil
  if (lower.startsWith(seriesLower + ':')) {
    return 'Beginnt mit "Serie:" — Nachrichtenagentur-Stil';
  }
  
  // Keinerlei Emotion oder Überraschung
  const hasAnyTrigger = [
    ...SURPRISE_WORDS, ...EMOTION_WORDS, ...CONFLICT_WORDS, ...CURIOSITY_TRIGGERS,
  ].some(w => lower.includes(w));
  
  if (!hasAnyTrigger) {
    // Prüfe ob wenigstens ein starkes Verb da ist
    const hasVerb = STRONG_VERBS.some(v => lower.includes(v));
    if (!hasVerb) {
      return 'Keine Emotion, Überraschung oder starkes Verb';
    }
  }
  
  return null;
}

export function scoreHeadline(headline: string, seriesName: string, allVariants: string[] = []): HeadlineScoreResult {
  const lower = headline.toLowerCase();
  const penalties: string[] = [];
  let capped = false;

  // ===== HARD FILTER =====
  const blockReason = shouldBlock(headline, seriesName);
  if (blockReason) {
    return {
      total: 0,
      breakdown: { scrollStop: 0, clarity: 0, curiosity: 0, keyword: 0, length: 0, patternBoost: 0, genericPenalty: -30 },
      penalties: [`BLOCKIERT: ${blockReason}`],
      capped: true,
    };
  }

  // ===== SCROLL-STOP-POTENZIAL (0-30) =====
  let scrollStop = 0;
  
  // Überraschung (+10 max)
  const surpriseHits = SURPRISE_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, surpriseHits * 5);
  
  // Emotionale Reaktion (+10 max)
  const emotionHits = EMOTION_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, emotionHits * 5);
  
  // Klarer Konflikt (+10 max)
  const conflictHits = CONFLICT_WORDS.filter(w => lower.includes(w)).length;
  scrollStop += Math.min(10, conflictHits * 5);
  
  scrollStop = Math.min(30, scrollStop);

  // ===== INFORMATIONSKLARHEIT (0-20) =====
  let clarity = 10; // Startwert
  
  // Enthält Serienname
  if (lower.includes(seriesName.toLowerCase())) clarity += 5;
  
  // Starkes Verb
  if (STRONG_VERBS.some(v => lower.includes(v))) clarity += 5;
  
  // Füllwörter abziehen
  const FILLERS = ['tatsächlich', 'offenbar', 'anscheinend', 'möglicherweise', 'eventuell', 'gewissermaßen', 'grundsätzlich', 'eigentlich', 'sozusagen', 'quasi'];
  const fillerCount = FILLERS.filter(f => lower.includes(f)).length;
  clarity -= fillerCount * 3;
  
  clarity = Math.max(0, Math.min(20, clarity));

  // ===== NEUGIER (0-20) =====
  let curiosity = 0;
  
  const curiosityHits = CURIOSITY_TRIGGERS.filter(t => lower.includes(t)).length;
  curiosity += Math.min(10, curiosityHits * 5);
  
  // Doppelpunkt oder Gedankenstrich (Spannungsaufbau)
  if (headline.includes(':') || headline.includes('–') || headline.includes('—')) curiosity += 4;
  
  // Frage-Struktur
  if (/^(warum|wieso|was|wie)\b/.test(lower)) curiosity += 4;
  
  // Informationslücke
  if (/dahinter|wahrer? grund|hintergrund|geheimnis|was wirklich/.test(lower)) curiosity += 4;
  
  curiosity = Math.min(20, curiosity);

  // ===== KEYWORD-PRÄSENZ (0-10) =====
  let keyword = 0;
  
  if (lower.includes(seriesName.toLowerCase())) keyword += 5;
  else { penalties.push('Serienname fehlt!'); }
  
  if (/staffel\s*\d/.test(lower)) keyword += 3;
  if (/netflix|disney|amazon|prime|trailer|start|premiere|finale|abgesetzt|verlängert/.test(lower)) keyword += 2;
  
  keyword = Math.min(10, keyword);

  // ===== LÄNGE (0-10) =====
  let length = 0;
  const charCount = headline.length;
  
  if (charCount >= 35 && charCount <= 65) length = 10;
  else if (charCount >= 28 && charCount <= 70) length = 6;
  else if (charCount >= 20 && charCount <= 80) length = 3;
  else { length = 0; penalties.push(`Länge ${charCount}z — Ziel: 35-65`); }

  // ===== PATTERN CTR-BOOST (0-15) =====
  const patternMatch = matchPattern(headline);
  const patternBoost = patternMatch.ctrBoost;

  // ===== GENERIK-ABZUG (-30 max) =====
  let genericPenalty = 0;
  for (const [phrase, penalty] of GENERIC_PHRASES) {
    if (lower.includes(phrase)) {
      genericPenalty += penalty;
      penalties.push(`Generisch: "${phrase}"`);
    }
  }
  genericPenalty = Math.max(-30, genericPenalty);
  
  // Identische Satzanfänge mit anderen Varianten
  if (allVariants.length > 1) {
    const myStart = lower.split(/\s+/).slice(0, 3).join(' ');
    const dupes = allVariants.filter(v => v.toLowerCase().startsWith(myStart)).length;
    if (dupes > 1) {
      genericPenalty -= 5;
      penalties.push('Identischer Satzanfang wie andere Variante');
    }
  }

  // ===== SCORE-CAP REGEL =====
  // Ohne Trigger-Wörter oder Emotion → max 60
  const hasTrigger = scrollStop >= 5 || patternBoost >= 5;
  if (!hasTrigger) {
    capped = true;
    penalties.push('SCORE-CAP: Keine Trigger-Wörter → max 60');
  }

  // ===== TOTAL =====
  let total = scrollStop + clarity + curiosity + keyword + length + patternBoost + genericPenalty;
  
  if (capped && total > 60) total = 60;
  
  total = Math.max(0, Math.min(100, total));

  return {
    total,
    breakdown: { scrollStop, clarity, curiosity, keyword, length, patternBoost, genericPenalty },
    penalties,
    capped,
  };
}
