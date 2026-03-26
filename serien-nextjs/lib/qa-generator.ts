/**
 * Q&A Generator - Simplified Version
 * Generates 2-3 Q&A pairs for articles
 * MODUL 2: Interpretative Series Q&A (Google Discover optimization)
 */

export interface QAItem {
  question: string;
  answer: string;
  factual: boolean;
}

export interface SeriesQAInput {
  seriesName: string;
  overview: string;
  status: string;
  numberOfSeasons: number;
  firstAirDate: string;
  lastSeasonDate?: string;
}

export interface ArticleQAInput {
  title: string;
  contentHtml: string;
  seriesName: string;
  seriesStatus?: string;
}

export async function generateArticleQA(input: ArticleQAInput): Promise<QAItem[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      console.log('   ⚠️  No API key, skipping Q&A');
      return [];
    }

    // Extract plain text
    const plainText = input.contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500);

    console.log('   🤔 Generating Q&A...');

    // Use local LLM proxy (same as content-generator.ts)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Create 2-3 simple questions and answers about the article in German. Return valid JSON with this structure: {"questions":[{"question":"...","answer":"...","factual":true}]}'
          },
          {
            role: 'user',
            content: `Article about ${input.seriesName}:\n\n${plainText}\n\nCreate 2-3 Q&A pairs in German.`
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️  API error ${response.status}:`, errorText.substring(0, 100));
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.log('   ⚠️  No content in response');
      return [];
    }

    const parsed = JSON.parse(content);
    const questions = (parsed.questions || []).slice(0, 3);

    if (questions.length > 0) {
      console.log(`   ✅ Generated ${questions.length} Q&A pairs`);
    } else {
      console.log('   ⚠️  No questions generated');
    }

    return questions;

  } catch (error: any) {
    console.log('   ⚠️  Q&A generation failed:', error.message?.substring(0, 50));
    return [];
  }
}

/**
 * MODUL 2: Generate interpretative Series Q&A (5 evergreen questions)
 * For Google Discover optimization - focuses on WHY and context, not just facts
 * 
 * Examples of GOOD questions:
 * - "Was macht [Serie] besonders im Vergleich zu anderen Serien?"
 * - "Für wen lohnt sich [Serie]?"
 * - "Was sollte man vor dem Start wissen?"
 * 
 * Examples of BAD questions (too factual, no interpretation):
 * - "Wie viele Staffeln hat [Serie]?" (already visible on page)
 * - "Wann erschien [Serie]?" (already visible on page)
 */
export async function generateSeriesQA(input: SeriesQAInput): Promise<QAItem[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      console.log('   ⚠️  No API key for Series Q&A, returning fallback questions');
      return generateFallbackSeriesQA(input);
    }

    console.log(`   🤔 Generating interpretative Series Q&A for ${input.seriesName}...`);

    // Use local LLM proxy
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: `Du bist ein kritischer Serien-Analyst, der INTERPRETATIVE Fragen beantwortet.

WICHTIG - Was du NICHT tun darfst:
- KEINE rein faktischen Fragen ("Wie viele Staffeln?", "Wann erschien?")
- KEINE Wiederholung von bereits sichtbaren Datenpunkten
- KEINE generischen Marketing-Phrasen

Was du tun sollst:
- Interpretative Einordnung (Warum ist diese Serie relevant?)
- Vergleiche und Kontextualisierung
- Zielgruppen-Empfehlungen
- Kritische Bewertung von Stärken/Schwächen
- Erklärung von Genre-Konventionen oder Besonderheiten

Erstelle 5 Q&A-Paare in deutscher Sprache. Return valid JSON: {"questions":[{"question":"...","answer":"...","factual":false}]}`
          },
          {
            role: 'user',
            content: `Serie: ${input.seriesName}
Beschreibung: ${input.overview}
Status: ${input.status}
Anzahl Staffeln: ${input.numberOfSeasons}
Erste Ausstrahlung: ${input.firstAirDate}

Erstelle 5 interpretative Q&A-Paare, die NICHT einfach Fakten wiederholen, sondern Kontext und Einordnung bieten.

Beispiele für GUTE Fragen:
- "Was macht ${input.seriesName} im Genre besonders?"
- "Für wen lohnt sich ${input.seriesName}?"
- "Was unterscheidet ${input.seriesName} von ähnlichen Serien?"
- "Welche Erwartungen sollte man an ${input.seriesName} haben?"
- "Was sind die größten Stärken und Schwächen von ${input.seriesName}?"`
          }
        ],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   ⚠️  API error ${response.status}, using fallback`);
      return generateFallbackSeriesQA(input);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.log('   ⚠️  No content in response, using fallback');
      return generateFallbackSeriesQA(input);
    }

    const parsed = JSON.parse(content);
    const questions = (parsed.questions || []).slice(0, 5);

    if (questions.length > 0) {
      console.log(`   ✅ Generated ${questions.length} interpretative Q&A pairs`);
      return questions;
    } else {
      console.log('   ⚠️  No questions generated, using fallback');
      return generateFallbackSeriesQA(input);
    }

  } catch (error: any) {
    console.log('   ⚠️  Series Q&A generation failed:', error.message?.substring(0, 50));
    return generateFallbackSeriesQA(input);
  }
}

