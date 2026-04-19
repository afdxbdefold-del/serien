/**
 * HEADLINE PATTERN LIBRARY v2 — Google Discover Edition
 *
 * 20 high-performing Discover patterns across 8 editorial angles.
 * Used by headline-engine.ts to generate human, curiosity-driven,
 * trust-safe German headlines with high CTR.
 *
 * Old v1 exports (HEADLINE_PATTERNS, getPatternsByCategory,
 * getPatternsForPrompt, matchPattern) remain for backward compatibility
 * with lib/headline-scorer.ts (v4, currently unused) and any tests.
 */

// ══════════════════════════════════════════════════════════════════════
// ANGLES — the 8 editorial categories the engine classifies into
// ══════════════════════════════════════════════════════════════════════
export type HeadlineAngle =
  | 'success'          // streaming dominance, viewership, staying on top
  | 'comeback'         // returns, surprise revivals
  | 'season_update'    // new season, release waiting, production hints
  | 'quality_praise'   // critics, reception, why it resonates
  | 'star_power'       // actor drives interest in the show
  | 'underrated'       // hidden gem, overlooked
  | 'controversy'      // polarising, divisive, criticism
  | 'trend_momentum'   // buzz, people talking again, viral moment
  | 'nostalgia';       // career origins, TV legends, classic stars, legacy roles

// ══════════════════════════════════════════════════════════════════════
// v2 PATTERNS — 20 Discover-optimised templates
// ══════════════════════════════════════════════════════════════════════
export interface DiscoverPattern {
  id: string;
  angle: HeadlineAngle;
  template: string;       // German template with {SERIE} {STAR} {PLATTFORM} {STAFFEL} {ZAHL} {THEMA} {DATUM}
  requires: Array<'SERIE' | 'STAR' | 'PLATTFORM' | 'STAFFEL'>;
  ctrBoost: number;       // 0–15, added to scorer if this pattern's fingerprint is matched
}

