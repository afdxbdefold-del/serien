/**
 * HEADLINE ENGINE v3
 * 
 * Pattern-basierte Multi-Variant Headline-Generierung.
 * Weighted Random Selection aus Top 5 statt immer Platz 1.
 * Exploration Mode für mutigere Headlines.
 * 
 * Zielverteilung:
 * - 70% solide Headlines
 * - 20% starke Headlines  
 * - 10% mutige Outlier mit viralem Potenzial
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
}

export interface HeadlineEngineResult {
  winner: HeadlineVariant;
  top3: HeadlineVariant[];
  allVariants: HeadlineVariant[];
  generationTime: number;
  selectionMethod: 'weighted_random' | 'top1';
  explorationMode: boolean;
}

// Weighted selection weights for Top 5
const EXPLORATION_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10]; // Mehr Exploration
const CONSERVATIVE_WEIGHTS = [0.55, 0.25, 0.12, 0.05, 0.03]; // Sicherer

// Anti-AI Filter (leichter als v2 — nur echte Slop-Patterns)
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

/**
 * Weighted random selection aus den Top-N Varianten.
 * Reproduzierbar durch Seed-basiertes Random.
 */
function weightedSelect(variants: HeadlineVariant[], weights: number[]): number {
  const n = Math.min(variants.length, weights.length);
  if (n === 0) return 0;

  // Normalisiere Weights auf tatsächliche Anzahl
  const activeWeights = weights.slice(0, n);
  const sum = activeWeights.reduce((a, b) => a + b, 0);
  const normalized = activeWeights.map(w => w / sum);

  // Pseudo-random basierend auf aktuellem Zeitstempel (reproduzierbar pro Minute)
  const seed = Math.floor(Date.now() / 60000); // Gleiche Minute = gleiche Auswahl
  const pseudoRandom = ((seed * 9301 + 49297) % 233280) / 233280;

  let cumulative = 0;
  for (let i = 0; i < normalized.length; i++) {
    cumulative += normalized[i];
    if (pseudoRandom <= cumulative) return i;
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
  const explorationMode = input.explorationMode !== false; // Default: ON

  const contentSummary = articleContent.substring(0, 1500);
  const entitiesText = [
    entities.persons?.length ? `Personen: ${entities.persons.join(', ')}` : '',
    entities.events?.length ? `Ereignisse: ${entities.events.join(', ')}` : '',
    entities.keywords?.length ? `Keywords: ${entities.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const patternsPrompt = getPatternsForPrompt(seriesName);
  const prompt = buildHeadlinePrompt(originalHeadline, contentSummary, seriesName, entitiesText, patternsPrompt);

  const rawVariants = await callHeadlineLLM(prompt);

  // Score + AI-Slop Penalty (aber kein Block)
  const allTexts = rawVariants.map(v => v.text);
  const scoredVariants: HeadlineVariant[] = rawVariants
    .map(v => {
      const slopPenalty = isAISlop(v.text);
      const result = scoreHeadline(v.text, seriesName, allTexts);

      return {
        text: v.text,
        type: v.type,
        score: slopPenalty ? Math.max(0, result.total - 20) : result.total,
        breakdown: result.breakdown,
        penalties: slopPenalty ? [...result.penalties, 'AI-Slop (-20)'] : result.penalties,
        selected: false,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Weighted Selection aus Top 5
  const weights = explorationMode ? EXPLORATION_WEIGHTS : CONSERVATIVE_WEIGHTS;
  const selectedIndex = weightedSelect(scoredVariants, weights);

  // Mark selected
  if (scoredVariants[selectedIndex]) {
    scoredVariants[selectedIndex].selected = true;
  }

  const winner = scoredVariants[selectedIndex] || scoredVariants[0];
  const top3 = scoredVariants.slice(0, 3);
  const selectionMethod = explorationMode ? 'weighted_random' : 'top1';

  // Logging
  console.log(`\n   🏆 HEADLINE ENGINE v3 ${explorationMode ? '(EXPLORATION)' : '(CONSERVATIVE)'}`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  scoredVariants.forEach((v, i) => {
    const medal = v.selected ? '👉' : i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const risk = v.breakdown.riskScore > 0 ? ` R:${v.breakdown.riskScore}` : '';
    const outlier = v.breakdown.outlierBoost > 0 ? ` O:${v.breakdown.outlierBoost}` : '';
    const boost = v.breakdown.patternBoost > 0 ? ` B:${v.breakdown.patternBoost}` : '';
    console.log(`   ${medal} ${v.score.toString().padStart(3)} | ${v.type.padEnd(11)} | "${v.text}"${risk}${outlier}${boost}`);
    if (v.penalties.length > 0 && i < 5) {
      console.log(`         └─ ${v.penalties.join(' | ')}`);
    }
  });
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   Selected: #${selectedIndex + 1} "${winner.text}" (${winner.score}) via ${selectionMethod}`);
  console.log(`   ⏱️  ${Date.now() - start}ms\n`);

  return {
    winner,
    top3,
    allVariants: scoredVariants,
    generationTime: Date.now() - start,
    selectionMethod,
    explorationMode,
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
- KEINE generischen Phrasen: "sorgt für Aufsehen", "Fans dürfen sich freuen", "das musst du wissen"
- JEDE Headline braucht Spannung: Überraschung ODER Neugier ODER Konflikt ODER Emotion
- KEINE zwei Headlines beginnen mit dem gleichen Wort
- Mindestens 4 Headlines müssen CTR-Booster enthalten: "plötzlich", "überraschend", "doch noch", "trotz", "ausgerechnet", "niemand", "erst...jetzt"

===== WICHTIG =====
Headline #7 (bold) und #8 (wildcard) sollen ANDERS sein als klassische News. Mutig, auffällig, Scroll-Stopper. Nicht generisch-sicher, sondern potenziell viral.

JSON-Array (NUR das, kein Text):
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
