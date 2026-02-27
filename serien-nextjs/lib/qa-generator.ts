/**
 * Q&A Generator for Articles and Series Pages
 * 
 * RULES:
 * - German only, neutral journalistic tone
 * - Factual answers only (max 90 words)
 * - No duplication with article body
 * - FAQPage schema only if factual
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EMERGENT_LLM_KEY,
  baseURL: 'https://integrations.emergentagent.com/openai/v1',
});

export interface QAItem {
  question: string;
  answer: string;
  factual: boolean; // true = include in schema, false = visual only
}

export interface ArticleQAInput {
  title: string;
  contentHtml: string;
  seriesName: string;
  seriesStatus?: string;
  facts?: any; // From pipeline extraction
}

export interface SeriesQAInput {
  seriesName: string;
  overview: string;
  status: string;
  numberOfSeasons: number;
  firstAirDate: string;
  lastSeasonDate?: string;
  latestNews?: string;
}

/**
 * Generate Q&A for an article
 * Returns 3-6 questions
 */
export async function generateArticleQA(input: ArticleQAInput): Promise<QAItem[]> {
  const prompt = `Du bist Redakteur bei einem deutschen Serien-Magazin. Erstelle 4-5 Fragen & Antworten zum folgenden Artikel.

STRENGE REGELN:
- Nur Deutsch, neutraler journalistischer Ton (wie Serienjunkies/TVLine)
- KEINE Anrede ("du", "ihr")
- KEINE Marketing-Sprache
- Antworten: max 90 Wörter, nur Fakten aus dem Artikel
- Bei Unsicherheit EXPLIZIT sagen: "Stand jetzt nicht bestätigt"
- KEINE Duplikate mit Artikel-Text
- KEINE Spekulation

FRAGETYPEN (wähle 4-5):
1) Status: "Kommt Staffel X von ${input.seriesName}?"
2) Bedeutung: "Was bedeutet diese Entscheidung für die Serie?"
3) Timing: "Wann könnte die nächste Staffel starten?"
4) Kontext: "Warum verzögert sich die Produktion?"
5) Scope: "Betrifft das auch andere Serien?"

ARTIKEL:
Titel: ${input.title}
Serie: ${input.seriesName}
Inhalt: ${input.contentHtml.replace(/<[^>]*>/g, '').substring(0, 2000)}

Antworte NUR mit JSON:
{
  "questions": [
    {
      "question": "Frage hier",
      "answer": "Antwort hier (max 90 Wörter)",
      "factual": true
    }
  ]
}

WICHTIG:
- Setze "factual" auf false, wenn Antwort spekulativ ist
- Antworten müssen aus Artikel-Fakten stammen
- Keine optimistische Verzerrung`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein präziser Redakteur. Antworte NUR mit JSON, keine Erklärungen.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content?.trim() || '{}';
    const parsed = JSON.parse(content);

    // Validate and return
    const questions: QAItem[] = parsed.questions || [];
    
    // Filter out questions that are too short or too long
    return questions.filter((q: QAItem) => {
      const wordCount = q.answer.split(/\s+/).length;
      return wordCount >= 30 && wordCount <= 90 && q.question.length > 10;
    });

  } catch (error: any) {
    console.error('❌ Q&A generation failed:', error.message);
    return [];
  }
}

/**
 * Generate evergreen Q&A for series page
 * Returns exactly 5 questions
 */
export async function generateSeriesQA(input: SeriesQAInput): Promise<QAItem[]> {
  const prompt = `Du bist Redakteur. Erstelle 5 Evergreen-Fragen für die Serie "${input.seriesName}".

PFLICHT-FRAGEN (genau diese 5):
1) "Worum geht es in ${input.seriesName}?"
2) "Wie viele Staffeln gibt es von ${input.seriesName}?"
3) "Ist ${input.seriesName} verlängert oder abgesetzt?"
4) "Wann startete die letzte Staffel?"
5) "Wann ist mit neuen Folgen zu rechnen?"

SERIE:
Name: ${input.seriesName}
Übersicht: ${input.overview}
Status: ${input.status}
Staffeln: ${input.numberOfSeasons}
Start: ${input.firstAirDate}
Letzte Staffel: ${input.lastSeasonDate || 'Unbekannt'}

REGELN:
- Antworten: max 90 Wörter
- Nur Fakten, keine Spekulation
- Bei Unsicherheit: "Stand jetzt nicht bestätigt"
- Neutral, journalistisch

Antworte NUR mit JSON:
{
  "questions": [
    {
      "question": "Worum geht es in ${input.seriesName}?",
      "answer": "Antwort hier",
      "factual": true
    }
  ]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein präziser Redakteur. Antworte NUR mit JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const content = response.choices[0].message.content?.trim() || '{}';
    const parsed = JSON.parse(content);

    return parsed.questions || [];

  } catch (error: any) {
    console.error('❌ Series Q&A generation failed:', error.message);
    return [];
  }
}

/**
 * Generate status-specific Q&A
 */
export async function generateStatusQA(
  seriesName: string,
  status: 'RENEWED' | 'CANCELLED' | 'UNKNOWN'
): Promise<QAItem[]> {
  const questionMap = {
    RENEWED: [
      `Warum wurde ${seriesName} verlängert?`,
      `Was ist über die nächste Staffel von ${seriesName} bekannt?`,
    ],
    CANCELLED: [
      `Warum wurde ${seriesName} abgesetzt?`,
      `Gibt es Chancen auf eine Fortsetzung von ${seriesName}?`,
    ],
    UNKNOWN: [
      `Warum ist die Zukunft von ${seriesName} unklar?`,
      `Wann könnte eine Entscheidung über ${seriesName} fallen?`,
    ],
  };

  const questions = questionMap[status] || [];
  
  // Return placeholder structure (would need real data to generate proper answers)
  return questions.map((q) => ({
    question: q,
    answer: 'Stand jetzt gibt es keine offiziellen Informationen dazu.',
    factual: false,
  }));
}
