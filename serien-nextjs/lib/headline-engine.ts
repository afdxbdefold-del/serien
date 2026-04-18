/**
 * HEADLINE ENGINE v4
 * 
 * Feintuning: Outlier-Qualität, flachere Gewichtung, Mindestqualität.
 * 
 * Änderungen vs v3:
 * - Gewichtung flacher: 25/25/20/15/15 statt 30/25/20/15/10
 * - Mindestqualität: score < 40 → raus aus Auswahl
 * - Logging: selectedRank, wasOutlier, hadContrast, hadGenericPenalty
 * - explorationMode default ON
 */

import { scoreHeadlineV5, pickWinnerV5, type HeadlineScoreV5Result, type ArticleContext } from './headline-scorer-v5';
import { getPatternsForPrompt } from './headline-patterns';

export interface HeadlineVariant {
  text: string;
  type: string;
  score: number;
  componentScores: HeadlineScoreV5Result['componentScores'];
  penalties: HeadlineScoreV5Result['penalties'];
  boosts: HeadlineScoreV5Result['boosts'];
  ceilingApplied: string | null;
  selected: boolean;
  meta: HeadlineScoreV5Result['meta'];
  relativeOutlierBonus: number;
  passedMinimum: boolean;
  isStrongCandidate: boolean;
  // CTR-Learning
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
}

// Flachere Gewichtung — jetzt in v5 pickWinnerV5 integriert
const EXPLORATION_WEIGHTS = [0.25, 0.25, 0.20, 0.15, 0.15];
const CONSERVATIVE_WEIGHTS = [0.45, 0.25, 0.15, 0.10, 0.05];

// Mindestqualität v5
const MIN_SCORE = 55;

// Anti-AI Filter (nur echte Slop)
const AI_SLOP_PATTERNS = [
  /alles was (du|wir|man) wissen (muss|musst|müssen)/i,
  /das (solltest|musst) du (wissen|sehen)/i,
  /jetzt wird es (spannend|ernst|interessant)/i,
  /hier (sind|ist|kommt) (die|der|das)/i,
  /was wir bisher wissen/i,
  /das gibt es zu (sagen|berichten)/i,
];

function isAISlop(headline: string): boolean {
  return AI_SLOP_PATTERNS.some(p => p.test(headline));
}

