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

export const HEADLINE_SCORER_VERSION = 'v5.3';

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

// --- DISCOVER RESONANCE (v5.1) ---
// Natural, editorial, curiosity-driven phrasing characteristic of the
// 20 Discover patterns. Rewards headlines that feel like a human chef-vom-
// dienst wrote them instead of a formula engine.
const DISCOVER_MOMENTUM_WORDS = [
  // Staying-power / success-language
  'hört einfach nicht auf', 'hört nicht auf', 'bleibt ganz vorne', 'bleibt oben',
  'bleibt größer', 'monate später', 'selbst jetzt', 'auch jetzt',
  'schlägt weiter', 'dominiert', 'überflügelt', 'lässt hinter sich',
  'gehört zu den größten', 'noch immer', 'weiter besser', 'ganz oben',
  // Resonance / quality-praise
  'trifft.{0,8}den nerv', 'überzeugt.{0,20}(skeptiker|viele|zuschauer)',
  'kritiker feiern', 'kommt.{0,10}so (gut|stark) an', 'so stark ankommt',
  'und das hat gründe', 'so viele überzeugt', 'gerade so stark',
  // Momentum / talk-of-the-town
  'reden.{0,10}wieder', 'gesprächsstoff', 'sorgt wieder', 'wieder da',
  'meldet sich zurück', 'kaum jemand sah', 'niemand rechnete',
  // Season / waiting
  'rückt näher', 'verdichten sich.{0,10}zeichen', 'früher zurückkehren',
  'neue hinweise', 'für fans wird es',
  // Underrated / hidden gem
  'viele übersehen', 'unterschätzt', 'dabei läuft es', 'der unterschätzteste',
  'hit des jahres', 'geheimtipp',
  // Star power (non-hyped)
  'macht.{0,10}noch interessanter', 'wegen.{0,15}reden',
  // Nostalgia / TV legends — recognition + curiosity
  'tv-legende', 'tv legende', 'rief einfach an', 'ohne kontakte',
  'kaum jemand ahnte', 'tv-geschichte schreibt', 'tv geschichte schreibt',
  'prägte.{0,30}über jahre', 'dabei begann alles', 'lange vor',
  'niemand rechnete damit', 'wurde.{0,15}kult', 'ausgerechnet so begann',
  'verdankt.{0,15}mehr', 'wäre.{0,15}nie dasselbe', 'wuerde nie dasselbe',
  'für millionen unvergesslich', 'damals begann alles',
  'ausnahmeerscheinung', 'jahrzehnte(?:lang)?',
];

const DISCOVER_EDITORIAL_STARTS = [
  /^warum\s/i,                // "Warum X gerade so..."
  /^monate später:/i,          // "Monate später: ..."
  /^selbst\s/i,                // "Selbst Skeptiker..."
  /^niemand\s/i,               // "Niemand rechnete..."
  /^kaum jemand\s/i,           // "Kaum jemand sah..."
  /^kritiker\s/i,              // "Kritiker feiern..."
  /^für fans\s/i,              // "Für Fans wird es..."
  /^viele übersehen\s/i,       // "Viele übersehen..."
  /^heute kennt\s/i,           // "Heute kennt ihn jeder..."
  /^ohne\s/i,                  // "Ohne Kontakte...", "Ohne X wäre..."
  /^lange vor\s/i,             // "Lange vor X fiel..."
  /^vor\s+\S+:/i,              // "Vor NCIS: So sah..."
  /^was viele\s/i,             // "Was viele über X nicht wissen"
  /^er rief\s/i,               // "Er rief einfach an..."
  /^so begann\s/i,             // "So begann die Karriere..."
  /^ein (mutiger|einfacher)\s/i,// "Ein mutiger Schritt..."
  /^ausgerechnet so\s/i,       // "Ausgerechnet so begann..."
  /^über jahre geprägt:/i,     // "Über Jahre geprägt: Warum..."
];

