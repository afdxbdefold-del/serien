/**
 * INTRO ENGINE v1
 * 
 * Generates 6 intro variants based on different psychological patterns.
 * Each intro = max 3 sentences, must continue headline logic.
 * 
 * Types: impact, conflict, surprise, factual, emotional, curiosity
 * 
 * Scores all variants with intro-scorer and picks the best.
 */

import { scoreIntro, type IntroScoreResult } from './intro-scorer';
import { stripDashes } from './strip-dashes';

export interface IntroVariant {
  type: string;
  text: string;
  score: number;
  boosts: IntroScoreResult['boosts'];
  penalties: IntroScoreResult['penalties'];
  selected: boolean;
}

export interface IntroEngineResult {
  winner: IntroVariant;
  allVariants: IntroVariant[];
  generationTime: number;
}

const INTRO_TYPES = [
  {
    id: 'impact',
    instruction: 'Starte mit der größten AUSWIRKUNG dieser Nachricht. Was ändert sich konkret? Satz 1 = Konsequenz. Satz 2 = Fakten (Cast, Plattform). Satz 3 = Warum das für Zuschauer relevant ist.',
  },
  {
    id: 'conflict',
    instruction: 'Starte mit dem KONFLIKT oder Widerspruch. Was steht im Gegensatz zueinander? Satz 1 = Der Bruch/Konflikt. Satz 2 = Konkrete Fakten dazu. Satz 3 = Was das für die Zukunft bedeutet.',
  },
  {
    id: 'surprise',
    instruction: 'Starte mit dem ÜBERRASCHUNGSMOMENT. Was ist unerwartet? Satz 1 = Die Überraschung selbst. Satz 2 = Hintergrund/Fakten. Satz 3 = Einordnung warum das überrascht.',
  },
  {
    id: 'factual',
    instruction: 'Starte mit dem HÄRTESTEN Fakt. Keine Einleitung, direkt das Wichtigste. Satz 1 = Kernfakt (Wer macht Was). Satz 2 = Details (Wann, Wo, Mit wem). Satz 3 = Was das bedeutet.',
  },
  {
    id: 'emotional',
    instruction: 'Starte mit der EMOTIONALEN Reaktion. Wie fühlt sich das für Fans an? Satz 1 = Emotionale Konsequenz. Satz 2 = Was genau passiert ist. Satz 3 = Was Fans jetzt erwartet.',
  },
  {
    id: 'curiosity',
    instruction: 'Starte mit einer OFFENEN FRAGE oder Unklarheit. Was ist noch unklar? Satz 1 = Was jetzt in der Schwebe ist. Satz 2 = Was bekannt ist. Satz 3 = Was das für Zuschauer heißt.',
  },
];

