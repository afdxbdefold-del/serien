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

import { scoreHeadline, type HeadlineScoreResult } from './headline-scorer';
import { getPatternsForPrompt } from './headline-patterns';

export interface HeadlineVariant {
  text: string;
  type: string;
  score: number;
  breakdown: HeadlineScoreResult['breakdown'];
  penalties: string[];
  selected: boolean;
  // Logging
  meta: {
    wasOutlier: boolean;
    hadContrast: boolean;
    hadGenericPenalty: boolean;
    riskMultiplier: number;
  };
  // CTR-Learning prepared
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

// Flachere Gewichtung: mehr Exploration
const EXPLORATION_WEIGHTS = [0.25, 0.25, 0.20, 0.15, 0.15];
const CONSERVATIVE_WEIGHTS = [0.45, 0.25, 0.15, 0.10, 0.05];

// Mindestqualität
const MIN_SCORE = 40;

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
}): Promise<HeadlineEngineResult> {
  const start = Date.now();
  const { originalHeadline, articleContent, seriesName, entities } = input;
  const explorationMode = input.explorationMode !== false;

  const contentSummary = articleContent.substring(0, 1500);
  const entitiesText = [
    entities.persons?.length ? `Personen: ${entities.persons.join(', ')}` : '',
    entities.events?.length ? `Ereignisse: ${entities.events.join(', ')}` : '',
    entities.keywords?.length ? `Keywords: ${entities.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const patternsPrompt = getPatternsForPrompt(seriesName);
  const prompt = buildHeadlinePrompt(originalHeadline, contentSummary, seriesName, entitiesText, patternsPrompt);

  const rawVariants = await callHeadlineLLM(prompt);

  // Score alle
  const allTexts = rawVariants.map(v => v.text);
  const scoredVariants: HeadlineVariant[] = rawVariants
    .map(v => {
      const slopHit = isAISlop(v.text);
      const result = scoreHeadline(v.text, seriesName, allTexts);
      const adjustedScore = slopHit ? Math.max(0, result.total - 20) : result.total;

      return {
        text: v.text,
        type: v.type,
        score: adjustedScore,
        breakdown: result.breakdown,
        penalties: slopHit ? [...result.penalties, 'AI-Slop (-20)'] : result.penalties,
        selected: false,
        meta: result.meta,
        impressions: 0,
        clicks: 0,
        ctr: 0,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Mindestqualität: score >= 40
  const eligible = scoredVariants.filter(v => v.score >= MIN_SCORE);

  // Fallback: wenn alle unter 40, nimm die beste
  const selectionPool = eligible.length > 0 ? eligible : scoredVariants;

  // Weighted Selection
  const weights = explorationMode ? EXPLORATION_WEIGHTS : CONSERVATIVE_WEIGHTS;
  const selectedIndex = weightedSelect(selectionPool.length, weights);

  // Mark selected in original array
  const selectedVariant = selectionPool[selectedIndex] || selectionPool[0];
  const globalIndex = scoredVariants.findIndex(v => v.text === selectedVariant.text);
  if (globalIndex >= 0) scoredVariants[globalIndex].selected = true;

  const winner = selectedVariant;
  const top3 = scoredVariants.filter(v => v.score >= MIN_SCORE).slice(0, 3);
  const selectedRank = globalIndex + 1;

  // Logging
  const filteredCount = scoredVariants.length - eligible.length;
  console.log(`\n   🏆 HEADLINE ENGINE v4 ${explorationMode ? '(EXPLORATION)' : '(CONSERVATIVE)'}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  scoredVariants.forEach((v, i) => {
    const sel = v.selected ? '👉' : '  ';
    const medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : (i + 1).toString();
    const flags: string[] = [];
    if (v.meta.wasOutlier) flags.push('OL');
    if (v.meta.hadContrast) flags.push('CON');
    if (v.breakdown.contrastBoost > 0) flags.push('+12c');
    if (v.breakdown.riskScore > 0) flags.push(`R${v.breakdown.riskScore}×${v.meta.riskMultiplier}`);
    if (v.breakdown.ctrPrediction !== 0) flags.push(`CTR${v.breakdown.ctrPrediction > 0 ? '+' : ''}${v.breakdown.ctrPrediction}`);
    if (v.score < MIN_SCORE) flags.push('⊘');
    const flagStr = flags.length ? ` [${flags.join(' ')}]` : '';
    console.log(`   ${sel} ${medal.padStart(2)}. ${v.score.toString().padStart(3)} | ${v.type.padEnd(11)} | "${v.text}"${flagStr}`);
  });
  if (filteredCount > 0) {
    console.log(`   ⊘ ${filteredCount} Variante(n) unter Mindestqualität (${MIN_SCORE})`);
  }
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Selected: #${selectedRank} "${winner.text}" (${winner.score}) via ${explorationMode ? 'weighted_random' : 'conservative'}`);
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

function buildHeadlinePrompt(originalHeadline: string, content: string, seriesName: string, entities: string, patterns: string): string {
  return `Du bist ein deutscher Headline-Spezialist. Dein EINZIGES Ziel: maximale Click-Through-Rate auf Google Discover.

Jede Headline muss den Nutzer zum Stoppen und Klicken bringen. Nicht informieren — FESSELN.

QUELL-HEADLINE (englisch): "${originalHeadline}"
SERIE: ${seriesName}
${entities ? `ENTITÄTEN:\n${entities}` : ''}

ARTIKEL-INHALT:
${content}

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