function computeDiscoverResonance(headline: string): number {
  const lower = headline.toLowerCase();
  let score = 0;

  // Phrase matches (each +3, capped)
  let phraseHits = 0;
  for (const phrase of DISCOVER_MOMENTUM_WORDS) {
    const rx = phrase.includes('.') ? new RegExp(phrase, 'i') : null;
    if (rx ? rx.test(lower) : lower.includes(phrase)) phraseHits++;
  }
  score += Math.min(12, phraseHits * 3);

  // Editorial opener bonus (+4)
  if (DISCOVER_EDITORIAL_STARTS.some(rx => rx.test(headline))) score += 4;

  // Em-dash / middle-pause — hallmark of editorial Discover writing (+2)
  if (/\s[–—]\s/.test(headline) && phraseHits >= 1) score += 2;

  return Math.max(0, Math.min(16, score));
}

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
  // --- SCORE-REVEAL KILLERS (Rotten Tomatoes / Metacritic / IMDb) ---
  // Fatal for Discover: reveals the full payoff in the headline and leaves
  // no reason to click. Score numbers belong in the lead, never the title.
  { phrase: 'rotten tomatoes', penalty: -22 },
  { phrase: 'metacritic', penalty: -22 },
  { phrase: 'imdb-score', penalty: -20 },
  { phrase: 'imdb-wertung', penalty: -20 },
  { phrase: 'imdb rating', penalty: -18 },
  { phrase: 'kritiker-score', penalty: -18 },
  { phrase: 'kritikerwertung von', penalty: -15 },
  { phrase: 'triumphiert mit', penalty: -15 }, // co-occurs with score reveals
  { phrase: 'punkten bei', penalty: -15 },     // "mit X Punkten bei ..."
  // --- v5.3 AI-SLOP HYPERBOLE / FORMULA KILLERS ---
  // Catches the two most common Claude/GPT failure modes for German Discover:
  //   a) "X verändert alles" / "ändert alles"  (empty hyperbole)
  //   b) "X enthüllt, warum Y"                  (pure LLM formula reveal)
  { phrase: 'verändert alles', penalty: -25 },
  { phrase: 'veraendert alles', penalty: -25 },
  { phrase: 'ändert alles', penalty: -22 },
  { phrase: 'aendert alles', penalty: -22 },
  { phrase: 'stellt alles auf den kopf', penalty: -22 },
  { phrase: 'alles wird anders', penalty: -18 },
  { phrase: 'alles kippt', penalty: -18 },
  { phrase: 'alles auf den prüfstand', penalty: -15 },
  { phrase: 'alles auf den pruefstand', penalty: -15 },
];

// --- v5.4 OPINION-TONE KILLERS (separat gated via HEADLINE_OPINION_KILLER env) ---
// Wir sind eine News-Site, keine Kolumne. Phase-A Stop-Loss: standardmäßig AUS,
// damit der Pool nicht weiter ausgehungert wird. Aktivierung über
// HEADLINE_OPINION_KILLER=true sobald GSC-CTR-Daten zeigen, dass es hilft.
const OPINION_TONE_KILLERS: Array<{ phrase: string; penalty: number }> = [
  // a) Erste Person Singular/Plural — sofortiger Kolumnen-Sound.
  { phrase: 'meiner meinung', penalty: -30 },
  { phrase: 'meine meinung', penalty: -30 },
  { phrase: 'aus meiner sicht', penalty: -30 },
  { phrase: 'wie ich finde', penalty: -25 },
  { phrase: 'ich finde', penalty: -22 },
  { phrase: 'ich liebe', penalty: -22 },
  { phrase: 'ich hasse', penalty: -22 },
  // b) Editorialising-Auftakt (Beifall, Klage, Erleichterung).
  { phrase: 'endlich ', penalty: -20 },          // "Endlich startet ..."
  { phrase: 'zum glück', penalty: -20 },
  { phrase: 'glücklicherweise', penalty: -18 },
  { phrase: 'gluecklicherweise', penalty: -18 },
  { phrase: 'leider ', penalty: -15 },
  { phrase: 'traurigerweise', penalty: -18 },
  { phrase: 'ein hoch auf', penalty: -25 },
  { phrase: 'bitte mehr', penalty: -22 },
  { phrase: 'bravo', penalty: -25 },
  { phrase: 'huldigung', penalty: -25 },
  // c) Direkte Leser-Anrede / Imperativ — passt nicht zu News-Stil.
  { phrase: 'solltest du', penalty: -22 },
  { phrase: 'solltet ihr', penalty: -22 },
  { phrase: 'darfst du nicht', penalty: -22 },
  { phrase: 'müsst ihr sehen', penalty: -22 },
  { phrase: 'muesst ihr sehen', penalty: -22 },
  { phrase: 'müssen sie sehen', penalty: -22 },
  // d) Empfehlungs-/Verdikt-Phrasen — Autoren-Urteil.
  { phrase: 'muss man gesehen haben', penalty: -25 },
  { phrase: 'gehört zu den besten', penalty: -25 },
  { phrase: 'gehoert zu den besten', penalty: -25 },
  { phrase: 'ein muss für', penalty: -22 },
  { phrase: 'ein muss fuer', penalty: -22 },
  { phrase: 'pflichtprogramm', penalty: -22 },
  { phrase: 'pflicht-serie', penalty: -22 },
  { phrase: 'pflichtserie', penalty: -22 },
  { phrase: 'kein geheimtipp mehr', penalty: -18 },
  { phrase: 'unbedingt sehen', penalty: -22 },
  { phrase: 'unbedingt schauen', penalty: -22 },
  { phrase: 'unbedingt streamen', penalty: -22 },
  { phrase: 'unbedingt gucken', penalty: -22 },
  { phrase: 'nicht verpassen', penalty: -18 },
  { phrase: 'überzeugt mich', penalty: -22 },
  { phrase: 'ueberzeugt mich', penalty: -22 },
  { phrase: 'beeindruckt mich', penalty: -22 },
  { phrase: 'verzaubert mich', penalty: -22 },
  // e) Superlativ-Verdikt ohne Quelle.
  { phrase: 'beste serie aller zeiten', penalty: -25 },
  { phrase: 'beste comedy aller zeiten', penalty: -25 },
  { phrase: 'genialste serie', penalty: -22 },
  { phrase: 'perfekteste', penalty: -25 },
  { phrase: 'unterschätzteste', penalty: -22 },
  { phrase: 'unterschaetzteste', penalty: -22 },
  { phrase: 'überschätzteste', penalty: -22 },
  { phrase: 'ueberschaetzteste', penalty: -22 },
];

