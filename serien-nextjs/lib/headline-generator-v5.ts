/**
 * HEADLINE GENERATOR v5.1
 * 
 * Template-based headline candidate generator designed specifically
 * to feed the existing Headline Scorer v5.1.
 * 
 * NO LLM calls. NO scoring logic duplication.
 * Only produces candidates → dedupes → filters → hands to scorer.
 * 
 * Pipeline:
 * 1. Normalize input
 * 2. Derive generator signals
 * 3. Generate raw candidates from 6 template families
 * 4. Dedupe
 * 5. Filter (banned phrases, weak structures)
 * 6. Score with existing v5.1 scorer
 * 7. Sort + pick winner
 * 8. Return debug-friendly result
 */

import {
  scoreHeadlineV5,
  pickWinnerV5,
  type HeadlineScoreV5Result,
  type ArticleContext,
} from './headline-scorer-v5';

// ============================================================
// TYPES
// ============================================================

export type HeadlineGeneratorInput = {
  primarySeries?: string | null;
  secondaryEntity?: string | null;
  platform?: string | null;
  event?: string | null;
  eventDetail?: string | null;
  context?: string | null;
  sentiment?: 'positiv' | 'negativ' | 'neutral' | 'kontrovers';
  surprise?: boolean;
  controversy?: boolean;
  timing?: string | null;
};

export type GeneratedHeadlineResult = {
  input: HeadlineGeneratorInput;
  rawCandidates: string[];
  filteredCandidates: string[];
  filteredOut: Array<{ headline: string; reason: string }>;
  scoredCandidates: HeadlineScoreV5Result[];
  topCandidates: HeadlineScoreV5Result[];
  recommendedWinner: HeadlineScoreV5Result | null;
};

type GeneratorSignals = {
  isNegative: boolean;
  isPositive: boolean;
  isControversial: boolean;
  isDelay: boolean;
  isCancel: boolean;
  isRenewal: boolean;
  isRelease: boolean;
  supportsContrast: boolean;
  supportsRisk: boolean;
};

type NormalizedInput = Required<Omit<HeadlineGeneratorInput, 'primarySeries' | 'secondaryEntity' | 'platform' | 'event' | 'eventDetail' | 'context' | 'timing'>> & {
  primarySeries: string;
  secondaryEntity: string;
  platform: string;
  event: string;
  eventDetail: string;
  context: string;
  timing: string;
};

// ============================================================
// WORD LISTS (generator-only, aligned with v5.1 penalties)
// ============================================================

const NEGATIVE_HOOKS = [
  'plötzlich', 'überraschend', 'ausgerechnet jetzt',
  'doch nicht', 'vor dem Aus', 'unerwartet',
];

const POSITIVE_HOOKS = [
  'doch noch', 'jetzt doch', 'überraschend doch', 'endlich',
];

const CONTRAST_INTROS = [
  'Trotz Rekordquoten', 'Erst gefeiert, jetzt', 'Niemand rechnete damit',
  'Ausgerechnet jetzt', 'Gegen alle Erwartungen', 'Erst totgesagt, jetzt',
];

const NEGATIVE_EVENTS = ['abgesetzt', 'gestrichen', 'eingestellt', 'verschoben'];
const POSITIVE_EVENTS = ['verlängert', 'bestätigt', 'bekommt doch noch'];
const CONTROVERSY_EVENTS = ['umstritten', 'heftig kritisiert', 'eskaliert'];

const BANNED_PHRASES = [
  'neue details', 'erste infos', 'weitere infos', 'das musst du wissen',
  'so geht es weiter', 'das steckt dahinter', 'wie es weitergeht',
  'nun ist es offiziell', 'sorgt für aufsehen', 'fans dürfen sich freuen',
  'fans diskutieren', 'macht hoffnung', 'es gibt hinweise',
  'große neuigkeiten', 'spannende neuigkeiten', 'hier sind die details',
  'jetzt wird es spannend', 'fans dürfen gespannt sein',
  'das erwartet uns', 'das erwartet dich', 'alles was du wissen musst',
  'alles was wir wissen', 'kommt gut an', 'es ist soweit',
  'sorgt jetzt für diskussionen', 'lässt fans hoffen',
];

// ============================================================
// NORMALIZE + SIGNALS
// ============================================================

