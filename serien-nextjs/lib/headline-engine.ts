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
  let detectedAngle = detectAngle(originalHeadline, articleContent);

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
  9. nostalgia        — TV-Legenden, Karriere-Ursprung, Jahrzehnte-Serien, klassische Stars (NCIS/CSI/Magnum-Ära)

===== MUSTER FÜR DEN PRIMÄREN ANGLE =====
${focusBlock}

===== GESAMT-BIBLIOTHEK (40 Muster) =====
${libraryBlock}${banBlock}${detectedAngle === 'nostalgia' ? `

===== SONDERREGELN FÜR NOSTALGIE/LEGACY-ANGLE =====
Zielgruppe: Ältere TV-Fans, NCIS-/CSI-/Magnum-/Columbo-Community. Sie reagieren auf NAMENSWIEDERERKENNUNG — nutze den vollen Namen "${vars.star || '{STAR}'}" häufig, nicht Pronomen wie „er/sie/ihn/ihr". Ton: respektvoll, neugierig, mit Wehmut. Keine Reißer, kein Spott. Bewahre die Legenden-Würde des Stars.` : ''}

===== REGELN =====
- Generiere genau 10 Headlines auf DEUTSCH.
- "${seriesName}" MUSS in JEDER Headline vorkommen${detectedAngle === 'nostalgia' ? `, UND der Name "${vars.star || '{STAR}'}" sollte in mindestens 7 von 10 Headlines vorkommen` : ''}.
- Max 95 Zeichen pro Headline, **Sweet-Spot 45–90 Zeichen** (Google Discover Card auf Mobile, 2-3 Zeilen ohne Truncation).
- Nutze die Muster als INSPIRATION, kopiere nicht wörtlich — variiere Wortstellung & Rhythmus.
- Schreibe so, wie ein Mensch bei Quotenmeter, DWDL oder serienjunkies schreiben würde.
- Natürlicher deutscher Satzrhythmus. Keine hohle Euphorie.
- Vermeide diese übernutzten Öffner (nur verwenden wenn der Artikel das WIRKLICH hergibt): "Offiziell:", "Endlich", "Doch noch", "Plötzlich", "Ausgerechnet".
- Keine zwei Headlines dürfen mit demselben Wort beginnen.
- Mindestens 6 verschiedene Angles über die 10 Headlines verteilen.
- Kein Clickbait ohne Deckung im Artikel. Jede Behauptung muss aus dem Content gestützt sein.
- VERBOTEN: Gedankenstriche (— oder –) in Headlines. Das ist ein klassisches KI-Schreibmuster. Nutze stattdessen Doppelpunkt (":"), Komma oder Punkt.

===== PERFORMANCE-COACH (winning vs. safe) =====
Safe Headlines werden indexiert. Winning Headlines werden geklickt. Check pro Kandidat:

1) SCROLL-STOP START — Feed-Karten zeigen die ersten 2–3 Wörter groß.
   ✅ Starte mit: Eigenname ("Jenna Ortega …"), Zahl ("3 Jahre später …"), starkes Verb ("Streicht Netflix …").
   ❌ Starte NICHT mit: "Die", "Der", "Das", "In", "Auf", "Nach", "Mit", "Ist", "Sind" — das tötet die Stopping Power.

2) OPEN LOOP / NEUGIER — Lass einen Teil der Antwort offen, statt alles zu verraten.
   ✅ "Warum {SERIE} {X} tut", "Darum kippt {SERIE} {X}", "Was hinter {X} steckt", "Deshalb verlässt {STAR} {SERIE}".
   ❌ "{SERIE} bekommt Staffel 3 bestätigt" (alles verraten, kein Klick-Grund).

3) EMOTIONALE VERANKERUNG — eine konkrete Emotion, KEINE Hype-Vokabel.
   ✅ Abschied, Rückkehr, Krise, Schock, Wende, Comeback, Verrat, Trauer, Triumph.
   ❌ "Mega", "Unglaublich", "Spektakulär", "Fans dürfen sich freuen" — das ist Boulevard-Müll.

4) STARKES HANDLUNGS-VERB — nicht "ist/hat/gibt/kommt".
   ✅ kippt, streicht, verlässt, feuert, stoppt, bricht, überrascht, verliert, triumphiert, dreht, kehrt zurück, scheitert, trennt sich.
   ❌ "ist offiziell", "gibt bekannt", "kommt zurück" — flach und template-haft.
   ⚠️ "enthüllt", "verrät", "zeigt", "erklärt", "offenbart" sind erlaubt, aber NIEMALS gefolgt von einem Komma + "warum/wie/weshalb/was".
       Das ist die häufigste KI-Formel und sofort als Maschine erkennbar.