const OPINION_KILLER_ENABLED = process.env.HEADLINE_OPINION_KILLER === 'true';

/** Effektive Hard-Killer-Liste — inkludiert Opinion-Killer nur wenn Toggle an ist. */
function effectiveHardKillers(): Array<{ phrase: string; penalty: number }> {
  return OPINION_KILLER_ENABLED ? [...HARD_KILLERS, ...OPINION_TONE_KILLERS] : HARD_KILLERS;
}

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

  for (const k of effectiveHardKillers()) {
    if (lower.includes(k.phrase)) {
      hits.push({ type: 'hard_killer', phrase: k.phrase, value: k.penalty });
    }
  }

  // German grammar incompleteness — fatal because broken sentences confuse readers and damage trust.
  // Pattern A: Reflexive verb followed by clause break ("sichert sich, warum…", "lässt sich, ob…")
  //            → reflexive verb is missing its object/predicate.
  const REFLEXIVE_BROKEN = /\b(sichert|lässt|stellt|fragt|fühlt|gibt|wendet|nimmt|fügt|hält|setzt)\s+sich\s*[,–—]/i;
  if (REFLEXIVE_BROKEN.test(headline)) {
    hits.push({ type: 'hard_killer', phrase: 'grammar:reflexive_no_object', value: -25 });
  }

  // Pattern B: Transitive verb at very end of headline without object.
  //            "warum X verändert" / "wie das alles bricht" — verb wants an object that's missing.
  const TRANSITIVE_DANGLING = /\b(verändert|verlässt|bricht|kippt|zerstört|verliert|beendet|rettet|zwingt|verrät|ändert|stoppt|hält|verbietet|ergreift|schickt)\.?\s*$/i;
  if (TRANSITIVE_DANGLING.test(headline.trim())) {
    // Allow only when the verb has a clear object earlier in the same clause.
    const lastClause = headline.split(/[,–—]/).pop() || '';
    const hasObjectMarker = /\b(den|die|das|dem|einen|eine|einem|seinen|ihre|alle|alles|nichts)\b/i.test(lastClause);
    if (!hasObjectMarker) {
      hits.push({ type: 'hard_killer', phrase: 'grammar:transitive_no_object', value: -25 });
    }
  }

  // Pattern C: "warum/wie/weshalb …" sub-clause without explicit subject — common AI failure mode.
  //            "Chad Powers sichert sich, warum das Waldrons Comeback verändert" — second clause's
  //            "verändert" has no subject anchor and "warum" implies a question that's never answered.
  const ORPHAN_WHY = /[,–—]\s*(warum|wie|weshalb)\s+das\s+\w+\s+\w+\s*$/i;
  if (ORPHAN_WHY.test(headline.trim())) {
    hits.push({ type: 'hard_killer', phrase: 'grammar:orphan_why_clause', value: -20 });
  }

  // Numeric score-reveal patterns — fatal for Discover (full payoff in title).
  // Matches: "100 %", "98%", "100 Prozent", "9,2/10", "9.2/10", "Score: 95"
  const SCORE_PATTERNS: Array<{ re: RegExp; phrase: string }> = [
    { re: /\b\d{1,3}\s*%/, phrase: '<score>%' },
    { re: /\b\d{1,3}\s*prozent/i, phrase: '<score> Prozent' },
    { re: /\b\d{1,2}[,.]\d\/10\b/, phrase: '<x>/10' },
    { re: /\bscore[\s:]+\d/i, phrase: 'score: <n>' },
  ];
  for (const p of SCORE_PATTERNS) {
    if (p.re.test(headline)) {
      hits.push({ type: 'hard_killer', phrase: `score_reveal:${p.phrase}`, value: -20 });
      break; // one pattern is enough — don't stack the penalty
    }
  }

  // v5.3 AI-FORMULA: "X enthüllt|verrät|zeigt|erklärt|offenbart|verkündet, warum|wie|weshalb|was Y"
  // Single most common LLM tell in German feature-news headlines. Comma right after
  // the reveal verb is the giveaway. Also catch the no-comma variant for safety.
  const FORMULA_REVEAL_COMMA = /\b(enth[üu]llt|verr[äa]t|verraet|zeigt|erkl[äa]rt|verk[üu]ndet|offenbart|beweist|best[äa]tigt|bestätigt)\s*,\s*(warum|wieso|weshalb|wie|was|woran|wann|wo)\b/i;
  if (FORMULA_REVEAL_COMMA.test(headline)) {
    hits.push({ type: 'hard_killer', phrase: 'ai_formula:reveal_comma_why', value: -22 });
  } else {
    const FORMULA_REVEAL_TIGHT = /\b(enth[üu]llt|verr[äa]t|zeigt|erkl[äa]rt|offenbart)\s+(warum|wieso|weshalb|wie\s+(genau|wirklich)|was\s+(wirklich|genau))\b/i;
    if (FORMULA_REVEAL_TIGHT.test(headline)) {
      hits.push({ type: 'hard_killer', phrase: 'ai_formula:reveal_tight_why', value: -18 });
    }
  }

  // v5.3 AI-FORMULA #2: ", und {X} verändert/ändert alles" / "und Staffel X verändert alles"
  // Caught above by the phrase list, but add a regex variant that catches obfuscation:
  // "verändert alles", "ändert alles" anywhere; AND the "Staffel N + verändert" co-occurrence.
  const STAFFEL_VERAENDERT = /\b(staffel|serie|season)\s*\d*\s+(ver[äa]ndert|[äa]ndert)\s+(alles|das spiel)\b/i;
  if (STAFFEL_VERAENDERT.test(headline)) {
    hits.push({ type: 'hard_killer', phrase: 'ai_formula:staffel_veraendert_alles', value: -25 });
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
    if (SOFT_KILLERS.some(k => pLower.includes(k.phrase)) || effectiveHardKillers().some(k => pLower.includes(k.phrase))) {
      peerGenericCount++;
    }

    // Same start
    if (pLower.startsWith(myStart)) peerStartsSame++;
  }

  let bonus = 0;

  // This headline is NOT generic while peers are → outlier bonus
  const myIsGeneric = SOFT_KILLERS.some(k => lower.includes(k.phrase)) || effectiveHardKillers().some(k => lower.includes(k.phrase));
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
  const hasHardKiller = effectiveHardKillers().some(k => afterColon.includes(k.phrase));
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
  if (effectiveHardKillers().some(k => lower.includes(k.phrase))) ctr -= 8;
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
  const discoverResonance = computeDiscoverResonance(headline);

  // --- PENALTIES ---
  // FIX 2: Hard vs Soft strikt getrennt
  const hardKillerHits = detectHardKillers(headline);
  penalties.push(...hardKillerHits);
  let totalHardPenalty = hardKillerHits.reduce((s, h) => s + h.value, 0);
  totalHardPenalty = Math.max(-20, totalHardPenalty);

  const softKillerHits = detectSoftKillers(headline);
  // v5.1: "könnte" is legitimate in Discover "könnte der unterschätzteste Hit" patterns;
  // drop that penalty when the headline shows editorial resonance markers.
  const filteredSoftKillers = discoverResonance >= 6
    ? softKillerHits.filter(h => !['könnte', 'möglicherweise', 'eventuell'].includes(h.phrase))
    : softKillerHits;
  penalties.push(...filteredSoftKillers);
  let totalSoftPenalty = filteredSoftKillers.reduce((s, h) => s + h.value, 0);
  totalSoftPenalty = Math.max(-12, totalSoftPenalty);

  // Series: handling
  const seriesHandling = seriesStartHandling(headline, seriesName);
  if (seriesHandling.penalty < 0) {
    penalties.push({ type: 'series_start', phrase: `${seriesName}: ...`, value: seriesHandling.penalty });
  }

  // Length penalty
  const charCount = headline.length;
  let lengthPenalty = 0;
  if (charCount > 100) { lengthPenalty = -5; penalties.push({ type: 'length', phrase: `${charCount}z > 100`, value: -5 }); }
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

  // v5.1 Discover Resonance Boost — rewards natural/editorial Discover phrasing
  let discoverBoost = 0;
  if (discoverResonance >= 3) {
    discoverBoost = discoverResonance; // 0–12
    boosts.push({ type: 'discover_resonance', reason: 'Natürliche Discover-Sprache', value: discoverResonance });
  }

  // Relative outlier
  const relativeOutlierBonus = computeRelativeOutlierBonus(headline, peerHeadlines || null, articleContext);
  if (relativeOutlierBonus > 0) {
    boosts.push({ type: 'relative_outlier', reason: 'Stärker als Peer-Durchschnitt', value: relativeOutlierBonus });
  }

  // v5.2 Platform-First Rule:
  // Do not place a platform/network FIRST unless it has mainstream consumer pull
  // in Germany. Mainstream whitelist: Netflix, Prime Video, Disney+, HBO, Apple TV+.
  // For niche/regional platforms (Paramount+, Peacock, WOW, Sky, Hulu, Max, ARD, ZDF…)
  // the series title must come first → strong −15 penalty on first-position placement.
  const platformFirstPenalty = computePlatformFirstPenalty(headline);
  if (platformFirstPenalty < 0) {
    penalties.push({ type: 'platform_first', phrase: 'nicht-mainstream Plattform vorne', value: platformFirstPenalty });
  }

  // --- RAW SCORE ---
  const totalPenalties = totalHardPenalty + totalSoftPenalty + seriesHandling.penalty + lengthPenalty + dupePenalty + platformFirstPenalty;

  let rawScore = hookStrength + topicClarity + specificity + riskConflict +
    contrastPattern + ctrPrediction + relativeOutlierBonus +
    premiumBoost + comboBonus + hqBonus + discoverBoost + totalPenalties;

  rawScore = Math.max(0, rawScore);
  const rawScoreBeforeCeiling = rawScore;

  // --- CEILING (FIX 3: erst ganz am Ende) ---
  const { score: cappedScore, ceiling } = applyScoreCeiling(rawScore, topicClarity, specificity);
  const finalScore = Math.max(0, Math.min(100, cappedScore));

  // --- MINIMUM ---
  // v5.1: 50 statt 55 — Discover-Headlines sind weicher formuliert
  // (kein Shock-Vokabular), erreichen aber trotzdem hohe CTR.
  const passedMinimum = finalScore >= 50;
  const isReserve = finalScore >= 50 && finalScore < 62;
  const isStrongCandidate = finalScore >= 68;

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
// PLATFORM-FIRST RULE (v5.2)
// ============================================================
// Regel: Plattform darf NUR vor dem Serientitel stehen, wenn die Plattform
// in Deutschland Mainstream-Consumer-Pull hat. Ansonsten muss der Serientitel
// zuerst kommen (bessere Wiedererkennbarkeit, Google Discover bevorzugt Brand-First).
//
// ALLOWED PLATFORM-FIRST (≥ 4 Mio DE-Abos oder starker Brand-Recall):
//   Netflix, Prime Video, Amazon Prime, Disney+, HBO, HBO Max, Max, Apple TV+
// NOT ALLOWED as first word (niche/regional — penalize):
//   Paramount+, Peacock, Hulu, WOW, Sky, ARD, ZDF, RTL+, Arte, ProSieben, ZDFneo …