function normalizeGeneratorInput(input: HeadlineGeneratorInput): NormalizedInput {
  return {
    primarySeries: input.primarySeries?.trim() || '',
    secondaryEntity: input.secondaryEntity?.trim() || '',
    platform: input.platform?.trim() || '',
    event: input.event?.trim() || '',
    eventDetail: input.eventDetail?.trim() || '',
    context: input.context?.trim() || '',
    sentiment: input.sentiment || 'neutral',
    surprise: input.surprise ?? false,
    controversy: input.controversy ?? false,
    timing: input.timing?.trim() || '',
  };
}

function deriveGeneratorSignals(input: NormalizedInput): GeneratorSignals {
  const eventLower = input.event.toLowerCase();
  const contextLower = input.context.toLowerCase();
  const detailLower = input.eventDetail.toLowerCase();
  const all = `${eventLower} ${contextLower} ${detailLower}`;

  const isCancel = /abgesetzt|gestrichen|eingestellt|gecancelt/.test(all);
  const isDelay = /verschoben|verzögert|später|verspätet/.test(all);
  const isRenewal = /verlängert|bestätigt|grünes licht|bekommt.*staffel/.test(all);
  const isRelease = /startet|erscheint|kommt|premiere|release/.test(all);
  const isControversial = /umstritten|kritisiert|eskaliert|kontroverse|skandal/.test(all) || input.controversy;

  const isNegative = input.sentiment === 'negativ' || isCancel || isDelay;
  const isPositive = input.sentiment === 'positiv' || isRenewal;

  // Contrast requires real semantic reversal
  const hasContrastContext = /trotz|obwohl|erst.*jetzt|gegen alle/i.test(contextLower);
  const supportsContrast = hasContrastContext || (input.surprise && (isCancel || isRenewal));

  const supportsRisk = isCancel || isControversial || /floppt|scheitert|vor dem aus/.test(all);

  return {
    isNegative, isPositive, isControversial,
    isDelay, isCancel, isRenewal, isRelease,
    supportsContrast, supportsRisk,
  };
}

// ============================================================
// TEMPLATE GENERATORS
// ============================================================

function generateEntityFirst(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s) return [];
  const candidates: string[] = [];
  const evt = input.event;

  if (signals.isCancel) {
    candidates.push(`${s}: Plötzlich abgesetzt`);
    candidates.push(`${s}: Überraschend gestrichen`);
    if (input.eventDetail) candidates.push(`${s}: ${input.eventDetail}`);
    if (input.platform) candidates.push(`${s}: ${input.platform} zieht den Stecker`);
  }

  if (signals.isRenewal) {
    candidates.push(`${s}: Doch noch verlängert`);
    candidates.push(`${s}: Überraschend bestätigt`);
    if (input.eventDetail) candidates.push(`${s}: ${input.eventDetail}`);
  }

  if (signals.isDelay) {
    candidates.push(`${s}: Überraschend verschoben`);
    candidates.push(`${s}: Start verzögert sich`);
  }

  if (signals.isControversial) {
    candidates.push(`${s}: Plötzlich umstritten`);
    candidates.push(`${s}: Heftige Kritik nach ${evt || 'neuer Folge'}`);
  }

  if (evt && !signals.isCancel && !signals.isRenewal && !signals.isDelay && !signals.isControversial) {
    candidates.push(`${s}: ${evt.charAt(0).toUpperCase() + evt.slice(1)} überrascht`);
  }

  return candidates;
}

function generateHookFirst(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s) return [];
  const candidates: string[] = [];
  const hooks = signals.isNegative ? NEGATIVE_HOOKS : POSITIVE_HOOKS;

  for (const hook of hooks.slice(0, 3)) {
    if (signals.isCancel) {
      candidates.push(`${hook.charAt(0).toUpperCase() + hook.slice(1)} abgesetzt: ${s} verliert Staffel`);
      candidates.push(`${hook.charAt(0).toUpperCase() + hook.slice(1)} gestrichen: ${s} ist raus`);
    }
    if (signals.isRenewal) {
      candidates.push(`${hook.charAt(0).toUpperCase() + hook.slice(1)} verlängert: ${s} bekommt neue Staffel`);
    }
    if (signals.isDelay) {
      candidates.push(`${hook.charAt(0).toUpperCase() + hook.slice(1)} verschoben: ${s} startet später`);
    }
    if (signals.isControversial) {
      candidates.push(`${hook.charAt(0).toUpperCase() + hook.slice(1)} umstritten: ${s} in der Kritik`);
    }
  }

  // Generic hook + event + entity for any event
  if (input.event && !signals.isCancel && !signals.isRenewal) {
    candidates.push(`Überraschend: ${s} ${input.event}`);
    if (input.surprise) candidates.push(`Plötzlich: ${s} ${input.event}`);
  }

  return candidates;
}

