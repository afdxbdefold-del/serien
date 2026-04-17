/**
 * HEADLINE ENGINE v2
 * 
 * Pattern-basierte Multi-Variant Headline-Generierung.
 * Jede Headline MUSS einem High-CTR Pattern entsprechen.
 * 
 * Pipeline:
 * 1. Content wird OHNE Headline generiert
 * 2. Headline Engine generiert 6+ Varianten basierend auf Pattern Library
 * 3. Headline Scorer v2 bewertet alle (inkl. CTR-Boost + Hard Filter)
 * 4. Top 3 werden gespeichert, beste wird Titel
 * 5. Anti-AI Filter entfernt generische Muster
 */

import { scoreHeadline } from './headline-scorer';
import { getPatternsForPrompt, HEADLINE_PATTERNS } from './headline-patterns';

export interface HeadlineVariant {
  text: string;
  type: string;
  score: number;
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

export interface HeadlineEngineResult {
  winner: HeadlineVariant;
  top3: HeadlineVariant[];
  allVariants: HeadlineVariant[];
  generationTime: number;
}

// Anti-AI Filter: Erkennt zu generische LLM-Muster
const AI_SLOP_PATTERNS = [
  /^(die|der|das|eine?)\s+neue\s/i,
  /sorgt für (aufsehen|aufregung|begeisterung|diskussionen)/i,
  /fans (dürfen sich freuen|können sich freuen|aufgepasst)/i,
  /alles was (du|wir|man) wissen (muss|musst|müssen)/i,
  /das (solltest|musst) du (wissen|sehen)/i,
  /jetzt wird es (spannend|ernst|interessant)/i,
  /große (neuigkeiten|überraschung|veränderungen)/i,
  /es ist (soweit|offiziell|endlich soweit)/i,
  /hier (sind|ist|kommt) (die|der|das)/i,
  /was wir bisher wissen/i,
  /neue details (zu|über|enthüllt)/i,
  /das gibt es zu (sagen|berichten)/i,
];

function isAISlop(headline: string): boolean {
  return AI_SLOP_PATTERNS.some(p => p.test(headline));
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
}): Promise<HeadlineEngineResult> {
  const start = Date.now();
  const { originalHeadline, articleContent, seriesName, entities } = input;

  const contentSummary = articleContent.substring(0, 1500);

  const entitiesText = [
    entities.persons?.length ? `Personen: ${entities.persons.join(', ')}` : '',
    entities.events?.length ? `Ereignisse: ${entities.events.join(', ')}` : '',
    entities.keywords?.length ? `Keywords: ${entities.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  // Pattern Library als Prompt
  const patternsPrompt = getPatternsForPrompt(seriesName);

  const prompt = buildHeadlinePrompt(originalHeadline, contentSummary, seriesName, entitiesText, patternsPrompt);
  
  const rawVariants = await callHeadlineLLM(prompt);
  
  // Score alle Varianten
  const allTexts = rawVariants.map(v => v.text);
  const scoredVariants: HeadlineVariant[] = rawVariants
    .map(v => {
      // Anti-AI Filter
      if (isAISlop(v.text)) {
        return {
          text: v.text,
          type: v.type,
          score: 0,
          breakdown: { scrollStop: 0, clarity: 0, curiosity: 0, keyword: 0, length: 0, patternBoost: 0, genericPenalty: -30 },
          penalties: ['AI-SLOP: automatisch disqualifiziert'],
          capped: true,
        };
      }
      
      const result = scoreHeadline(v.text, seriesName, allTexts);
      return {
        text: v.text,
        type: v.type,
        score: result.total,
        breakdown: result.breakdown,
        penalties: result.penalties,
        capped: result.capped,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Top 3 (nur mit Score > 0)
  const top3 = scoredVariants.filter(v => v.score > 0).slice(0, 3);
  const winner = top3[0] || scoredVariants[0];

  console.log(`\n   🏆 HEADLINE ENGINE v2`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  scoredVariants.forEach((v, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const capTag = v.capped ? ' [CAPPED]' : '';
    const slopTag = v.score === 0 && v.penalties.includes('AI-SLOP: automatisch disqualifiziert') ? ' [SLOP]' : '';
    const blockTag = v.penalties.some(p => p.startsWith('BLOCKIERT')) ? ' [BLOCKED]' : '';
    console.log(`   ${medal} ${v.score.toString().padStart(3)} | ${v.type.padEnd(10)} | "${v.text}"${capTag}${slopTag}${blockTag}`);
    if (v.penalties.length > 0 && i < 3) {
      console.log(`         └─ ${v.penalties.join(', ')}`);
    }
  });
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   ⏱️  ${Date.now() - start}ms für ${scoredVariants.length} Varianten\n`);

  return {
    winner,
    top3,
    allVariants: scoredVariants,
    generationTime: Date.now() - start,
  };
}