function weightedSelect(count: number, weights: number[]): number {
  const n = Math.min(count, weights.length);
  if (n === 0) return 0;

  const active = weights.slice(0, n);
  const sum = active.reduce((a, b) => a + b, 0);
  const norm = active.map(w => w / sum);

  const seed = Math.floor(Date.now() / 60000);
  const rand = ((seed * 9301 + 49297) % 233280) / 233280;

  let cum = 0;
  for (let i = 0; i < norm.length; i++) {
    cum += norm[i];
    if (rand <= cum) return i;
  }
  return 0;
}

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

  const contentSummary = articleContent.substring(0, 1500);
  const entitiesText = [
    entities.persons?.length ? `Personen: ${entities.persons.join(', ')}` : '',
    entities.events?.length ? `Ereignisse: ${entities.events.join(', ')}` : '',
    entities.keywords?.length ? `Keywords: ${entities.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const patternsPrompt = getPatternsForPrompt(seriesName);
  const prompt = buildHeadlinePrompt(originalHeadline, contentSummary, seriesName, entitiesText, patternsPrompt, preserveOriginalStyle);

  const rawVariants = await callHeadlineLLM(prompt);

  // === v5 SCORING ===
  const allTexts = rawVariants.map(v => v.text);
  const context: ArticleContext = {
    seriesName,
    persons: entities.persons,
    keywords: entities.keywords,
  };

  const v5Result = pickWinnerV5(allTexts, context);

  // Map to HeadlineVariant
  const scoredVariants: HeadlineVariant[] = rawVariants.map(v => {
    const v5 = v5Result.ranked.find(r => r.headline === v.text);
    const isSelected = v5Result.winner.headline === v.text;
    const slopHit = isAISlop(v.text);

    if (!v5) {
      return {
        text: v.text, type: v.type, score: 0,
        componentScores: { hookStrength: 0, topicClarity: 0, specificity: 0, riskConflict: 0, contrastPattern: 0, ctrPrediction: 0 },
        penalties: [], boosts: [], ceilingApplied: null, selected: isSelected,
        meta: { hasEntity: false, hasSpecificEvent: false, hasRealConflict: false, hasConditionalContrast: false, seriesStartHandling: 'not_applicable' as const },
        relativeOutlierBonus: 0, passedMinimum: false, isStrongCandidate: false,
        impressions: 0, clicks: 0, ctr: 0,
      };
    }

    const finalScore = slopHit ? Math.max(0, v5.finalScore - 15) : v5.finalScore;

    return {
      text: v.text, type: v.type, score: finalScore,
      componentScores: v5.componentScores,
      penalties: slopHit ? [...v5.penalties, { type: 'ai_slop', phrase: 'AI-Slop', value: -15 }] : v5.penalties,
      boosts: v5.boosts, ceilingApplied: v5.ceilingApplied, selected: isSelected,
      meta: v5.meta, relativeOutlierBonus: v5.relativeOutlierBonus,
      passedMinimum: finalScore >= MIN_SCORE, isStrongCandidate: finalScore >= 70,
      impressions: 0, clicks: 0, ctr: 0,
    };
  }).sort((a, b) => b.score - a.score);

  const winner = scoredVariants.find(v => v.selected) || scoredVariants[0];
  const top3 = scoredVariants.filter(v => v.passedMinimum).slice(0, 3);
  const selectedRank = scoredVariants.findIndex(v => v.selected) + 1;

  // Logging
  console.log(`\n   🏆 HEADLINE ENGINE v5 ${explorationMode ? '(EXPLORATION)' : '(CONSERVATIVE)'}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   HOK TOP SPE RSK CON CTR OLR = TOT | Headline`);
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
    if (v.meta.hasConditionalContrast) flags.push('CON');
    if (v.meta.hasRealConflict) flags.push('RSK');
    const flagStr = flags.length ? ` [${flags.join(' ')}]` : '';
    console.log(`   ${sel} ${cols} = ${v.score.toString().padStart(3)} | "${v.text}"${flagStr}`);
    const penStr = v.penalties.filter(p => p.value < -5).map(p => `${p.phrase}(${p.value})`).join(', ');
    if (penStr) console.log(`                                          └─ ${penStr}`);
  });
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Selected: #${selectedRank} "${winner.text}" (${winner.score})${v5Result.filteredOut > 0 ? ` | ${v5Result.filteredOut} unter Minimum` : ''}`);
  console.log(`   ⏱️  ${Date.now() - start}ms\n`);

  return {
    winner,
    top3,
    allVariants: scoredVariants,
    generationTime: Date.now() - start,
    selectionMethod: explorationMode ? 'weighted_random' : 'conservative',
    explorationMode,
    selectedRank,
  };
}

