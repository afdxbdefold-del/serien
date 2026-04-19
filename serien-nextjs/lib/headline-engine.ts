/**
 * HEADLINE ENGINE v5.1 — Discover Edition
 *
 * Upgrades over v5:
 *  1. ANGLE-AWARE generation — classifies topic into 1 of 8 Discover angles
 *     (success / comeback / season_update / quality_praise / star_power /
 *     underrated / controversy / trend_momentum) and feeds only matching
 *     patterns to the LLM.
 *  2. DYNAMIC COOLDOWN — queries the last 20 published headlines and bans
 *     phrases that have been used ≥2× in the last 24h ("Offiziell:",
 *     "Doch noch:", "Plötzlich", "Ausgerechnet", "Jetzt bestätigt",
 *     "Erst X, jetzt Y", "endlich"). Stops the robotic-formula loop.
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

  // Star: first credible person name from entity list that is NOT the
  // series name itself.
  const persons = (entities.persons || []).filter(p =>
    p && p.length >= 3 && p.toLowerCase() !== seriesName.toLowerCase()
  );
  const star = persons[0];

  // Season: match "Season 3" / "Staffel 3" in source title first, else content.
  const titleSeason = originalTitle.match(/\b(?:Season|Staffel)\s*(\d{1,2})\b/i);
  const contentSeason = content.substring(0, 1500).match(/\b(?:Season|Staffel)\s*(\d{1,2})\b/i);
  const staffel = titleSeason?.[1] || contentSeason?.[1];

  return { star, plattform, staffel };
}

// ══════════════════════════════════════════════════════════════════════
// COOLDOWN — what overused phrases have we already spent today?
// ══════════════════════════════════════════════════════════════════════
/**
 * Scans the last N published headlines and returns phrases that are
 * currently BANNED for this generation because they've been used too
 * often in the last 24h.
 *
 * Threshold: any phrase used ≥ 2× in the last 24h is banned.
 * Hard cap: phrases used ≥ 4× in the last 48h are banned for 48h.
 */