5) NATÜRLICHE SPRACHE — kein KI-Smell.
   ❌ VERBOTEN: "offiziell bestätigt", "im Überblick", "verständlich erklärt", "alles was ihr wissen müsst", "mit wichtigen Details".
   ❌ TODES-PATTERN (NIE verwenden):
      • "verändert alles", "ändert alles", "stellt alles auf den Kopf", "alles wird anders", "und alles kippt"
        → leere Hyperbel, signalisiert Maschine.
      • "X enthüllt, warum Y" / "X verrät, wie Y" / "X zeigt, weshalb Y" / "X erklärt, warum Y"
        → reine LLM-Formel. Wenn du diese Struktur brauchst, formuliere sie um:
          ❌ "The Testaments enthüllt, warum Agnes ihre Mutter vergisst"
          ✅ "Warum Agnes in The Testaments ihre Mutter vergisst"
          ✅ "The Testaments löst das Rätsel um Agnes' Mutter"
   ✅ So schreibt ein Mensch: "Brooks verrät seine Romanze mit Rae" statt "Brooks erklärt offiziell die Beziehung zu Rae".

5a) KEINE SCORE-REVEALS IN DER HEADLINE — das ist das Todes-Pattern für Discover.
   Score-Zahlen (Rotten Tomatoes, Metacritic, IMDb-Rating) gehören in die Lead, NICHT in den Titel.
   Sie verraten die komplette Story vorne weg und lassen keinen Grund zu klicken.
   ❌ VERBOTEN: "100 Prozent bei Rotten Tomatoes", "98 % Rotten Tomatoes", "Rotten Tomatoes Score von X",
                "IMDb-Wertung 9,2", "Metacritic 95", "Kritiker-Score von X %", "X % triumphiert",
                "perfekt bei Rotten Tomatoes", "Topwertung bei Rotten Tomatoes".
   ✅ Statt Score nennen → Score IMPLIZIEREN über Emotion:
      "Warum Criminal Record Staffel 2 gerade einen Nerv trifft"        (Score wird in Lead genannt)
      "Darum sind sich Kritiker bei Criminal Record diesmal einig"      (Open Loop zum Score)
      "Criminal Record macht sofort, was wenigen Serien gelingt"        (Prestige ohne Zahl)
   Faustregel: Wenn "Rotten Tomatoes", "Metacritic" oder "%" in der Headline auftaucht → DISQUALIFIZIERT.

5b) KEINE KONKRETEN ZUSCHAUER- / VIEWER-ZAHLEN IN DER HEADLINE.
   Spezifische Zahlen ("26,5 Millionen schauen X", "150.000 Aufrufe", "1,2 Mio Fans") wirken
   maschinell und veralten über Nacht. Abstrahiere sie:
   ❌ VERBOTEN: "26,5 Millionen schauen Marshals", "150.000 Klicks für Trailer", "8 Mio Zuschauer".
   ✅ Statt dessen: "Millionen schauen Marshals — doch warum?", "Hunderttausende klicken den Trailer",
                    "Millionen Fans warten auf Severance".
   AUSNAHME erlaubt: Staffel-/Folgen-/Top-X-/Jahres-Zahlen ("Staffel 3", "Top 10", "2026").

6) KEINE LABEL-TITEL (Colon-Pattern) — "Serie: Staffel X bestätigt" performt 20% schlechter als Aussagesatz.
   ✅ "Wednesday dreht Staffel 3 in Dublin: Was Fans in Paris erwartet"
   ✅ "Warum Wednesday Nevermore verlässt"
   ❌ "Wednesday: Staffel 3 bei Netflix bestätigt"
   ❌ "Warum Wednesday Staffel 3 alles verändert"  ← „alles verändert" ist verboten (Hyperbel)
   (Ausnahme: Nostalgia-Angle darf Doppelpunkt nach Star-Name.)

7) FEED-CTR SANITY — kurz genug, konkret, mind. ein Anker (Zahl, Name, Ort, Zeitangabe).