const MAINSTREAM_PLATFORMS_DE = [
  'netflix',
  'prime video', 'amazon prime', 'amazon',
  'disney+', 'disney plus',
  'hbo', 'hbo max', 'max',
  'apple tv+', 'apple tv', 'appletv',
];

const NICHE_PLATFORMS_DE = [
  'paramount+', 'paramount plus',
  'peacock',
  'hulu',
  'wow',
  'sky',
  'ard', 'ardmediathek', 'das erste',
  'zdf', 'zdfneo', 'zdf mediathek',
  'rtl+', 'rtl plus', 'rtlplus',
  'arte', 'arte mediathek',
  'prosieben', 'joyn',
  'magenta tv', 'magentatv',
  'crunchyroll',
  'mubi',
];

function computePlatformFirstPenalty(headline: string): number {
  const h = headline.trim().toLowerCase();
  // Check: does the headline START with a niche platform name?
  // Guard with word boundary so "Maxime" doesn't match "Max".
  for (const p of NICHE_PLATFORMS_DE) {
    // require the phrase at position 0 AND followed by whitespace/punctuation or end
    if (h.startsWith(p)) {
      const afterPos = p.length;
      const next = h[afterPos];
      if (next === undefined || /[\s:,\-–—.!?]/.test(next)) {
        return -15;
      }
    }
  }
  return 0;
}

