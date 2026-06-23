/**
 * HEADLINE ENGINE v5.1 — Discover Edition
 *
 * Upgrades over v5:
 *  1. ANGLE-AWARE generation — classifies topic into 1 of 8 Discover angles
 *     (success / comeback / season_update / quality_praise / star_power /
 *     underrated / controversy / trend_momentum) and feeds only matching
 *     patterns to the LLM.
 *  2. DYNAMIC COOLDOWN — queries published headlines and bans phrases that
 *     have been used ≥ 1× in the last 7 days (verschärft Juni 2026 vs. HCU
 *     SpamBrain — vorher 2× in 24 h). Stops the robotic-formula loop und
 *     verhindert Site-weite stilistische Footprints.
 *  3. VARIABLE EXTRACTION — auto-fills {STAR}, {PLATTFORM}, {STAFFEL}
 *     from fact-extractor entities + regex so patterns stay natural.
 *  4. 10 candidates instead of 8, angle-diverse, then scored by v5.
 */

import { scoreHeadlineV5, pickWinnerV5, type HeadlineScoreV5Result, type ArticleContext } from './headline-scorer-v5';
import {
  detectAngle,
  getPatternsForAngle,
  getAllPatternsByAngle,
  OVERUSED_PHRASES,
  countOverusedPhrases,
  ANGLE_META,
  type HeadlineAngle,
} from './headline-patterns';
import { PrismaClient } from '@prisma/client';
import { stripDashes } from './strip-dashes';
import { softenLargeNumbers } from './soften-numbers';


const prisma = new PrismaClient();

export interface HeadlineVariant {
  text: string;
  type: string;
  score: number;
  angle?: HeadlineAngle;           // NEW in v5.1
  componentScores: HeadlineScoreV5Result['componentScores'];
  penalties: HeadlineScoreV5Result['penalties'];
  boosts: HeadlineScoreV5Result['boosts'];
  ceilingApplied: string | null;
  selected: boolean;
  meta: HeadlineScoreV5Result['meta'];
  relativeOutlierBonus: number;
  passedMinimum: boolean;
  isStrongCandidate: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
}

export interface HeadlineEngineResult {
  winner: HeadlineVariant;
  top3: HeadlineVariant[];
  allVariants: HeadlineVariant[];
  generationTime: number;
  selectionMethod: 'weighted_random' | 'conservative';
  explorationMode: boolean;
  selectedRank: number;
  detectedAngle: HeadlineAngle;      // NEW in v5.1
  bannedPhrases: string[];           // NEW in v5.1
}

const MIN_SCORE = 50;

