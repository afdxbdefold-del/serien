/**
 * HEADLINE ENGINE v1
 * 
 * Separate Headline-Generierung mit Multi-Variant-Approach.
 * Generiert 5-8 Headlines in verschiedenen Stiltypen,
 * scored sie automatisch und wählt die beste aus.
 * 
 * Pipeline:
 * 1. Content wird OHNE Headline generiert
 * 2. Headline Engine generiert 6 Varianten (eine pro Typ)
 * 3. Headline Scorer bewertet alle
 * 4. Beste wird als Titel genommen, alle werden gespeichert
 */

import { scoreHeadline } from './headline-scorer';

export interface HeadlineVariant {
  text: string;
  type: string;
  score: number;
  breakdown: {
    curiosity: number;
    clarity: number;
    uniqueness: number;
    emotion: number;
    keyword: number;
    length: number;
  };
  penalties: string[];
}

export interface HeadlineEngineResult {
  winner: HeadlineVariant;
  allVariants: HeadlineVariant[];
  generationTime: number;
}

// Die 6 erzwungenen Headline-Typen
const HEADLINE_TYPES = [
  {
    id: 'surprise',
    label: 'Überraschung',
    instruction: 'Beginne mit einem überraschenden Element. Etwas Unerwartetes. Beispiele: "Plötzlich ist alles anders:", "Niemand hat damit gerechnet:", "Gegen alle Erwartungen:"',
    examples: [
      'Plötzlich abgesetzt: [Serie] verliert Staffel 4',
      'Niemand hat damit gerechnet: [Serie] kehrt nach 5 Jahren zurück',
    ],
  },
  {
    id: 'curiosity',
    label: 'Neugier',
    instruction: 'Erzeuge eine Informationslücke. Der Leser MUSS klicken um die Antwort zu erfahren. KEIN Clickbait — die Info muss im Artikel stehen. Beispiele: "Was hinter ... steckt", "Der wahre Grund für...", "Das steckt dahinter:"',
    examples: [
      'Was wirklich hinter dem [Serie]-Aus steckt',
      'Darum schweigt Netflix zur [Serie]-Zukunft',
    ],
  },
  {
    id: 'factual',
    label: 'Faktisch stark',
    instruction: 'Harte Fakten, konkrete Zahlen, offizielle Bestätigungen. Kurz, knackig, Nachrichtenstil. Beispiele: "Jetzt bestätigt:", "Offiziell:", "100% bei Rotten Tomatoes:"',
    examples: [
      'Jetzt bestätigt: [Serie] Staffel 3 kommt im Oktober',
      '[Serie] erreicht 100% bei Rotten Tomatoes — und das ist kein Zufall',
    ],
  },
  {
    id: 'emotion',
    label: 'Emotion / Reaktion',
    instruction: 'Fokus auf die emotionale Reaktion. Wie reagieren Fans, Kritiker, Beteiligte? Beispiele: "Fans rasten aus:", "Kontroverse um...", "Tränen am Set:"',
    examples: [
      'Fans rasten aus: [Serie] ändert das Finale komplett',
      'Kontroverse um [Serie]: Showrunner verteidigt umstrittene Szene',
    ],
  },
  {
    id: 'direct',
    label: 'Direkt mit Twist',
    instruction: 'Klassische Nachricht, aber mit einem unerwarteten Twist oder Detail. Nicht generisch — ein konkretes Detail das überrascht.',
    examples: [
      '[Serie] Staffel 4 startet — aber ohne den Hauptdarsteller',
      'Netflix verlängert [Serie], doch der Showrunner steigt aus',
    ],
  },
  {
    id: 'contrast',
    label: 'Kontrast / Spannung',
    instruction: 'Zwei gegensätzliche Elemente in einer Headline. Erzeugt Spannung durch Widerspruch. Beispiele: "Trotz Rekordquoten:", "Obwohl alle dagegen waren:", "Erst gefeiert, dann..."',
    examples: [
      'Trotz Rekordquoten: [Serie] wird nicht verlängert',
      'Erst gefeiert, jetzt abgesetzt: [Serie] überlebt Staffel 2 nicht',
    ],
  },
];

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

  // Kürze Content für den Prompt (nur die wichtigsten Fakten)
  const contentSummary = articleContent.substring(0, 1500);

  const entitiesText = [
    entities.persons?.length ? `Personen: ${entities.persons.join(', ')}` : '',
    entities.events?.length ? `Ereignisse: ${entities.events.join(', ')}` : '',
    entities.keywords?.length ? `Keywords: ${entities.keywords.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  // Ein LLM-Call, 6 Varianten gleichzeitig
  const prompt = buildHeadlinePrompt(originalHeadline, contentSummary, seriesName, entitiesText);
  
  const rawVariants = await callHeadlineLLM(prompt);
  
  // Score alle Varianten
  const allTexts = rawVariants.map(v => v.text);
  const scoredVariants: HeadlineVariant[] = rawVariants
    .map(v => {
      // Anti-AI Filter
      if (isAISlop(v.text)) {
        return {
          ...v,
          score: 0,
          breakdown: { curiosity: 0, clarity: 0, uniqueness: 0, emotion: 0, keyword: 0, length: 0 },
          penalties: ['AI-Slop erkannt — automatisch disqualifiziert'],
        };
      }
      
      const result = scoreHeadline(v.text, seriesName, allTexts);
      return {
        text: v.text,
        type: v.type,
        score: result.total,
        breakdown: result.breakdown,
        penalties: result.penalties,
      };
    })
    .sort((a, b) => b.score - a.score);

  const winner = scoredVariants[0];

  console.log(`   🏆 Headline Engine: ${scoredVariants.length} Varianten generiert`);
  console.log(`   🥇 Winner (${winner.score}): "${winner.text}" [${winner.type}]`);
  scoredVariants.slice(1, 4).forEach((v, i) => {
    console.log(`   ${i === 0 ? '🥈' : i === 1 ? '🥉' : '  '} (${v.score}): "${v.text}" [${v.type}]`);
  });
  if (winner.penalties.length > 0) {
    console.log(`   ⚠️ Penalties: ${winner.penalties.join(', ')}`);
  }

  return {
    winner,
    allVariants: scoredVariants,
    generationTime: Date.now() - start,
  };
}

function buildHeadlinePrompt(originalHeadline: string, content: string, seriesName: string, entities: string): string {
  const types = HEADLINE_TYPES.map((t, i) => 
    `${i + 1}. Typ "${t.id}" (${t.label}):\n   ${t.instruction}\n   Beispiele: ${t.examples.map(e => e.replace('[Serie]', seriesName)).join(' | ')}`
  ).join('\n\n');

  return `Du bist ein deutscher Headline-Spezialist für Google Discover. Dein einziges Ziel: maximale Click-Through-Rate.

QUELL-HEADLINE (englisch): "${originalHeadline}"
SERIE: ${seriesName}
${entities ? `ENTITÄTEN:\n${entities}` : ''}

ARTIKEL-INHALT (Zusammenfassung):
${content}

AUFGABE: Generiere genau 6 Headlines auf DEUTSCH. Jede mit einem ANDEREN Stil-Typ:

${types}

HARTE REGELN:
- Max 65 Zeichen pro Headline (NICHT 70 — kürzer ist besser!)
- "${seriesName}" MUSS in JEDER Headline vorkommen
- ALLES auf Deutsch. KEINE englischen Wörter (außer Eigennamen)
- KEIN Clickbait: Jede Headline muss durch den Artikel gedeckt sein
- KEINE generischen Phrasen: "sorgt für Aufsehen", "Fans dürfen sich freuen", "das musst du wissen"
- KEINE Füllwörter: "tatsächlich", "wirklich", "offenbar", "möglicherweise"
- Jede Headline braucht EIN klares Trigger-Element: Überraschung ODER neue Info ODER Konflikt ODER Emotion
- KEINE zwei Headlines dürfen mit dem gleichen Wort beginnen
- Vermeide Fragezeichen (außer bei Typ "curiosity")

Antworte NUR mit einem JSON-Array. Keine Erklärungen, kein Markdown:
[
  {"type": "surprise", "text": "..."},
  {"type": "curiosity", "text": "..."},
  {"type": "factual", "text": "..."},
  {"type": "emotion", "text": "..."},
  {"type": "direct", "text": "..."},
  {"type": "contrast", "text": "..."}
]`;
}

async function callHeadlineLLM(prompt: string): Promise<Array<{ type: string; text: string }>> {
  try {
    const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
    const client = createLLMClient();
    const config = getLLMConfig();

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.9, // Höhere Temperature für kreativere Headlines
      messages: [
        {
          role: 'system',
          content: 'Du bist ein deutscher Headline-Spezialist für Google Discover. Antworte NUR mit validem JSON-Array. Kein Markdown, kein Text drumherum.',
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