export const DISCOVER_PATTERNS: DiscoverPattern[] = [
  // ─── SUCCESS / DOMINANCE (1–4) ─────────────────────────────────────
  { id: 'succ_01', angle: 'success',     template: '{SERIE} hört einfach nicht auf – selbst jetzt bleibt die Serie ganz vorne', requires: ['SERIE'],                  ctrBoost: 12 },
  { id: 'succ_02', angle: 'success',     template: 'Monate später: {SERIE} schlägt weiter fast alles bei {PLATTFORM}',          requires: ['SERIE','PLATTFORM'],      ctrBoost: 12 },
  { id: 'succ_03', angle: 'success',     template: '{SERIE} lässt aktuell überraschend viele Hits hinter sich',                  requires: ['SERIE'],                  ctrBoost: 10 },
  { id: 'succ_04', angle: 'success',     template: '{SERIE} bleibt größer, als viele erwartet hatten',                           requires: ['SERIE'],                  ctrBoost: 10 },

  // ─── RELEASE / WAITING / NEW SEASON (5–8) ──────────────────────────
  { id: 'seas_01', angle: 'season_update', template: 'Für Fans wird es spannend: {SERIE} Staffel {STAFFEL} rückt näher',        requires: ['SERIE','STAFFEL'],        ctrBoost: 10 },
  { id: 'seas_02', angle: 'season_update', template: 'Neue Hinweise zu {SERIE} Staffel {STAFFEL}',                               requires: ['SERIE','STAFFEL'],        ctrBoost: 9  },
  { id: 'seas_03', angle: 'season_update', template: 'Bei {SERIE} verdichten sich die Zeichen auf Staffel {STAFFEL}',            requires: ['SERIE','STAFFEL'],        ctrBoost: 10 },
  { id: 'seas_04', angle: 'season_update', template: '{SERIE} könnte früher zurückkehren als gedacht',                           requires: ['SERIE'],                  ctrBoost: 11 },

  // ─── SURPRISE / COMEBACK (9–12) ────────────────────────────────────
  { id: 'come_01', angle: 'comeback',    template: 'Kaum jemand sah das kommen: {SERIE} meldet sich zurück',                     requires: ['SERIE'],                  ctrBoost: 13 },
  { id: 'come_02', angle: 'comeback',    template: 'Ausgerechnet jetzt sorgt {SERIE} wieder für Gesprächsstoff',                 requires: ['SERIE'],                  ctrBoost: 10 },
  { id: 'come_03', angle: 'comeback',    template: 'Niemand rechnete damit – doch {SERIE} ist wieder da',                        requires: ['SERIE'],                  ctrBoost: 12 },
  { id: 'come_04', angle: 'trend_momentum', template: 'Plötzlich reden wieder alle über {SERIE}',                                requires: ['SERIE'],                  ctrBoost: 11 },

  // ─── QUALITY / PRAISE (13–16) ──────────────────────────────────────
  { id: 'qual_01', angle: 'quality_praise', template: 'Warum {SERIE} gerade so stark ankommt',                                   requires: ['SERIE'],                  ctrBoost: 10 },
  { id: 'qual_02', angle: 'quality_praise', template: '{SERIE} überzeugt aktuell selbst Skeptiker',                              requires: ['SERIE'],                  ctrBoost: 11 },
  { id: 'qual_03', angle: 'quality_praise', template: 'Kritiker feiern {SERIE} – und das hat Gründe',                           requires: ['SERIE'],                  ctrBoost: 10 },
  { id: 'qual_04', angle: 'quality_praise', template: '{SERIE} trifft gerade genau den Nerv vieler Zuschauer',                   requires: ['SERIE'],                  ctrBoost: 10 },

  // ─── STAR POWER (17–18) ────────────────────────────────────────────
  { id: 'star_01', angle: 'star_power',  template: 'Wegen {STAR} reden jetzt wieder alle über {SERIE}',                          requires: ['SERIE','STAR'],           ctrBoost: 12 },
  { id: 'star_02', angle: 'star_power',  template: '{STAR} macht {SERIE} plötzlich noch interessanter',                          requires: ['SERIE','STAR'],           ctrBoost: 11 },

  // ─── UNDERRATED / HIDDEN GEM (19–20) ───────────────────────────────
  { id: 'undr_01', angle: 'underrated',  template: 'Viele übersehen {SERIE} noch immer – dabei läuft es gerade stark',           requires: ['SERIE'],                  ctrBoost: 11 },
  { id: 'undr_02', angle: 'underrated',  template: '{SERIE} könnte der unterschätzteste Hit des Jahres sein',                    requires: ['SERIE'],                  ctrBoost: 12 },

  // ══════════════════════════════════════════════════════════════════
  // NOSTALGIA / TV LEGENDS (21–40) — career origins, legacy actors,
  // classic TV, NCIS/CSI/Magnum-style long-runners. Curiosity + recognition.
  // All require STAR (the legend is the primary subject).
  // ══════════════════════════════════════════════════════════════════
  // Career Beginnings
  { id: 'nost_01', angle: 'nostalgia',   template: 'Er rief einfach an – Jahre später wurde {STAR} TV-Legende',                  requires: ['STAR'],                    ctrBoost: 13 },
  { id: 'nost_02', angle: 'nostalgia',   template: 'Ohne Kontakte gestartet – später wurde {STAR} zum Gesicht von {SERIE}',      requires: ['STAR','SERIE'],            ctrBoost: 12 },
  { id: 'nost_03', angle: 'nostalgia',   template: 'Ein mutiger Schritt änderte alles für {STAR}',                               requires: ['STAR'],                    ctrBoost: 11 },
  { id: 'nost_04', angle: 'nostalgia',   template: 'So begann die Karriere von {STAR} lange vor {SERIE}',                        requires: ['STAR','SERIE'],            ctrBoost: 12 },

  // Legend Status
  { id: 'nost_05', angle: 'nostalgia',   template: 'Heute kennt ihn jeder – damals begann alles ganz klein',                     requires: ['STAR'],                    ctrBoost: 10 },
  { id: 'nost_06', angle: 'nostalgia',   template: '{STAR} prägte {SERIE} über Jahre wie kaum ein anderer',                      requires: ['STAR','SERIE'],            ctrBoost: 12 },
  { id: 'nost_07', angle: 'nostalgia',   template: 'Kaum zu glauben, wie lange {STAR} schon TV-Geschichte schreibt',             requires: ['STAR'],                    ctrBoost: 11 },
  { id: 'nost_08', angle: 'nostalgia',   template: '{STAR} wurde mit {SERIE} zur Ausnahmeerscheinung',                           requires: ['STAR','SERIE'],            ctrBoost: 10 },

  // Forgotten Past
  { id: 'nost_09', angle: 'nostalgia',   template: 'Viele kennen {STAR} nur aus {SERIE} – dabei begann alles ganz anders',        requires: ['STAR','SERIE'],            ctrBoost: 13 },
  { id: 'nost_10', angle: 'nostalgia',   template: 'Vor {SERIE}: So sah die Karriere von {STAR} wirklich aus',                   requires: ['STAR','SERIE'],            ctrBoost: 12 },
  { id: 'nost_11', angle: 'nostalgia',   template: 'Was viele über {STAR} bis heute nicht wissen',                               requires: ['STAR'],                    ctrBoost: 11 },
  { id: 'nost_12', angle: 'nostalgia',   template: 'Lange vor {SERIE} fiel {STAR} bereits auf',                                  requires: ['STAR','SERIE'],            ctrBoost: 11 },

  // Surprise / Unexpected
  { id: 'nost_13', angle: 'nostalgia',   template: 'Kaum jemand ahnte damals, was aus {STAR} werden würde',                      requires: ['STAR'],                    ctrBoost: 12 },
  { id: 'nost_14', angle: 'nostalgia',   template: 'Niemand rechnete damit – später wurde {STAR} Kult',                          requires: ['STAR'],                    ctrBoost: 12 },
  { id: 'nost_15', angle: 'nostalgia',   template: 'Ein einfacher Moment machte {STAR} später berühmt',                          requires: ['STAR'],                    ctrBoost: 11 },
  { id: 'nost_16', angle: 'nostalgia',   template: 'Ausgerechnet so begann die Karriere von {STAR}',                             requires: ['STAR'],                    ctrBoost: 10 },

  // Series Legacy
  { id: 'nost_17', angle: 'nostalgia',   template: '{SERIE} verdankt {STAR} mehr, als viele denken',                             requires: ['STAR','SERIE'],            ctrBoost: 12 },
  { id: 'nost_18', angle: 'nostalgia',   template: 'Ohne {STAR} wäre {SERIE} nie dasselbe geworden',                             requires: ['STAR','SERIE'],            ctrBoost: 12 },
  { id: 'nost_19', angle: 'nostalgia',   template: 'Über Jahre geprägt: Warum {STAR} für {SERIE} so wichtig war',                requires: ['STAR','SERIE'],            ctrBoost: 11 },
  { id: 'nost_20', angle: 'nostalgia',   template: '{STAR} machte {SERIE} für Millionen unvergesslich',                          requires: ['STAR','SERIE'],            ctrBoost: 12 },
];