function buildHeadlinePrompt(originalHeadline: string, content: string, seriesName: string, entities: string, patterns: string, preserveOriginalStyle = false): string {
  const preserveNote = preserveOriginalStyle ? `

===== QUELL-STIL BEWAHREN =====
Die Quell-Headline ist bewusst nicht-reißerisch und faktisch. Bewahre diesen Stil:
- Kernaussage der Quell-Headline beibehalten (nicht verdrehen oder neu framen)
- Keine Hinzufügung von "plötzlich", "überraschend", "niemand hat gerechnet", wenn die Quelle sie nicht enthält
- Bleibe semantisch nah am englischen Original — übersetze und adaptiere, erfinde nicht neu
- Kontrast-Muster und bold/wildcard Varianten nur dann, wenn die Artikel-Fakten das wirklich hergeben
- Die deutsche Headline sollte für jemanden, der das englische Original kennt, als die gleiche Nachricht erkennbar sein
` : '';

  return `Du bist ein deutscher Headline-Spezialist. Dein EINZIGES Ziel: maximale Click-Through-Rate auf Google Discover.

Jede Headline muss den Nutzer zum Stoppen und Klicken bringen. Nicht informieren — FESSELN.

QUELL-HEADLINE (englisch): "${originalHeadline}"
SERIE: ${seriesName}
${entities ? `ENTITÄTEN:\n${entities}` : ''}

ARTIKEL-INHALT:
${content}${preserveNote}

===== PATTERN LIBRARY =====
Nutze diese bewährten Muster als Inspiration. Du darfst auch EIGENE kreative Strukturen verwenden, solange sie klickstark sind:
${patterns}

===== AUFGABE =====
Generiere genau 8 Headlines auf DEUTSCH. Mische verschiedene Stile:

1. "surprise" — Überraschung: "plötzlich", "niemand hat damit gerechnet"
2. "twist" — Unerwartete Wendung: "doch noch", "anders als gedacht", "gegen alle Erwartungen"
3. "curiosity" — Neugier: "was steckt dahinter", "darum", "der wahre Grund"
4. "conflict" — Konflikt/Kontrast: "trotz", "erst gefeiert jetzt umstritten", "spaltet"
5. "impact" — Direkt mit Punch: "jetzt bestätigt", "offiziell", "endgültig"
6. "reaction" — Emotionale Reaktion: Fans, Kontroverse, Diskussion
7. "bold" — MUTIG: Ungewöhnliche Struktur, provokant aber glaubwürdig, Scroll-Stopper
8. "wildcard" — DEIN bester Versuch: Vergiss alle Regeln, schreib die klickstärkste Headline die du kannst

===== REGELN =====
- Max 65 Zeichen pro Headline
- "${seriesName}" MUSS in JEDER Headline vorkommen
- ALLES auf Deutsch (Eigennamen ausgenommen)
- KEIN Clickbait ohne Deckung im Artikel
- KEINE generischen Phrasen: "sorgt für Aufsehen", "Fans dürfen sich freuen", "das musst du wissen", "kommt bald"
- JEDE Headline braucht Spannung: Überraschung ODER Neugier ODER Konflikt ODER Emotion
- KEINE zwei Headlines beginnen mit dem gleichen Wort
- Mindestens 4 Headlines müssen CTR-Booster enthalten: "plötzlich", "überraschend", "doch noch", "trotz", "ausgerechnet", "niemand", "erst...jetzt"

===== KONTRAST-HEADLINES BEVORZUGEN =====
Headlines mit Kontrast performen am besten. Nutze Muster wie:
- "Erst gefeiert, jetzt umstritten: [Serie]..."
- "Trotz [Erfolg]: [Serie] macht [Überraschendes]"
- "Doch noch: [Serie] [unerwartete Wendung]"
- "Niemand hat damit gerechnet – [Serie]..."

Mindestens 3 von 8 Headlines MÜSSEN ein Kontrast-Element haben.

===== WICHTIG =====
Headline #7 (bold) und #8 (wildcard) sollen ANDERS sein. Mutig, auffällig, Scroll-Stopper. Nicht generisch, sondern potenziell viral.

JSON-Array (NUR das):
[
  {"type": "surprise", "text": "..."},
  {"type": "twist", "text": "..."},
  {"type": "curiosity", "text": "..."},
  {"type": "conflict", "text": "..."},
  {"type": "impact", "text": "..."},
  {"type": "reaction", "text": "..."},
  {"type": "bold", "text": "..."},
  {"type": "wildcard", "text": "..."}
]`;
}

async function callHeadlineLLM(prompt: string): Promise<Array<{ type: string; text: string }>> {
  try {
    const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
    const client = createLLMClient();
    const config = getLLMConfig();

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.95,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein deutscher Headline-Spezialist für Google Discover. Maximale Klickrate. Antworte NUR mit validem JSON-Array.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const text = response.choices?.[0]?.message?.content?.trim() || '';
    const parsed = parseLLMJson(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item: any) => item.text && item.type)
      .map((item: any) => ({
        type: String(item.type),
        text: String(item.text).trim(),
      }));
  } catch (error: any) {
    console.error('Headline LLM call failed:', error.message);
    return [];
  }
}