function generateContrastCandidates(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s || !signals.supportsContrast) return [];
  const candidates: string[] = [];

  if (input.context) {
    const ctx = input.context;
    if (signals.isCancel) {
      candidates.push(`Trotz ${ctx}: ${s} abgesetzt`);
      candidates.push(`${ctx}, doch ${s} wird gestrichen`);
    }
    if (signals.isRenewal) {
      candidates.push(`Trotz ${ctx}: ${s} doch noch verlängert`);
      candidates.push(`Erst totgesagt, jetzt verlängert: ${s}`);
    }
    if (signals.isControversial) {
      candidates.push(`Erst gefeiert, jetzt umstritten: ${s}`);
    }
  }

  // Surprise-based contrast
  if (input.surprise) {
    if (signals.isCancel) {
      candidates.push(`Niemand rechnete damit: ${s} abgesetzt`);
      candidates.push(`Gegen alle Erwartungen: ${s} gestrichen`);
    }
    if (signals.isRenewal) {
      candidates.push(`Niemand rechnete damit: ${s} doch noch verlängert`);
    }
  }

  return candidates;
}

function generateContextEventCandidates(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s || !input.context) return [];
  const candidates: string[] = [];
  const ctx = input.context;

  if (signals.isCancel) {
    candidates.push(`Trotz ${ctx} verliert ${s} die nächste Staffel`);
    candidates.push(`Wegen ${ctx}: ${s} plötzlich abgesetzt`);
    candidates.push(`Nach ${ctx}: ${s} überraschend gestrichen`);
  }
  if (signals.isControversial) {
    candidates.push(`Nach ${ctx}: ${s} plötzlich umstritten`);
    candidates.push(`Wegen ${ctx}: ${s} heftig kritisiert`);
  }
  if (signals.isRenewal) {
    candidates.push(`Trotz ${ctx}: ${s} überraschend verlängert`);
  }
  if (signals.isDelay) {
    candidates.push(`Wegen ${ctx}: ${s} verschoben`);
  }

  return candidates;
}

function generatePlatformCandidates(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s || !input.platform) return [];
  const candidates: string[] = [];
  const p = input.platform;

  if (signals.isCancel) {
    candidates.push(`${p} streicht ${s} überraschend`);
    candidates.push(`${p} setzt ${s} plötzlich ab`);
    candidates.push(`${p} beendet ${s} – trotz Erfolg`);
  }
  if (signals.isRenewal) {
    candidates.push(`${p} verlängert ${s} doch noch`);
    candidates.push(`${p} bestätigt ${s} überraschend`);
  }
  if (signals.isDelay) {
    candidates.push(`${p} verschiebt ${s} überraschend`);
  }

  return candidates;
}

function generateEventDetailCandidates(input: NormalizedInput, signals: GeneratorSignals): string[] {
  const s = input.primarySeries;
  if (!s || !input.eventDetail) return [];
  const candidates: string[] = [];
  const detail = input.eventDetail;

  if (signals.isCancel) {
    candidates.push(`Plötzlich abgesetzt: ${s} – ${detail}`);
    candidates.push(`${s}: ${detail} – überraschend abgesetzt`);
  }
  if (signals.isRenewal) {
    candidates.push(`Doch noch verlängert: ${s} – ${detail}`);
    candidates.push(`${s}: ${detail}`);
  }
  if (signals.isDelay) {
    candidates.push(`Überraschend verschoben: ${s} – ${detail}`);
  }
  if (signals.isControversial) {
    candidates.push(`${s} umstritten: ${detail}`);
  }

  // Generic with detail
  if (input.event && detail) {
    candidates.push(`${s} ${input.event}: ${detail}`);
  }

  return candidates;
}

// ============================================================
// DEDUPE + FILTER
// ============================================================