/**
 * Fallback: Generate interpretative questions without LLM
 * Still follows Google Discover strategy (interpretation over facts)
 */
function generateFallbackSeriesQA(input: SeriesQAInput): QAItem[] {
  const { seriesName, overview, status, numberOfSeasons } = input;
  
  // Extract genre hints from overview
  const isComedy = overview.toLowerCase().includes('komödie') || overview.toLowerCase().includes('humor');
  const isDrama = overview.toLowerCase().includes('drama');
  const isThriller = overview.toLowerCase().includes('thriller') || overview.toLowerCase().includes('spannung');
  
  const questions: QAItem[] = [];
  
  // Question 1: What makes it special? (always)
  questions.push({
    question: `Was macht ${seriesName} besonders?`,
    answer: overview.length > 200 
      ? `${seriesName} hebt sich durch seinen Ansatz ab: ${overview.substring(0, 180)}... Die Serie kombiniert Elemente, die in dieser Konstellation selten zu sehen sind.`
      : `${seriesName} bietet eine interessante Mischung: ${overview}`,
    factual: false
  });
  
  // Question 2: Target audience
  let audienceAnswer = '';
  if (isComedy) {
    audienceAnswer = `Fans von intelligenter Komödie, die mehr als nur Lacher sucht, kommen hier auf ihre Kosten. ${seriesName} funktioniert am besten, wenn man sich auf den Ton einlässt.`;
  } else if (isThriller) {
    audienceAnswer = `${seriesName} richtet sich an Zuschauer, die Geduld für langsam aufgebaute Spannung mitbringen. Wer sofortige Action erwartet, könnte enttäuscht sein.`;
  } else if (isDrama) {
    audienceAnswer = `Die Serie spricht vor allem Zuschauer an, die Wert auf Charakterentwicklung legen. ${seriesName} nimmt sich Zeit für seine Figuren – manchmal mehr, als manche Zuschauer bereit sind zu investieren.`;
  } else {
    audienceAnswer = `${seriesName} funktioniert am besten für Zuschauer, die offen für verschiedene Erzählansätze sind. Die Serie folgt nicht immer konventionellen Mustern.`;
  }
  
  questions.push({
    question: `Für wen lohnt sich ${seriesName}?`,
    answer: audienceAnswer,
    factual: false
  });
  
  // Question 3: Expectations (based on status and seasons)
  let expectationsAnswer = '';
  if (status === 'Returning Series' && numberOfSeasons >= 3) {
    expectationsAnswer = `Mit ${numberOfSeasons} Staffeln hat ${seriesName} sich etabliert – aber das bedeutet auch, dass die Serie ihre Formel gefunden hat. Wer nach Staffel 1 skeptisch ist, wird wahrscheinlich auch später nicht überzeugt.`;
  } else if (status === 'Ended') {
    expectationsAnswer = `${seriesName} ist abgeschlossen, was sowohl Vor- als auch Nachteile hat: Man weiß, worauf man sich einlässt, aber die Serie konnte ihre Geschichte möglicherweise nicht so erzählen, wie ursprünglich geplant.`;
  } else if (status === 'Canceled') {
    expectationsAnswer = `Die Absetzung bedeutet: ${seriesName} endet möglicherweise mit offenen Fragen. Wer das frustrierend findet, sollte vorher wissen, worauf er sich einlässt.`;
  } else {
    expectationsAnswer = `${seriesName} ist noch im Werden – entsprechend schwer ist eine endgültige Bewertung. Die Serie könnte sich noch in eine unerwartete Richtung entwickeln.`;
  }
  
  questions.push({
    question: `Welche Erwartungen sollte man an ${seriesName} haben?`,
    answer: expectationsAnswer,
    factual: false
  });
  
  // Question 4: Strengths
  questions.push({
    question: `Was sind die größten Stärken von ${seriesName}?`,
    answer: `${seriesName} punktet dort, wo viele Serien scheitern: beim Aufbau einer konsistenten Atmosphäre. Die Serie weiß, was sie sein will – auch wenn das nicht jedem gefallen muss.`,
    factual: false
  });
  
  // Question 5: What to know before starting
  const commitment = numberOfSeasons > 3 ? 'erhebliches zeitliches Investment' : 'überschaubaren Zeitaufwand';
  questions.push({
    question: `Was sollte man vor dem Start von ${seriesName} wissen?`,
    answer: `${seriesName} erfordert ${commitment}. Die Serie baut ihre Welt sorgfältig auf – wer sofortige Belohnung erwartet, könnte die Geduld verlieren. Die ersten Episoden sind oft nicht repräsentativ für das, was folgt.`,
    factual: false
  });
  
  return questions;
}