export async function generateIntroVariants(input: {
  headline: string;
  headlineType?: string;
  seriesName: string;
  facts: string;
  articleContent?: string;
}): Promise<IntroEngineResult> {
  const start = Date.now();
  const { headline, headlineType, seriesName, facts, articleContent } = input;

  const prompt = buildIntroPrompt(headline, seriesName, facts, articleContent);
  const rawVariants = await callIntroLLM(prompt, input.seriesName);

  // Score all
  const scored: IntroVariant[] = rawVariants.map(v => {
    const result = scoreIntro(v.text, headlineType || v.type);
    return {
      type: v.type,
      text: v.text,
      score: result.score,
      boosts: result.boosts,
      penalties: result.penalties,
      selected: false,
    };
  }).sort((a, b) => b.score - a.score);

  // Pick best
  if (scored.length > 0) {
    scored[0].selected = true;
  }
  const winner = scored[0] || { type: 'fallback', text: '', score: 0, boosts: [], penalties: [], selected: true };

  // Log
  console.log(`\n   📝 INTRO ENGINE v1`);
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  scored.forEach(v => {
    const sel = v.selected ? '👉' : '  ';
    console.log(`   ${sel} ${v.score.toString().padStart(3)} | ${v.type.padEnd(10)} | "${v.text.substring(0, 80)}..."`);
  });
  console.log(`   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`   ⏱️  ${Date.now() - start}ms\n`);

  return {
    winner,
    allVariants: scored,
    generationTime: Date.now() - start,
  };
}

function buildIntroPrompt(headline: string, seriesName: string, facts: string, articleContent?: string): string {
  const typesBlock = INTRO_TYPES.map((t, i) =>
    `${i + 1}. Typ "${t.id}":\n   ${t.instruction}`
  ).join('\n\n');

  const contentSnippet = articleContent ? articleContent.substring(0, 800) : '';

  return `Du generierst 6 verschiedene Intros (Leads) für einen deutschen Serien-Artikel.

HEADLINE: "${headline}"
SERIE: ${seriesName}
FAKTEN: ${facts}
${contentSnippet ? `ARTIKEL-KONTEXT:\n${contentSnippet}` : ''}

AUFGABE: Generiere genau 6 Intro-Varianten. Jede mit einem anderen psychologischen Muster:

${typesBlock}

HARTE REGELN FÜR JEDES INTRO:
- EXAKT 3 Sätze. Nicht mehr, nicht weniger.

SATZ 1 (HOOK):
- MAXIMAL 12 Wörter. Kurz, hart, direkt.
- MUSS einen Hook enthalten: Kontrast, Überraschung, Ranking oder Zahl.
- VERBOTEN: Gedankenstriche (— oder –). Nutze stattdessen Doppelpunkt, Komma oder Punkt.
- Beispiele:
  GUT: "Platz 3 weltweit, und das nach nur einer Woche."
  GUT: "Abgesetzt trotz Rekordquoten."
  GUT: "97% bei Rotten Tomatoes sprechen für sich."
  SCHLECHT: "Platz 3 weltweit — und das nach nur einer Woche."
  SCHLECHT: "Jahrelang galt die Verfilmung als gescheitert, doch nun..."
  SCHLECHT: "Die neue Serie hat sich überraschenderweise als sehr erfolgreich erwiesen."

SATZ 2 (FAKTEN):
- Konkrete Info: Platz, Startdatum, Plattform, Cast, Staffelzahl.
- Keine Wiederholung von Satz 1.

SATZ 3 (RELEVANZ):
- Warum das relevant ist: Erfolg, Kritik, Trend, Fan-Reaktion.

STRIKT VERBOTEN:
- Einleitungen wie "Jahrelang galt", "Seit langem", "Schon immer"
- Verschachtelte Sätze (max 1 Komma pro Satz)
- Füllwörter: "tatsächlich", "offenbar", "gewissermaßen", "eigentlich"
- NICHT mit Quelle starten: "Paramount hat...", "Netflix gab bekannt...", "Laut Berichten..."
- NICHT mit Zeitangabe starten: "In Staffel 2...", "Am 15. Mai..."
- NICHT neutral starten: "Es gibt Neuigkeiten...", "Es wurde bekannt..."
- NICHT die Headline wiederholen oder umformulieren
- KEIN Intro das auf JEDEN beliebigen Artikel passen würde
- ALLES auf Deutsch

Das Intro MUSS die Headline-Logik FORTSETZEN:
- Headline = Konflikt → Intro = Konsequenz des Konflikts
- Headline = Überraschung → Intro = Bestätigung + Erweiterung
- Headline = Veränderung → Intro = Was sich konkret ändert

JSON-Array (NUR das):
[
  {"type": "impact", "text": "..."},
  {"type": "conflict", "text": "..."},
  {"type": "surprise", "text": "..."},
  {"type": "factual", "text": "..."},
  {"type": "emotional", "text": "..."},
  {"type": "curiosity", "text": "..."}
]`;
}

async function callIntroLLM(prompt: string, seriesName: string): Promise<Array<{ type: string; text: string }>> {
  try {
    const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
    const client = createLLMClient();
    const config = getLLMConfig();

    const response = await client.chat.completions.create({
      model: config.model,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: 'Du bist ein deutscher Lead-Texter für serien.de. Schreibe packende, konkrete Intros. Antworte NUR mit validem JSON-Array.',
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
        // Strip em/en-dashes (AI-tell), preserve series names with dashes
        text: stripDashes(String(item.text).trim(), [seriesName]),
      }));
  } catch (error: any) {
    console.error('Intro LLM call failed:', error.message);
    return [];
  }
}