function dedupeHeadlines(headlines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const h of headlines) {
    const normalized = h.trim().replace(/\s+/g, ' ');
    if (!normalized) continue;

    // Normalize for comparison: lowercase, strip trailing punctuation
    const key = normalized.toLowerCase().replace(/[.!?]+$/, '').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function filterGeneratedCandidates(
  headlines: string[],
  seriesName: string
): { passed: string[]; rejected: Array<{ headline: string; reason: string }> } {
  const passed: string[] = [];
  const rejected: Array<{ headline: string; reason: string }> = [];
  const seriesLower = seriesName.toLowerCase();

  for (const h of headlines) {
    const lower = h.toLowerCase();

    // 1. Banned phrase
    const bannedHit = BANNED_PHRASES.find(bp => lower.includes(bp));
    if (bannedHit) {
      rejected.push({ headline: h, reason: `Banned: "${bannedHit}"` });
      continue;
    }

    // 2. No visible entity AND no clear event
    const hasVisibleEntity = seriesLower ? lower.includes(seriesLower) : false;
    const hasEvent = NEGATIVE_EVENTS.some(e => lower.includes(e)) ||
      POSITIVE_EVENTS.some(e => lower.includes(e)) ||
      CONTROVERSY_EVENTS.some(e => lower.includes(e)) ||
      /verschoben|startet|erscheint|premiere/.test(lower);

    if (!hasVisibleEntity && !hasEvent) {
      rejected.push({ headline: h, reason: 'Keine sichtbare Entität und kein Event' });
      continue;
    }

    // 3. Too short
    if (h.length < 20) {
      rejected.push({ headline: h, reason: `Zu kurz: ${h.length}z` });
      continue;
    }

    // 4. Too long
    if (h.length > 75) {
      rejected.push({ headline: h, reason: `Zu lang: ${h.length}z` });
      continue;
    }

    // 5. Generic hook without event: just a hook word + entity, no substance
    const hasHook = NEGATIVE_HOOKS.some(hk => lower.includes(hk)) || POSITIVE_HOOKS.some(hk => lower.includes(hk));
    if (hasHook && !hasEvent && h.split(/\s+/).length <= 3) {
      rejected.push({ headline: h, reason: 'Hook ohne konkretes Event' });
      continue;
    }

    passed.push(h);
  }

  return { passed, rejected };
}

// ============================================================
// MAIN FUNCTION
// ============================================================

export function generateHeadlineCandidatesV51(input: HeadlineGeneratorInput): GeneratedHeadlineResult {
  const normalized = normalizeGeneratorInput(input);
  const signals = deriveGeneratorSignals(normalized);

  // --- Generate from all template families ---
  const raw: string[] = [
    ...generateEntityFirst(normalized, signals),
    ...generateHookFirst(normalized, signals),
    ...generateContrastCandidates(normalized, signals),
    ...generateContextEventCandidates(normalized, signals),
    ...generatePlatformCandidates(normalized, signals),
    ...generateEventDetailCandidates(normalized, signals),
  ];

  // --- Dedupe ---
  const deduped = dedupeHeadlines(raw);

  // --- Filter ---
  const { passed: filteredCandidates, rejected: filteredOut } = filterGeneratedCandidates(
    deduped,
    normalized.primarySeries
  );

  // --- Score with v5.1 ---
  const articleContext: ArticleContext = {
    seriesName: normalized.primarySeries || undefined,
    persons: normalized.secondaryEntity ? [normalized.secondaryEntity] : undefined,
    keywords: [normalized.platform, normalized.event].filter(Boolean) as string[],
  };

  const scoredCandidates = filteredCandidates.map(h =>
    scoreHeadlineV5(h, articleContext, filteredCandidates)
  ).sort((a, b) => b.finalScore - a.finalScore);

  // --- Top 5 + Winner ---
  const topCandidates = scoredCandidates.slice(0, 5);

  let recommendedWinner: HeadlineScoreV5Result | null = null;
  if (filteredCandidates.length > 0) {
    const winnerResult = pickWinnerV5(filteredCandidates, articleContext);
    recommendedWinner = winnerResult.winner;
  }

  return {
    input,
    rawCandidates: deduped,
    filteredCandidates,
    filteredOut,
    scoredCandidates,
    topCandidates,
    recommendedWinner,
  };
}