// ══════════════════════════════════════════════════════════════════════
// ANGLE METADATA — labels & cue-phrases for classifier & prompt
// ══════════════════════════════════════════════════════════════════════
export const ANGLE_META: Record<HeadlineAngle, { label: string; cues: string[] }> = {
  success:         { label: 'Success / Dominance',      cues: ['top 10','viewership','millionen','rekord','streaming-hit','dominates','chart','weeks at #1','long-running hit'] },
  comeback:        { label: 'Surprise / Comeback',      cues: ['returns','comeback','revival','renewed','unexpected return','surprise drop','after years'] },
  season_update:   { label: 'Release / New Season',     cues: ['season','staffel','release date','premieres','renewed for','filming','wrap','teaser','trailer'] },
  quality_praise:  { label: 'Quality / Praise',         cues: ['critics','acclaimed','rotten tomatoes','metacritic','reviews','100%','perfect score','resonates','masterpiece'] },
  star_power:      { label: 'Star Power',               cues: ['star','actor','actress','returns as','cast','lead','interview','reveals','opens up'] },
  underrated:      { label: 'Underrated / Hidden Gem',  cues: ['overlooked','hidden gem','underrated','sleeper hit','flying under the radar','deserves more'] },
  controversy:     { label: 'Controversy',              cues: ['divisive','polarising','backlash','controversy','split fans','mixed reviews','drama off-set'] },
  trend_momentum:  { label: 'Trend / Momentum',         cues: ['going viral','trending','buzz','everyone is talking','tiktok','word of mouth'] },
  nostalgia:       { label: 'Nostalgia / TV Legend',    cues: ['decades','legendary','legend','icon','iconic','veteran','pioneer','long-running','anniversary','milestone','debuted','before becoming famous','early career','first role','big break','back in','call(ed) the producer','rang','phoned','got his start','got her start','at the time','years ago','throwback','classic tv'] },
};