7a) PFLICHT-NEWS-WERT — JEDE Headline MUSS mindestens EINES enthalten:
    (a) **Klares Ereignis** — etwas IST passiert / passiert konkret jetzt:
        startet, kehrt zurück, stirbt, verlässt, debütiert, premiert, beginnt,
        feuert, castet, übernimmt, dreht, gewinnt, verliert, enthüllt, schockt.
    (b) **Bestätigte Entwicklung** — offizieller Status / Deal-Meldung:
        bestätigt, kündigt an, verkündet, dementiert, verlängert, abgesetzt,
        gecancelt, eingestellt, fix, offiziell, beschlossen, genehmigt.
    (c) **Messbare Veränderung** — konkrete Zahl / Position / Zeitraum:
        "Staffel 5", "Episode 10", "Platz 1", "+200%", "5 Mio Zuschauer",
        "Top 10", "144 Comics", "über 12 Monate".

    HEADLINES, DIE KEINES dieser drei Signale enthalten, WERDEN VERWORFEN.
    Verboten daher: "Hacks bewegt das Publikum" (kein Event/Entwicklung/Zahl),
    "Wednesday bleibt geheimnisvoll" (kein Signal), "Severance ist Kult" (Bewertung).
    Erlaubt: "Hacks erschüttert die Oscar-Jury" (Event=erschüttert), "Wednesday
    Staffel 3 startet im November" (Event+Messbar), "HBO bestätigt Spin-off zu
    Game of Thrones" (Entwicklung).

7b) ERÖFFNUNGS-DIVERSITÄT — VARIIER die ersten Wörter über deine 5 Vorschläge hinweg.
    NIE mehr als 1 von 5 Headlines darf mit "Warum" oder "Darum" beginnen.
    Nutze stattdessen abwechselnd:
    a) **Eigenname + Verb**: "Hacks erschüttert die Oscar-Jury", "Wednesday packt mit Wendung", "The Boys verliert seinen Kern"
    b) **Streamer-Faktenmeldung**: "Netflix bestätigt Staffel 5", "Sky kündigt Spin-off an"
    c) **Zeit-/Orts-Anker**: "Ab Dezember kehrt Wednesday zurück", "In Berlin dreht ZDF neue Serie"
    d) **Frage-Headline**: "Wer überlebt das Finale?", "Wann startet The Bear Staffel 4?"
    e) **Zahl-/Listen-Eröffnung**: "5 Gründe, warum X scheitert", "144 Comics machen Invincible groß"
    f) **Direktes Faktenverb**: "Stranger Things startet ohne Eleven", "Severance enthüllt Sterben-Geheimnis"
    g) Erst zuletzt: **"Warum/Darum"-Hook** — wenn der Aufhänger es WIRKLICH erfordert.

8) KEIN MEINUNGS-SOUND — wir sind eine NEWS-Site, keine Kolumne.
   Headlines dürfen Neugier wecken und Emotion zeigen, aber NIE wie Autoren-Meinung klingen.
   ❌ VERBOTEN: Erste Person ("ich", "mir", "mich", "mein", "unser") — überall in der Headline.
   ❌ VERBOTEN: Imperativ an den Leser ("solltest du sehen", "müsst ihr streamen", "darfst nicht verpassen", "unbedingt schauen").
   ❌ VERBOTEN: Editorialisierender Auftakt — "Endlich …", "Zum Glück …", "Leider …", "Ein Hoch auf …", "Bravo …", "Bitte mehr …".
   ❌ VERBOTEN: Verdikt-Phrasen — "muss man gesehen haben", "gehört zu den besten", "Pflichtprogramm", "ein Muss für", "perfekteste …", "beste Serie aller Zeiten".
   ❌ VERBOTEN: Personal-Stance — "verzaubert mich", "überzeugt mich", "beeindruckt mich", "wie ich finde".
   ✅ ERLAUBT: Drittpersonen-Emotion — "Hacks erschüttert Zuschauer", "Wednesday packt mit Wendung", "Severance spaltet das Publikum".
   ✅ ERLAUBT: Neugier-Hooks — "Warum X scheitert", "Darum kehrt Y zurück", "Wie Z das Finale bricht".
   Faustregel: Schreibe über die SERIE und ihre WIRKUNG auf andere, nicht über DEINE BEZIEHUNG zur Serie.

Gib dir selbst einen Check pro Headline: "Scroll-Stop, Open Loop, Emotion, starkes Verb, natürlich?"
Wenn du 3 oder mehr der 5 Punkte erfüllst, ist es eine Winning-Headline. Strebe das für mindestens 7 der 10 Kandidaten an.

===== BEISPIEL-OUTPUT (Struktur) =====
Topic: "Fallout reaches 100 million viewers months after finale"
→ [
  { "angle": "success",          "text": "Fallout hört einfach nicht auf: selbst jetzt bleibt die Serie ganz vorne", "score": 86 },
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