async function computeBannedPhrases(): Promise<{ banned: string[]; tally: Record<string, number> }> {
  const since24h = new Date(Date.now() - 24 * 3600 * 1000);
  const since48h = new Date(Date.now() - 48 * 3600 * 1000);

  try {
    const [last24, last48] = await Promise.all([
      prisma.articles.findMany({
        where: { publishedAt: { gte: since24h }, status: 'published' },
        select: { title: true },
      }),
      prisma.articles.findMany({
        where: { publishedAt: { gte: since48h }, status: 'published' },
        select: { title: true },
      }),
    ]);

    const tally24: Record<string, number> = {};
    const tally48: Record<string, number> = {};
    for (const a of last24) for (const label of countOverusedPhrases(a.title || '')) tally24[label] = (tally24[label] || 0) + 1;
    for (const a of last48) for (const label of countOverusedPhrases(a.title || '')) tally48[label] = (tally48[label] || 0) + 1;

    const banned = new Set<string>();
    for (const [phrase, n] of Object.entries(tally24)) if (n >= 2) banned.add(phrase);
    for (const [phrase, n] of Object.entries(tally48)) if (n >= 4) banned.add(phrase);

    return { banned: Array.from(banned), tally: tally24 };
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
}): Promise<HeadlineEngineResult> {
  const start = Date.now();
  const { originalHeadline, articleContent, seriesName, entities } = input;
  const explorationMode = input.explorationMode !== false;
  const preserveOriginalStyle = input.preserveOriginalStyle === true;

  // 1) Angle classification (heuristic — cheap, deterministic)
  const detectedAngle = detectAngle(originalHeadline, articleContent);

  // 2) Extract SERIE / STAR / PLATTFORM / STAFFEL for pattern slot-filling
  const vars = extractVariables(originalHeadline, articleContent, entities, seriesName);
  const patternVars = { serie: seriesName, ...vars };

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
  });
  let rawVariants = await callHeadlineLLM(prompt);

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

  // 9) Logging — same format as v5 for dashboard compatibility + angle line
  console.log(`\n   🏆 HEADLINE ENGINE v5.1 (angle=${detectedAngle}) ${explorationMode ? '(EXPLORATION)' : '(CONSERVATIVE)'}`);
  if (banned.length) console.log(`   🚫 Cooldown-Bans: ${banned.join(', ')}   (24h-tally: ${JSON.stringify(tally)})`);
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
}): string {
  const { originalHeadline, contentSummary, seriesName, vars, focusPatterns, allByAngle, detectedAngle, banned, preserveOriginalStyle } = args;

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

  const knownVars = [
    `SERIE       = ${seriesName}`,
    vars.star      ? `STAR        = ${vars.star}`      : 'STAR        = (unbekannt — nicht erfinden)',
    vars.plattform ? `PLATTFORM   = ${vars.plattform}` : 'PLATTFORM   = (unbekannt — generische Formulierung wählen)',
    vars.staffel   ? `STAFFEL     = ${vars.staffel}`   : 'STAFFEL     = (unbekannt — Muster ohne Staffel-Nummer wählen)',
  ].join('\n');

  return `Du bist ein deutscher Chef-vom-Dienst für eine Serien-Redaktion. Du schreibst Headlines für Google Discover.
Ziel: Menschlich klingend, neugierig-machend, vertrauenswürdig, hohe CTR.
Keine KI-Floskeln. Keine Reißer-Masche. Deutsche Redaktions-Qualität.

===== QUELL-HEADLINE (englisch) =====
"${originalHeadline}"

===== BEKANNTE VARIABLEN =====
${knownVars}
PRIMÄRER ANGLE (heuristisch erkannt): ${detectedAngle} — ${ANGLE_META[detectedAngle].label}

===== ARTIKEL-INHALT (erste 1500 Zeichen) =====
${contentSummary}${preserveNote}

===== ANGLE-KLASSIFIKATION =====
Du klassifizierst die Story in GENAU EINEN dieser Angles (pick one):
  1. success          — Streaming-Dominanz, Zuschauerzahlen, weiter ganz oben
  2. comeback         — überraschende Rückkehr, Revival
  3. season_update    — neue Staffel, Wartezeit, Produktions-Hinweise
  4. quality_praise   — Kritiker-Lob, Rezeption, warum es trifft
  5. star_power       — Star zieht Aufmerksamkeit auf Serie
  6. underrated       — Geheimtipp, übersehen
  7. controversy      — polarisiert, spaltet
  8. trend_momentum   — viral, alle reden wieder drüber

===== MUSTER FÜR DEN PRIMÄREN ANGLE =====
${focusBlock}

===== GESAMT-BIBLIOTHEK (20 Muster) =====
${libraryBlock}${banBlock}

===== REGELN =====
- Generiere genau 10 Headlines auf DEUTSCH.
- "${seriesName}" MUSS in JEDER Headline vorkommen.
- Max 65 Zeichen pro Headline.
- Nutze die Muster als INSPIRATION, kopiere nicht wörtlich — variiere Wortstellung & Rhythmus.
- Schreibe so, wie ein Mensch bei Quotenmeter, DWDL oder serienjunkies schreiben würde.
- Natürlicher deutscher Satzrhythmus. Keine hohle Euphorie.
- Vermeide diese übernutzten Öffner (nur verwenden wenn der Artikel das WIRKLICH hergibt): "Offiziell:", "Endlich", "Doch noch", "Plötzlich", "Ausgerechnet".
- Keine zwei Headlines dürfen mit demselben Wort beginnen.
- Mindestens 6 verschiedene Angles über die 10 Headlines verteilen.
- Kein Clickbait ohne Deckung im Artikel — jede Behauptung muss aus dem Content gestützt sein.

===== BEISPIEL-OUTPUT (Struktur) =====
Topic: "Fallout reaches 100 million viewers months after finale"
→ [
  { "angle": "success",          "text": "Fallout hört einfach nicht auf – selbst jetzt bleibt die Serie ganz vorne", "score": 86 },
  { "angle": "success",          "text": "Monate später: Fallout schlägt weiter fast alles bei Prime Video",         "score": 84 },
  { "angle": "trend_momentum",   "text": "Plötzlich reden wieder alle über Fallout",                                  "score": 78 }
]

===== AUSGABE =====
Gib NUR ein JSON-Array zurück, exakt in dieser Form — keine Erklärung, kein Markdown:
[
  { "angle": "<einer der 8 angles>", "text": "<deutsche Headline>", "score": <0-100 deine Einschätzung> },
  ...
  (genau 10 Einträge)
]`;
}

// ══════════════════════════════════════════════════════════════════════
// LLM CALL
// ══════════════════════════════════════════════════════════════════════
async function callHeadlineLLM(prompt: string): Promise<Array<{ type: string; text: string; angle?: HeadlineAngle; score?: number }>> {
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
        text: String(item.text).trim(),
      }));
  } catch (error: any) {
    console.error('Headline LLM call failed:', error.message);
    return [];
  }
}