// ══════════════════════════════════════════════════════════════════════
// ANGLE CLASSIFIER — lightweight heuristic (zero-LLM fallback)
// ══════════════════════════════════════════════════════════════════════
/**
 * Heuristic angle detection from source title + content. Runs locally (no
 * LLM). Used as a HINT for the prompt — the LLM still has the final say
 * via its own classification in the structured output.
 */
export function detectAngle(title: string, content: string = ''): HeadlineAngle {
  const text = `${title} ${content.substring(0, 2000)}`.toLowerCase();
  const scores: Record<HeadlineAngle, number> = {
    success: 0, comeback: 0, season_update: 0, quality_praise: 0,
    star_power: 0, underrated: 0, controversy: 0, trend_momentum: 0, nostalgia: 0,
  };
  for (const [angle, meta] of Object.entries(ANGLE_META) as Array<[HeadlineAngle, typeof ANGLE_META[HeadlineAngle]]>) {
    for (const cue of meta.cues) {
      if (text.includes(cue.toLowerCase())) scores[angle] += 1;
    }
  }
  // Strong primary hints override ties
  if (/\b(returns?|revival|comeback|brought back)\b/i.test(text)) scores.comeback += 2;
  if (/\b(season|staffel)\s*\d+/i.test(text))                      scores.season_update += 2;
  if (/\b(\d{1,3}\s?%|rotten tomatoes|metacritic)\b/i.test(text))   scores.quality_praise += 2;
  if (/\b(top\s*\d+|#\d+|most-watched|viewership|millionen)\b/i.test(text)) scores.success += 2;
  if (/\b(overlooked|hidden\s*gem|underrated|sleeper)\b/i.test(text)) scores.underrated += 3;
  if (/\b(controvers|backlash|polaris|split|divisive)\b/i.test(text)) scores.controversy += 3;

  // Nostalgia / TV-Legend triggers — MOST SPECIFIC, apply strongly
  if (/\b(call(?:ed)?|rang|phoned|dialled)\b.{0,60}\b(producer|director|showrunner|casting|boss|executive|network|creator)\b/i.test(text)) scores.nostalgia += 6;
  if (/\bbefore\s+(becoming|he\s+was|she\s+was|fame)\b/i.test(text)) scores.nostalgia += 4;
  if (/\b(early\s+(career|role|days)|first\s+(role|big\s+break|break)|got\s+his\s+start|got\s+her\s+start)\b/i.test(text)) scores.nostalgia += 5;
  if (/\b(legend(?:ary)?|icon(?:ic)?|veteran|pioneer|trailblazer)\b/i.test(text)) scores.nostalgia += 3;
  if (/\b(decades?|jahrzehnte?|for\s+\d{2}\s+years|über\s+\d{2}\s+jahre)\b/i.test(text)) scores.nostalgia += 3;
  if (/\b(anniversar|milestone|throwback|classic\s+tv|old\s+interview)\b/i.test(text)) scores.nostalgia += 3;
  if (/\bback\s+in\s+(19|20)\d{2}s?\b/i.test(text)) scores.nostalgia += 4;
  if (/\b(long-running|lang(?:jährig|e\s+jahre)|seit\s+(?:jahren|jahrzehnten))\b/i.test(text)) scores.nostalgia += 2;

  const best = (Object.entries(scores) as Array<[HeadlineAngle, number]>)
    .sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : 'success';
}

// ══════════════════════════════════════════════════════════════════════
// PROMPT BUILDERS — format patterns for LLM system prompt
// ══════════════════════════════════════════════════════════════════════
interface PatternVars {
  serie: string;
  star?: string;
  plattform?: string;
  staffel?: string | number;
}

function fillTemplate(template: string, vars: PatternVars): string {
  return template
    .replace(/\{SERIE\}/g, vars.serie)
    .replace(/\{STAR\}/g, vars.star || 'der Hauptdarsteller')
    .replace(/\{PLATTFORM\}/g, vars.plattform || 'dem Streamer')
    .replace(/\{STAFFEL\}/g, String(vars.staffel ?? 'X'));
}

/**
 * Returns patterns focused on the primary angle + 2–3 supporting patterns
 * from adjacent angles. Filters out patterns whose required slots cannot
 * be filled from the given variables.
 */
export function getPatternsForAngle(
  primary: HeadlineAngle,
  vars: PatternVars,
  opts: { includeAdjacent?: boolean } = {},
): Array<{ angle: HeadlineAngle; example: string }> {
  const canFill = (p: DiscoverPattern) =>
    p.requires.every((r) => {
      if (r === 'SERIE')     return !!vars.serie;
      if (r === 'STAR')      return !!vars.star;
      if (r === 'PLATTFORM') return !!vars.plattform;
      if (r === 'STAFFEL')   return vars.staffel !== undefined && vars.staffel !== null && vars.staffel !== '';
      return true;
    });

  // Adjacency map — patterns from closely-related angles still fit
  const adjacency: Record<HeadlineAngle, HeadlineAngle[]> = {
    success:         ['trend_momentum', 'quality_praise'],
    comeback:        ['trend_momentum', 'season_update'],
    season_update:   ['comeback', 'trend_momentum'],
    quality_praise:  ['success', 'underrated'],
    star_power:      ['trend_momentum', 'quality_praise', 'nostalgia'],
    underrated:      ['quality_praise', 'trend_momentum'],
    controversy:     ['trend_momentum', 'star_power'],
    trend_momentum:  ['success', 'comeback'],
    nostalgia:       ['star_power', 'underrated'],
  };

  const primaryPatterns = DISCOVER_PATTERNS.filter(p => p.angle === primary && canFill(p));
  let out = primaryPatterns.map(p => ({ angle: p.angle, example: fillTemplate(p.template, vars) }));

  if (opts.includeAdjacent !== false) {
    const adj = adjacency[primary] || [];
    for (const a of adj) {
      const extra = DISCOVER_PATTERNS
        .filter(p => p.angle === a && canFill(p))
        .slice(0, 2)
        .map(p => ({ angle: p.angle, example: fillTemplate(p.template, vars) }));
      out = out.concat(extra);
    }
  }
  return out;
}

/**
 * Returns ALL 20 patterns formatted by angle — useful as a broader library
 * block in prompts when angle confidence is low.
 */
export function getAllPatternsByAngle(vars: PatternVars): Record<HeadlineAngle, string[]> {
  const out = Object.fromEntries(
    (Object.keys(ANGLE_META) as HeadlineAngle[]).map(a => [a, [] as string[]])
  ) as Record<HeadlineAngle, string[]>;
  for (const p of DISCOVER_PATTERNS) {
    out[p.angle].push(fillTemplate(p.template, vars));
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════════
// HARD-RULE OVERUSE DETECTION — used by cooldown in headline-engine
// ══════════════════════════════════════════════════════════════════════
/**
 * Phrases the editor has flagged as overused / robotic. The engine uses
 * DB history to decide how many of these may still be used today.
 */
export const OVERUSED_PHRASES: Array<{ rx: RegExp; label: string }> = [
  { rx: /\boffiziell[\s:!]/i,        label: 'Offiziell' },
  { rx: /\bendlich\b/i,               label: 'endlich' },
  { rx: /\bdoch\s+noch\b/i,           label: 'doch noch' },
  { rx: /\bpl(ö|oe)tzlich\b/i,        label: 'plötzlich' },
  { rx: /\bausgerechnet\b/i,          label: 'ausgerechnet' },
  { rx: /\bjetzt\s+best(ä|ae)tigt\b/i,label: 'Jetzt bestätigt' },
  { rx: /\berst\b.{1,25},\s*jetzt\b/i,label: 'Erst X, jetzt Y' },
];

/** Count how many OVERUSED_PHRASES occur in a headline. */
export function countOverusedPhrases(headline: string): string[] {
  return OVERUSED_PHRASES.filter(p => p.rx.test(headline)).map(p => p.label);
}

// ══════════════════════════════════════════════════════════════════════
// BACKWARDS-COMPATIBLE EXPORTS (v1) — kept so legacy consumers (lib/
// headline-scorer.ts, existing tests) keep compiling without changes.
// ══════════════════════════════════════════════════════════════════════
export interface HeadlinePattern {
  id: string;
  category: 'surprise' | 'twist' | 'curiosity' | 'conflict' | 'impact' | 'reaction';
  template: string;
  variables: string[];
  ctrBoost: number;
}

// Map new angles to v1 legacy categories so downstream code keeps working.
const ANGLE_TO_V1: Record<HeadlineAngle, HeadlinePattern['category']> = {
  success:         'impact',
  comeback:        'surprise',
  season_update:   'impact',
  quality_praise:  'reaction',
  star_power:      'reaction',
  underrated:      'curiosity',
  controversy:     'conflict',
  trend_momentum:  'surprise',
  nostalgia:       'curiosity',
};

export const HEADLINE_PATTERNS: HeadlinePattern[] = DISCOVER_PATTERNS.map(p => ({
  id: p.id,
  category: ANGLE_TO_V1[p.angle],
  template: p.template.replace(/\{SERIE\}/g, '{Serie}'),
  variables: ['Serie', ...p.requires.filter(r => r !== 'SERIE').map(r => r.toLowerCase())],
  ctrBoost: p.ctrBoost,
}));

export function getPatternsByCategory(): Record<string, HeadlinePattern[]> {
  const grouped: Record<string, HeadlinePattern[]> = {};
  for (const p of HEADLINE_PATTERNS) {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  }
  return grouped;
}

/**
 * LEGACY prompt helper — used by headline-engine.ts until it migrates to
 * the new angle-aware API. Returns all 20 patterns, grouped by angle, with
 * {SERIE} already substituted.
 */
export function getPatternsForPrompt(seriesName: string): string {
  const lines: string[] = [];
  const grouped = getAllPatternsByAngle({ serie: seriesName, plattform: 'dem Streamer', star: 'der Star', staffel: 'X' });
  for (const angle of Object.keys(grouped) as HeadlineAngle[]) {
    lines.push(`\n${ANGLE_META[angle].label}:`);
    for (const ex of grouped[angle]) lines.push(`  - "${ex}"`);
  }
  return lines.join('\n');
}

/**
 * Legacy matcher — returns a ctrBoost based on classic trigger phrases.
 * Used by headline-scorer.ts (v4, currently unused).
 */
export function matchPattern(headline: string): { matched: boolean; patternId: string | null; ctrBoost: number } {
  const lower = headline.toLowerCase();
  const boosters: Array<[RegExp, number]> = [
    [/h(ö|oe)rt einfach nicht auf/, 6],
    [/monate sp(ä|ae)ter/, 5],
    [/k(ö|oe)nnte fr(ü|ue)her zur(ü|ue)ckkehren/, 5],
    [/kaum jemand sah das kommen/, 7],
    [/kritiker feiern/, 4],
    [/trifft.{0,8}den nerv/, 5],
    [/(ü|ue)bersehen.*(immer|noch)/, 5],
    [/unterschätzteste|unterschaetzteste/, 6],
    [/reden (jetzt )?wieder alle/, 5],
    [/ausgerechnet/, 3],
    [/verdichten sich/, 4],
    // Nostalgia fingerprints
    [/rief einfach an/, 7],
    [/ohne kontakte gestartet/, 6],
    [/tv-legende|tv legende/, 5],
    [/kaum jemand ahnte/, 6],
    [/prägte.{0,20}(über jahre|seit jahrzehnten)/, 6],
    [/dabei begann alles/, 5],
    [/lange vor\b/, 4],
    [/niemand rechnete damit.{0,20}(sp(ä|ae)ter|kult)/, 6],
    [/verdankt.{0,20}mehr,? als viele/, 6],
    [/ohne .{2,30} w(ä|ae)re .{2,30} nie dasselbe/, 6],
    [/für millionen unvergesslich/, 6],
  ];
  let boost = 0;
  for (const [rx, b] of boosters) if (rx.test(lower)) boost += b;
  boost = Math.min(15, boost);
  return { matched: boost > 0, patternId: null, ctrBoost: boost };
}