// (Mainstream list kept exported-able if ever needed by renderers; no-op here.)
export const __v5_platform_first = { MAINSTREAM_PLATFORMS_DE, NICHE_PLATFORMS_DE };

// ============================================================
// WINNER SELECTION
// ============================================================

export function pickWinnerV5(
  headlines: string[],
  articleContext?: ArticleContext,
  options?: { preserveOriginalStyle?: boolean }
): { winner: HeadlineScoreV5Result; ranked: HeadlineScoreV5Result[]; filteredOut: number } {
  const preserveMode = options?.preserveOriginalStyle === true;
  // v5.1: 45 statt 55 (preserve-mode 35 statt 40) — weiche Discover-Headlines
  const minScore = preserveMode ? 35 : 45;

  // Score all
  const scored = headlines.map(h => scoreHeadlineV5(h, articleContext, headlines));

  // Sort descending
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // v5.3: HARD-KILL any headline that hit the AI-formula / hyperbole killers
  // (ai_formula:*, score_reveal:*, grammar:*). These are never acceptable even
  // if they score highest. If ALL variants are hard-killed, we log loudly and
  // still pick the least-bad one — but that path should be near-zero after the
  // v5.3 prompt update.
  const isHardBanned = (s: HeadlineScoreV5Result) =>
    s.penalties.some((p) =>
      p.type === 'hard_killer' && (
        p.phrase.startsWith('ai_formula:') ||
        p.phrase.startsWith('score_reveal:') ||
        p.phrase.startsWith('grammar:') ||
        p.phrase === 'verändert alles' ||
        p.phrase === 'veraendert alles' ||
        p.phrase === 'ändert alles' ||
        p.phrase === 'aendert alles' ||
        p.phrase === 'stellt alles auf den kopf'
      )
    );
  const clean = scored.filter((s) => !isHardBanned(s));
  if (clean.length === 0) {
    console.warn('[headline-engine] ⚠️  ALL variants hit hard-killers — falling back to least-bad slop:',
      scored.slice(0, 3).map((s) => s.headline));
  }
  const nonSlopScored = clean.length > 0 ? clean : scored;

  // Filter based on configured minimum
  const eligible = nonSlopScored.filter(s => s.finalScore >= minScore);
  const filteredOut = scored.length - eligible.length;

  // If nothing passes, take best anyway (from the non-slop pool)
  const pool = eligible.length > 0 ? eligible : nonSlopScored;

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