// Editorial AI-slop phrases to strip out entirely.
const AI_SLOP_PATTERNS = [
  /alles was (du|wir|man) wissen (muss|musst|müssen)/i,
  /das (solltest|musst) du (wissen|sehen)/i,
  /jetzt wird es (spannend|ernst|interessant)/i,
  /hier (sind|ist|kommt) (die|der|das)/i,
  /was wir bisher wissen/i,
  /das gibt es zu (sagen|berichten)/i,
  // v5.3: hyperbolic-vague — "verändert alles", "ändert alles", "stellt alles auf den Kopf"
  /\b(ver[äa]ndert|[äa]ndert)\s+alles\b/i,
  /stellt\s+alles\s+auf\s+den\s+kopf/i,
  /\balles\s+(ver[äa]ndert|[äa]ndert|kippt|wird\s+anders)\b/i,
  // v5.3: AI-formula reveal — "X enthüllt/verrät/zeigt/erklärt/offenbart, warum/wie/wieso/weshalb/was Y"
  // Single most common AI tell. Comma right after the verb is the giveaway.
  /\b(enth[üu]llt|verr[äa]t|verraet|zeigt|erkl[äa]rt|verk[üu]ndet|offenbart|beweist|bestätigt|best[äa]tigt)\s*,\s*(warum|wieso|weshalb|wie|was|woran|wann|wo)\b/i,
  // v5.3: weaker variant without comma but same structure mid-sentence
  /\b(enth[üu]llt|verr[äa]t|zeigt|erkl[äa]rt|offenbart)\s+(warum|wieso|weshalb|wie\s+(genau|wirklich)|was\s+(wirklich|genau))\b/i,
  // ──────────────────────────────────────────────────────────────────
  // v5.4 OPINION-TONE PATTERNS — News-Stil schützen.
  // Erlaubt bleiben Neugier ("Warum X scheitert") und Emotion ("X erschüttert").
  // Verboten: erste Person, Imperativ, Beifall-Auftakt, Verdikt-Phrasen.
  // ──────────────────────────────────────────────────────────────────
  /(?<![a-zäöüß])(ich|mir|mich|mein(e|er|en|em)?|unser(e|er|en|em)?)(?![a-zäöüß])/i,
  /\b(meiner|meine)\s+meinung\b/i,
  /\baus\s+meiner\s+sicht\b/i,
  /\bich\s+(finde|liebe|hasse|denke|glaube)\b/i,
  /\b(verzaubert|überzeugt|ueberzeugt|beeindruckt|berührt|beruehrt)\s+mich\b/i,
  /^endlich\b/i,                    // editorialising opener
  /^zum\s+glück\b/i,
  /^leider\b/i,
  /^glücklicherweise\b/i,
  /^bravo\b/i,
  /^ein\s+hoch\s+auf\b/i,
  /\bbitte\s+mehr\s+(davon|hiervon|von)\b/i,
  /\b(solltest|solltet|musst|müsst|muesst|sollten\s+sie|müssen\s+sie)\s+(du|ihr|sie|man)?\s*(unbedingt|wirklich)?\s*(sehen|schauen|gucken|streamen|gespannt|nicht\s+verpassen)/i,
  /\bmuss\s+man\s+(gesehen|geschaut)\s+haben\b/i,
  /\bgehört\s+zu\s+den\s+(besten|größten|grandiosesten|genialsten)\b/i,
  /\bgehoert\s+zu\s+den\s+besten\b/i,
  /\bein\s+muss\s+f(ü|u|ue)r\b/i,
  /\bpflicht(programm|serie|film)\b/i,
  /\bperfekteste\b/i,
  /\b(unterschätzteste|überschätzteste|unterschaetzteste|ueberschaetzteste)\b/i,
  /\bbeste\s+(serie|comedy|sitcom|drama)\s+aller\s+zeiten\b/i,
  // v5.6: gesperrte emotionale Metaphern — Editor-Regel
  /(?<![a-zäöüß])stirbt(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(explodiert|explodieren)(?![a-zäöüß])/i,
  /(?<![a-zäöüß])bricht\s+ein(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(zerstört|zerstoert)(?![a-zäöüß])/i,
  /(?<![a-zäöüß])(eskaliert|eskalieren)(?![a-zäöüß])/i,
  // ──────────────────────────────────────────────────────────────────
  // v5.7 PERSONALITY-NEWS SLOP — Memoir/Personal-Statement Headlines.
  // Reaktion auf "Schock bei 19: Was Hayden Panettiere über Nashville
  // hinaus beschäftigt": Headline-Engine zog die Serie reflexartig rein,
  // obwohl der Body über persönliche Übergriffe handelt. Zwei Fehler:
  // (a) "über [Serie] hinaus beschäftigt" — Serie wird zum Subjekt eines
  //     Empfindens, was inhaltlich nicht stimmt.
  // (b) "bei {Zahl}" als Alters-Marker — im Deutschen IMMER "mit {Zahl}"
  //     bzw. "mit {Zahl} Jahren" (vgl. "mit 19 Jahren"). "bei 19" ist
  //     Anglizismus / Boulevard-Tabloid-Sound.
  // (c) Vacuum-Hooks "Was X beschäftigt" ohne harten Fakt im Satz.
  // ──────────────────────────────────────────────────────────────────
  /\b(?:[üu]ber|jenseits\s+von)\s+\S+\s+hinaus\s+besch[äa]ftigt\b/i,
  /\bwas\s+\S+(?:\s+\S+){0,3}\s+(?:[üu]ber\s+\S+\s+hinaus\s+)?besch[äa]ftigt\b/i,
  // Age-marker "bei <kleine Zahl>" — verboten, wenn es offensichtlich
  // KEIN Platz/Streamer/Score/Messwert ist. Whitelist die typischen
  // Folgewörter, die "bei N …" rechtfertigen (Netflix, Prozent, …).
  /\bbei\s+\d{1,2}\b(?!\s*(?:%|prozent|punkten?|sternen?|millionen?|tausend|netflix|prime|disney|hbo|amazon|apple|paramount|sky|hulu|wow|joyn|magenta|rtl|ard|zdf|crunchyroll|von|aus|im|in|auf|für|fuer|–|—|-|\d))/i,
];
const isAISlop = (h: string) => AI_SLOP_PATTERNS.some(p => p.test(h));

// ══════════════════════════════════════════════════════════════════════
// VARIABLE EXTRACTION — pull STAR / PLATTFORM / STAFFEL from inputs
// ══════════════════════════════════════════════════════════════════════
const KNOWN_PLATFORMS: Record<string, string> = {
  'netflix': 'Netflix',
  'apple tv': 'Apple TV+',
  'apple tv+': 'Apple TV+',
  'appletv': 'Apple TV+',
  'prime video': 'Prime Video',
  'amazon prime': 'Prime Video',
  'amazon': 'Prime Video',
  'disney+': 'Disney+',
  'disney plus': 'Disney+',
  'hulu': 'Hulu',
  'hbo': 'HBO',
  'hbo max': 'HBO Max',
  'max': 'HBO Max',
  'paramount+': 'Paramount+',
  'paramount plus': 'Paramount+',
  'peacock': 'Peacock',
  'ard': 'ARD',
  'zdf': 'ZDF',
  'sky': 'Sky',
  'wow': 'WOW',
  'rtl': 'RTL+',
};

function extractVariables(
  originalTitle: string,
  content: string,
  entities: { persons?: string[]; keywords?: string[] },
  seriesName: string,
): { star?: string; plattform?: string; staffel?: string } {
  const text = `${originalTitle}\n${content.substring(0, 2500)}`;

  // Platform: first from entity keywords that matches a known streamer,
  // else scan the text itself.
  let plattform: string | undefined;
  const keywords = entities.keywords || [];
  for (const k of keywords) {
    const hit = KNOWN_PLATFORMS[(k || '').toLowerCase().trim()];
    if (hit) { plattform = hit; break; }
  }
  if (!plattform) {
    for (const [key, name] of Object.entries(KNOWN_PLATFORMS)) {
      if (new RegExp(`\\b${key.replace(/\+/g,'\\+')}\\b`, 'i').test(text)) {
        plattform = name; break;
      }
    }
  }

  // Star: prefer FULL names (First + Last) over single-word entries since
  // legacy/nostalgia audiences react strongly to name recognition (Mark
  // Harmon, David Hasselhoff, Tom Selleck, Angela Lansbury, …).
  const personsRaw = (entities.persons || []).filter(p =>
    p && p.length >= 3 && p.toLowerCase() !== seriesName.toLowerCase()
  );
  const personsSorted = [...personsRaw].sort((a, b) => {
    const aFull = /^[A-ZÄÖÜ][\wÄÖÜäöüß'-]+\s+[A-ZÄÖÜ][\wÄÖÜäöüß'-]+/.test(a) ? 1 : 0;
    const bFull = /^[A-ZÄÖÜ][\wÄÖÜäöüß'-]+\s+[A-ZÄÖÜ][\wÄÖÜäöüß'-]+/.test(b) ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;  // full names first
    return 0;
  });
  const star = personsSorted[0];

  // Season: match "Season 3" / "Staffel 3" in source title first, else content.
  const titleSeason = originalTitle.match(/\b(?:Season|Staffel)\s*(\d{1,2})\b/i);
  const contentSeason = content.substring(0, 1500).match(/\b(?:Season|Staffel)\s*(\d{1,2})\b/i);
  const staffel = titleSeason?.[1] || contentSeason?.[1];

  return { star, plattform, staffel };
}

// ══════════════════════════════════════════════════════════════════════
// COOLDOWN — what overused phrases have we already spent this week?
// ══════════════════════════════════════════════════════════════════════
/**
 * Scans recent published headlines and returns phrases that are currently
 * BANNED for this generation because they've been used too often.
 *
 * Verschärft (Juni 2026, Anti-HCU-Pass):
 *  - Window: 7 Tage (vorher 24 h) — verhindert dass derselbe Buzz-Marker
 *    sich innerhalb einer Woche replizieren kann.
 *  - Threshold: 1× im 7d-Fenster reicht für Ban (vorher 2× in 24 h).
 *  - Hard cap: 2× in 14 Tagen → 14-Tage-Ban.
 *
 * Begründung: SpamBrain wertet stilistische Replikation als Site-Footprint.
 * 24 h waren zu kurz — Templates konnten in 14 von 30 Tagen je 2× erscheinen.
 */
async function computeBannedPhrases(): Promise<{ banned: string[]; tally: Record<string, number> }> {
  const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000);

  try {
    const [last7d, last14d] = await Promise.all([
      prisma.articles.findMany({
        where: { publishedAt: { gte: since7d }, status: 'published' },
        select: { title: true },
      }),
      prisma.articles.findMany({
        where: { publishedAt: { gte: since14d }, status: 'published' },
        select: { title: true },
      }),
    ]);

    const tally7d: Record<string, number> = {};
    const tally14d: Record<string, number> = {};
    for (const a of last7d) for (const label of countOverusedPhrases(a.title || '')) tally7d[label] = (tally7d[label] || 0) + 1;
    for (const a of last14d) for (const label of countOverusedPhrases(a.title || '')) tally14d[label] = (tally14d[label] || 0) + 1;

    const banned = new Set<string>();
    for (const [phrase, n] of Object.entries(tally7d)) if (n >= 1) banned.add(phrase);
    for (const [phrase, n] of Object.entries(tally14d)) if (n >= 2) banned.add(phrase);

    return { banned: Array.from(banned), tally: tally7d };
  } catch (err: any) {
    console.warn('   ⚠️  Cooldown-Query fehlgeschlagen, fahre ohne Ban-Liste fort:', err.message);
    return { banned: [], tally: {} };
  }
}

// ══════════════════════════════════════════════════════════════════════
// MAIN ENTRY
// ══════════════════════════════════════════════════════════════════════
export async function generateHeadlines(input: {
  originalHeadline: string;
  articleContent: string;
  seriesName: string;
  entities: {
    persons?: string[];
    events?: string[];
    keywords?: string[];
  };
  explorationMode?: boolean;
  preserveOriginalStyle?: boolean;
  /**
   * v5.7: When the upstream classifier returns PERSONALITY_NEWS, the series is
   * only context (the actor's "known for" show). We force the star_power angle
   * and tell the prompt that {SERIE} must NOT be the news subject — only an
   * optional context tag. Prevents the "über [Serie] hinaus beschäftigt" trap.
   */
  contentClassification?: string;
}): Promise<HeadlineEngineResult> {
  const start = Date.now();
  const { originalHeadline, articleContent, seriesName, entities } = input;
  const explorationMode = input.explorationMode !== false;
  const preserveOriginalStyle = input.preserveOriginalStyle === true;
  const isPersonalityNews = input.contentClassification === 'PERSONALITY_NEWS';

  // 1) Angle classification (heuristic — cheap, deterministic)
  let detectedAngle = detectAngle(originalHeadline, articleContent);

  // v5.7: PERSONALITY_NEWS articles ALWAYS use star_power. The body is about
  // the actor's personal life, not the series.
  if (isPersonalityNews) {
    detectedAngle = 'star_power';
  }

  // 2) Extract SERIE / STAR / PLATTFORM / STAFFEL for pattern slot-filling
  const vars = extractVariables(originalHeadline, articleContent, entities, seriesName);
  const patternVars = { serie: seriesName, ...vars };

  // Nostalgia needs a STAR. If classifier picked nostalgia but we can't fill
  // {STAR}, fall back to star_power → then to the next-best angle so we
  // don't feed patterns with empty slots to the LLM.
  if (detectedAngle === 'nostalgia' && !vars.star) {
    detectedAngle = 'star_power';
  }

  // 3) Build focused pattern set: primary angle + adjacent
  const focusPatterns = getPatternsForAngle(detectedAngle, patternVars, { includeAdjacent: true });
  const allByAngle    = getAllPatternsByAngle(patternVars);

  // 4) Cooldown — which phrases are banned today?
  const { banned, tally } = await computeBannedPhrases();

  // 5) Build prompt & call LLM
  const contentSummary = articleContent.substring(0, 1500);
  const prompt = buildDiscoverPrompt({
    originalHeadline, contentSummary, seriesName, vars,
    focusPatterns, allByAngle, detectedAngle, banned, preserveOriginalStyle,
    isPersonalityNews,
  });
  let rawVariants = await callHeadlineLLM(prompt, seriesName);

  // 6) Hard-filter: remove any variant that hits a BANNED phrase
  if (banned.length > 0) {
    const banRxes = OVERUSED_PHRASES.filter(p => banned.includes(p.label)).map(p => p.rx);
    const kept = rawVariants.filter(v => !banRxes.some(rx => rx.test(v.text)));
    // Keep at least 4 candidates — if filter is too aggressive, skip it
    rawVariants = kept.length >= 4 ? kept : rawVariants;
  }

  // 7) v5 scoring
  const allTexts = rawVariants.map(v => v.text);
  const context: ArticleContext = {
    seriesName,
    persons: entities.persons,
    keywords: entities.keywords,
  };
  const v5Result = pickWinnerV5(allTexts, context, { preserveOriginalStyle });

  // 8) Map to HeadlineVariant
  const scoredVariants: HeadlineVariant[] = rawVariants.map(v => {
    const v5 = v5Result.ranked.find(r => r.headline === v.text);
    const isSelected = v5Result.winner.headline === v.text;
    const slopHit = isAISlop(v.text);

    if (!v5) {
      return {
        text: v.text, type: v.type, angle: (v as any).angle as HeadlineAngle | undefined, score: 0,
        componentScores: { hookStrength: 0, topicClarity: 0, visibleTopicClarity: 0, contextTopicClarity: 0, specificity: 0, riskConflict: 0, contrastPattern: 0, ctrPrediction: 0 },
        penalties: [], boosts: [], ceilingApplied: null, selected: isSelected,
        meta: { hasEntity: false, hasVisibleEntity: false, hasSpecificEvent: false, hasRealConflict: false, hasConditionalContrast: false, seriesStartHandling: 'not_applicable' as const },
        relativeOutlierBonus: 0, passedMinimum: false, isStrongCandidate: false,
        impressions: 0, clicks: 0, ctr: 0,
      };
    }

    const finalScore = slopHit ? Math.max(0, v5.finalScore - 15) : v5.finalScore;

    return {
      text: v.text, type: v.type, angle: (v as any).angle as HeadlineAngle | undefined, score: finalScore,
      componentScores: v5.componentScores,
      penalties: slopHit ? [...v5.penalties, { type: 'ai_slop', phrase: 'AI-Slop', value: -15 }] : v5.penalties,
      boosts: v5.boosts, ceilingApplied: v5.ceilingApplied, selected: isSelected,
      meta: v5.meta, relativeOutlierBonus: v5.relativeOutlierBonus,
      passedMinimum: finalScore >= MIN_SCORE, isStrongCandidate: finalScore >= 70,
      impressions: 0, clicks: 0, ctr: 0,
    };
  }).sort((a, b) => b.score - a.score);

  const winner = scoredVariants.find(v => v.selected) || scoredVariants[0];
  const top3   = scoredVariants.filter(v => v.passedMinimum).slice(0, 3);
  const selectedRank = scoredVariants.findIndex(v => v.selected) + 1;

  // Soften concrete viewership / audience figures ("26,5 Millionen schauen …"
  // → "Millionen schauen …") so headlines stay evergreen.
  if (winner) winner.text = softenLargeNumbers(winner.text);
  for (const v of scoredVariants) v.text = softenLargeNumbers(v.text);
  for (const v of top3) v.text = softenLargeNumbers(v.text);

  // 9) Logging — same format as v5 for dashboard compatibility + angle line
  console.log(`\n   🏆 HEADLINE ENGINE v5.1 (angle=${detectedAngle}) ${explorationMode ? '(EXPLORATION)' : '(CONSERVATIVE)'}`);
  if (banned.length) console.log(`   🚫 Cooldown-Bans: ${banned.join(', ')}   (7d-tally: ${JSON.stringify(tally)})`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   HOK TOP SPE RSK CON CTR OLR = TOT | angle        | Headline`);
  console.log(`   ─────────────────────────────────────────────────────────────────`);
  scoredVariants.forEach(v => {
    const sel = v.selected ? '👉' : '  ';
    const c = v.componentScores;
    const cols = [c.hookStrength, c.topicClarity, c.specificity, c.riskConflict, c.contrastPattern, c.ctrPrediction, v.relativeOutlierBonus]
      .map(n => n.toString().padStart(3)).join(' ');
    const flags: string[] = [];
    if (v.ceilingApplied) flags.push('CAP');
    if (!v.passedMinimum) flags.push('⊘');
    if (v.isStrongCandidate) flags.push('★');
    const flagStr = flags.length ? ` [${flags.join(' ')}]` : '';
    const ang = (v.angle || '-').padEnd(13);
    console.log(`   ${sel} ${cols} = ${v.score.toString().padStart(3)} | ${ang} | "${v.text}"${flagStr}`);
  });
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Selected: #${selectedRank} "${winner.text}" (${winner.score})`);
  console.log(`   ⏱️  ${Date.now() - start}ms\n`);

  return {
    winner,
    top3,
    allVariants: scoredVariants,
    generationTime: Date.now() - start,
    selectionMethod: explorationMode ? 'weighted_random' : 'conservative',
    explorationMode,
    selectedRank,
    detectedAngle,
    bannedPhrases: banned,
  };
}

// ══════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ══════════════════════════════════════════════════════════════════════
function buildDiscoverPrompt(args: {
  originalHeadline: string;
  contentSummary: string;
  seriesName: string;
  vars: { star?: string; plattform?: string; staffel?: string };
  focusPatterns: Array<{ angle: HeadlineAngle; example: string }>;
  allByAngle: Record<HeadlineAngle, string[]>;
  detectedAngle: HeadlineAngle;
  banned: string[];
  preserveOriginalStyle: boolean;
  isPersonalityNews?: boolean;
}): string {
  const { originalHeadline, contentSummary, seriesName, vars, focusPatterns, allByAngle, detectedAngle, banned, preserveOriginalStyle, isPersonalityNews } = args;

  const focusBlock = focusPatterns.map(p => `  • [${p.angle}] "${p.example}"`).join('\n');
  const libraryBlock = (Object.keys(allByAngle) as HeadlineAngle[])
    .map(angle => `  ${ANGLE_META[angle].label}:\n${allByAngle[angle].map(e => `    - "${e}"`).join('\n')}`)
    .join('\n');

  const banBlock = banned.length
    ? `\n===== HEUTE BEREITS ZU OFT VERWENDET — STRIKT VERBOTEN =====\n${banned.map(b => `  ✗ "${b}"`).join('\n')}\nKeine einzige Headline darf eines dieser Muster enthalten.`
    : '';

  const preserveNote = preserveOriginalStyle
    ? `\n===== QUELL-STIL BEWAHREN =====\nDie Quelle schreibt bewusst nüchtern. Bleibe semantisch nah am englischen Original, keine künstliche Dramatisierung.`
    : '';

  const personalityNote = isPersonalityNews
    ? `\n===== PERSONALITY-NEWS MODUS =====
Diese Story handelt vom PERSÖNLICHEN Leben des Stars (Memoir, Übergriffe, Krankheit, Klage, Beziehung).
Die Serie "${seriesName}" ist nur "bekannt aus"-Kontext — NICHT das Thema der Headline.
→ Lead mit dem PERSONEN-NAMEN, nicht mit der Serie.
→ Wenn die Serie überhaupt vorkommt, dann als kurzer Apposition-Kontext ("Nashville-Star X …", "X (Nashville) …"), nie als Subjekt eines Empfindens ("über Nashville hinaus beschäftigt" o. ä. ist STRENG VERBOTEN).
→ Bei Altersangaben IMMER "mit 19" / "mit 19 Jahren", NIE "bei 19" (Anglizismus/Boulevard).`
    : '';

  const knownVars = [
    `SERIE       = ${seriesName}`,
    vars.star      ? `STAR        = ${vars.star}`      : 'STAR        = (unbekannt — nicht erfinden)',
    vars.plattform ? `PLATTFORM   = ${vars.plattform}` : 'PLATTFORM   = (unbekannt — generische Formulierung wählen)',
    vars.staffel   ? `STAFFEL     = ${vars.staffel}`   : 'STAFFEL     = (unbekannt — Muster ohne Staffel-Nummer wählen)',
  ].join('\n');

  return `Du bist Chef-vom-Dienst einer deutschen Serien-Nachrichten-Redaktion (Qualität: Quotenmeter / DWDL).
Deine Hauptaufgabe: Den englischen Quell-Headline INHALTSTREU ins Deutsche bringen — kein Click-Bait, keine erfundenen Spannungsbögen.
Wenn der Quell-Headline klar ist (Ereignis + Beteiligte + Was passiert), schreibe ihn um — du behältst Fakt, Subjekt und Verb.
NUR wenn der Quell-Headline rein deskriptiv ist (Titel + Zitat, Episoden-Recap, Liste), darfst du auf die Pattern-Bibliothek zurückgreifen — auch dann nicht in Buzz-Phrasing.

KARDINALFEHLER (führen zur Disqualifizierung):
  ✗ Erfundene Fakten (z. B. „500 Jahre Vorgeschichte", die der Quell-Text nicht nennt)
  ✗ Falsche Zuschreibungen (z. B. „(The Pitt)" wenn die Quelle die Serie nicht erwähnt)
  ✗ Dramatisierte Aufhänger („reden wieder alle", „bricht ihr Schweigen", „Imperium")
  ✗ Pattern-Replikation: Headlines wie „Plötzlich reden wieder alle über X" oder „Warum X gerade …" sind GEBANNT
  ✗ Boulevard-Spin („Endlich!", „Krebs-Schock", „Familien-Drama")

===== QUELL-HEADLINE (originaltreu adaptieren) =====
"${originalHeadline}"

===== BEKANNTE VARIABLEN =====
${knownVars}
PRIMÄRER ANGLE (heuristisch erkannt, optional): ${detectedAngle} — ${ANGLE_META[detectedAngle].label}

===== ARTIKEL-INHALT (erste 1500 Zeichen, FAKTEN-BASIS) =====
${contentSummary}${preserveNote}${personalityNote}

===== ARBEITSWEISE — VERBINDLICH =====
Schritt 1: Identifiziere im Quell-Headline das KERN-EREIGNIS.
   Beispiel: "Kevin McKidd Joins Elisabeth Moss in Hulu Legal Drama 'Conviction'" →
   Kern: McKidd ist neu im Cast einer Hulu-Serie an der Seite von Moss.
Schritt 2: Schreibe diesen Kern in 1 nüchternen deutschen Satz.
   ✅ "Kevin McKidd verstärkt Elisabeth Moss in Hulus Rechtsdrama Conviction"
   ✗ "Warum Conviction mit diesem Cast-Zuwachs anders dasteht als andere Rechtsdramen"
Schritt 3: Generiere 9 weitere Varianten dieses Kerns — verschiedene Eröffnungen, gleicher Fakt.
   (Verb voran, Streamer voran, Datums-Anker, Frage-Form usw.)
Schritt 4: Erst wenn der Quell-Headline ein RECAP / EPISODE-DEEP-DIVE / LIST-Format ist, darfst du
   auf die Pattern-Bibliothek zurückgreifen — und auch dann nur eine VARIATION, keine Wörtlich-Kopie.

===== ANGLE-KLASSIFIKATION (Kontext, NICHT Pflicht) =====
Nur als Orientierung — der Quell-Headline schlägt jede Angle-Heuristik:
  1. success / 2. comeback / 3. season_update / 4. quality_praise /
  5. star_power / 6. underrated / 7. controversy / 8. trend_momentum / 9. nostalgia

===== MUSTER-BIBLIOTHEK (FALLBACK NUR FÜR RECAP/LIST/EPISODE-FORMATE) =====
Diese Muster sind KEIN Primär-Input. Nimm sie NUR wenn der Quell-Headline ohne News-Substanz ist:
${focusBlock}${banBlock}${detectedAngle === 'nostalgia' ? `

===== SONDERREGELN FÜR NOSTALGIE/LEGACY-ANGLE =====
Zielgruppe: Ältere TV-Fans, NCIS-/CSI-/Magnum-/Columbo-Community. Sie reagieren auf NAMENSWIEDERERKENNUNG — nutze den vollen Namen "${vars.star || '{STAR}'}" häufig, nicht Pronomen wie „er/sie/ihn/ihr". Ton: respektvoll, neugierig, mit Wehmut. Keine Reißer, kein Spott. Bewahre die Legenden-Würde des Stars.` : ''}

===== REGELN =====
- Generiere genau 10 deutsche Headlines, alle als treue Adaptionen des Quell-Headlines.
- ${isPersonalityNews
    ? `"${vars.star || seriesName}" (Person) MUSS in jeder Headline vorkommen. Die Serie "${seriesName}" darf vorkommen, MUSS aber nicht — und nur als Kontext-Apposition, nie als Thema.`
    : `"${seriesName}" MUSS in JEDER Headline vorkommen${detectedAngle === 'nostalgia' ? `, UND der Name "${vars.star || '{STAR}'}" sollte in mindestens 7 von 10 Headlines vorkommen` : ''}.`}
- Max 95 Zeichen pro Headline, **Sweet-Spot 45–90 Zeichen** (Google Discover Card auf Mobile).
- Keine zwei Headlines dürfen mit demselben Wort beginnen.
- Variier Eröffnung: Eigenname+Verb / Streamer / Datum / Frage / Zahl. Maximal 1 von 10 darf mit „Warum/Darum" starten.
- Keine Hyperbel, keine erste Person, keine Imperative an Leser, keine Gedankenstriche („—" / „–"), kein Boulevard-Spin.
- Keine konkreten Score-Zahlen (Rotten Tomatoes, Metacritic) oder Viewer-Zahlen in der Headline — gehört in den Lead.
- VERBOTEN als Verben: „stirbt, explodiert, bricht ein, zerstört, eskaliert" (auch metaphorisch).
- Jede Headline MUSS aus dem Artikel-Inhalt gestützt sein. Wenn ein Fakt nicht im Source-Text steht: weglassen.
- Übernutzte Öffner: „Offiziell:", „Endlich", „Doch noch", „Plötzlich", „Ausgerechnet" — alle bereits über OVERUSED_PHRASES gebannt.

===== AUSGABE =====
Gib NUR ein JSON-Array zurück, exakt in dieser Form — keine Erklärung, kein Markdown:
[
  { "angle": "<einer der 9 angles>", "text": "<deutsche Headline>", "score": <0-100 deine Einschätzung> },
  ...
  (genau 10 Einträge)
]`;
}

// ══════════════════════════════════════════════════════════════════════
// LLM CALL
// ══════════════════════════════════════════════════════════════════════
async function callHeadlineLLM(prompt: string, seriesName: string = ''): Promise<Array<{ type: string; text: string; angle?: HeadlineAngle; score?: number }>> {
  try {
    const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
    const client = createLLMClient();
    const config = getLLMConfig();

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein deutscher Chef-vom-Dienst für Serien-Journalismus. Du schreibst für Google Discover. Antworte NUR mit validem JSON-Array.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseLLMJson(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item && typeof item.text === 'string' && item.text.trim().length > 0)
      .map((item: any) => ({
        type: String(item.angle || item.type || 'general'),
        angle: item.angle as HeadlineAngle | undefined,
        score: typeof item.score === 'number' ? item.score : undefined,
        // Strip em/en-dashes (AI-tell), but preserve series names containing a dash
        text: stripDashes(String(item.text).trim(), [seriesName]),
      }));
  } catch (error: any) {
    console.error('Headline LLM call failed:', error.message);
    return [];
  }
}