function buildHeadlinePrompt(originalHeadline: string, content: string, seriesName: string, entities: string, patterns: string): string {
  // Wähle 4 zufällige Pattern-Kategorien für Variation
  const categories = ['surprise', 'twist', 'curiosity', 'conflict', 'impact', 'reaction'];
  
  return `Du bist ein deutscher Headline-Spezialist. Dein EINZIGES Ziel: maximale Click-Through-Rate auf Google Discover.

Jede Headline muss den Nutzer zum Stoppen und Klicken bringen. Nicht informieren — FESSELN.

QUELL-HEADLINE (englisch): "${originalHeadline}"
SERIE: ${seriesName}
${entities ? `ENTITÄTEN:\n${entities}` : ''}

ARTIKEL-INHALT:
${content}

===== PATTERN LIBRARY =====
Du MUSST dich an diese bewährten Muster halten. Jede Headline MUSS einer dieser Strukturen folgen:
${patterns}

===== AUFGABE =====
Generiere genau 8 Headlines auf DEUTSCH. Nutze VERSCHIEDENE Pattern-Kategorien:

1. Typ "surprise" — Überraschungselement, "plötzlich", "niemand hat damit gerechnet"
2. Typ "twist" — Unerwartete Wendung, "doch noch", "anders als gedacht"
3. Typ "curiosity" — Neugier, Informationslücke, "was steckt dahinter", "darum"
4. Typ "conflict" — Konflikt, "trotz", Spannung zwischen zwei Elementen
5. Typ "impact" — Direkte Nachricht mit Punch, "jetzt bestätigt", "offiziell"
6. Typ "reaction" — Reaktion von Fans/Zuschauern
7. Typ "surprise2" — NOCH eine Überraschung, anderer Ansatz als #1
8. Typ "curiosity2" — NOCH eine Neugier-Headline, anderer Ansatz als #3

===== HARTE REGELN =====
- Max 65 Zeichen (NICHT 70!)
- "${seriesName}" MUSS in JEDER Headline vorkommen
- ALLES auf Deutsch. KEINE englischen Wörter (außer Eigennamen wie Netflix, Disney+)
- KEIN Clickbait ohne Deckung im Artikel
- KEINE generischen Phrasen: "sorgt für Aufsehen", "Fans dürfen sich freuen", "das musst du wissen", "neue Details enthüllt", "kommt gut an"
- KEINE Füllwörter: "tatsächlich", "offenbar", "anscheinend", "möglicherweise"
- JEDE Headline braucht EIN Trigger-Element: Überraschung ODER Neugier ODER Konflikt ODER Emotion
- KEINE Headline beginnt mit "${seriesName}:" (Nachrichtenagentur-Stil)
- KEINE zwei Headlines beginnen mit dem gleichen Wort
- Mindestens 3 Headlines müssen "plötzlich", "überraschend", "doch noch" oder "niemand" enthalten

===== CTR-BOOSTER WÖRTER (VERWENDE SIE!) =====
"plötzlich", "überraschend", "niemand hat damit gerechnet", "doch noch", "anders als gedacht", "gegen alle Erwartungen", "ausgerechnet", "trotz", "erstmals"

Antworte NUR mit JSON-Array:
[
  {"type": "surprise", "text": "..."},
  {"type": "twist", "text": "..."},
  {"type": "curiosity", "text": "..."},
  {"type": "conflict", "text": "..."},
  {"type": "impact", "text": "..."},
  {"type": "reaction", "text": "..."},
  {"type": "surprise2", "text": "..."},
  {"type": "curiosity2", "text": "..."}
]`;
}

async function callHeadlineLLM(prompt: string): Promise<Array<{ type: string; text: string }>> {
  try {
    const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
    const client = createLLMClient();
    const config = getLLMConfig();

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.95, // Maximale Kreativität
      messages: [
        {
          role: 'system',
          content: 'Du bist ein deutscher Headline-Spezialist für Google Discover. Dein Ziel: maximale Klickrate. Antworte NUR mit validem JSON-Array. Kein Markdown, kein Text.',
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
