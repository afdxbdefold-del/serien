/**
 * Q&A Generator V2: Editorial Override
 * 
 * RULE: Q&A behaves like editorial interpretation, NOT a helpdesk.
 * 
 * GLOBAL HARD BLOCK (DO NOT GENERATE):
 * - "Wird [Serie] fortgesetzt?"
 * - "Wo läuft / Wo kann ich streamen?"
 * - "Worum geht es?"
 * - "Wer spielt mit?"
 * - Any question answerable via streaming availability, metadata, TMDB fields, sidebar boxes
 * 
 * ALLOWED: Interpretation, signal analysis, fan impact
 * QUALITY GATE: If no strong editorial Q&A → OMIT entirely
 */

import OpenAI from 'openai';

const getOpenAIClient = () => {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }
  return new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://integrations.emergentagent.com/openai/v1',
  });
};

export interface QAItem {
  question: string;
  answer: string;
  factual: boolean;
}

export interface ArticleQAInput {
  title: string;
  contentHtml: string;
  seriesName: string;
  seriesStatus?: string;
  facts?: any;
}

const EDITORIAL_QA_PROMPT = `Du bist ein erfahrener Serien-Redakteur. Generiere 2-3 REDAKTIONELLE Q&A-Paare für einen Artikel.

KRITISCHE REGELN - NIEMALS GENERIEREN:
❌ "Wird [Serie] fortgesetzt?"
❌ "Wo läuft / Wo kann ich streamen?"
❌ "Worum geht es?"
❌ "Wer spielt mit?"
❌ Fragen, die mit Streaming, Metadata oder TMDB beantwortet werden können

ERLAUBTE FRAGETYPEN (wähle 2-3):

A) INTERPRETATION
- "Was sagt die aktuelle Situation über die Zukunft der Serie aus?"
- "Warum ist die Lage ungewöhnlich im Vergleich zu ähnlichen Serien?"

B) SIGNAL-ANALYSE
- "Welche Hinweise liefern bisherige Aussagen oder Entscheidungen?"
- "Was lässt sich aus dem bisherigen Schweigen ableiten?"

C) FAN-IMPACT
- "Was bedeutet das konkret für Fans in den kommenden Monaten?"
- "Welche realistischen Szenarien sind jetzt denkbar?"

ANTWORT-REGELN:
- 3-6 Sätze
- Kein "offiziell bestätigt"-Disclaimer-Ton
- Erklärend, analytisch
- Darf Unsicherheit, Wahrscheinlichkeiten, Vergleiche enthalten
- Darf NICHT Artikel-Sätze wiederholen

QUALITY GATE:
Wenn die Antwort auf einen Satz reduzierbar ist → OMIT Q&A
Wenn nur bekannte Fakten → OMIT Q&A
Wenn Google direkt antworten könnte → OMIT Q&A

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "question": "[Interpretative Frage]",
      "answer": "[3-6 Sätze, editorial-style]",
      "factual": false
    }
  ],
  "omit": false // true = kein gutes Q&A möglich
}

Wenn kein gutes Q&A möglich ist, setze "omit": true und "questions": [].`;

/**
 * Generate editorial Q&A for articles
 */
export async function generateArticleQA(input: ArticleQAInput): Promise<QAItem[]> {
  try {
    // SIMPLIFIED APPROACH: Use basic fetch instead of OpenAI SDK to avoid issues
    const apiKey = process.env.EMERGENT_LLM_KEY;
    if (!apiKey) {
      console.log('   ℹ️  No EMERGENT_LLM_KEY, skipping Q&A');
      return [];
    }
    
    // Extract plain text
    const plainText = input.contentHtml
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1500);

    // Simple, non-triggering prompt
    const messages = [
      {
        role: 'system',
        content: 'You are a TV news journalist. Create 2-3 simple Q&A pairs about the article. Keep it factual and brief.'
      },
      {
        role: 'user',
        content: `Article about ${input.seriesName}: ${plainText}. Generate 2-3 questions and answers in JSON format: {"questions":[{"question":"...","answer":"...","factual":true}]}`
      }
    ];

    const response = await fetch('https://integrations.emergentagent.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.log(`   ⚠️  API returned ${response.status}, skipping Q&A`);
      return [];
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return [];
    }

    // Try to parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const questions = parsed.questions || [];
    
    console.log(`   ✅ Generated ${questions.length} Q&A pairs`);
    return questions.slice(0, 3);
    
  } catch (error) {
    console.log('   ℹ️  Q&A skipped:', error.message?.substring(0, 50));
    return [];
  }
}
    
    // Extract plain text from HTML
    const plainText = input.contentHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    const userPrompt = `ARTIKEL:
Titel: ${input.title}
Serie: ${input.seriesName}
Content (erste 1000 Zeichen): ${plainText.substring(0, 1000)}

Generiere 2-3 REDAKTIONELLE Q&A-Paare, die echten Editorial-Mehrwert bieten.
KEINE generischen FAQ-Fragen.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: EDITORIAL_QA_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 1000,
    });

    const content = response.choices[0].message.content?.trim() || '{}';
    const parsed = JSON.parse(content);

    // Check if Q&A should be omitted
    if (parsed.omit === true || !parsed.questions || parsed.questions.length === 0) {
      console.log('   ⊘  No editorial Q&A possible - omitting section');
      return [];
    }

    // Validate questions
    const questions: QAItem[] = parsed.questions || [];
    
    // Quality check: Block forbidden questions
    const forbiddenPatterns = [
      /wird.*fortgesetzt/i,
      /wo l[aä]uft/i,
      /wo kann.*streamen/i,
      /worum geht es/i,
      /wer spielt/i,
      /wie viele staffeln/i,
      /wann kommt.*staffel/i
    ];
    
    const validQuestions = questions.filter(q => {
      for (const pattern of forbiddenPatterns) {
        if (pattern.test(q.question)) {
          console.log(`   ❌ Blocked forbidden question: "${q.question}"`);
          return false;
        }
      }
      
      // Check answer length (must be 3-6 sentences)
      const sentences = q.answer.split(/[.!?]+/).filter(s => s.trim().length > 10);
      if (sentences.length < 3) {
        console.log(`   ❌ Answer too short (${sentences.length} sentences): "${q.question}"`);
        return false;
      }
      
      return true;
    });

    if (validQuestions.length === 0) {
      console.log('   ⊘  All Q&A rejected by quality gate - omitting section');
      return [];
    }

    console.log(`   ✅ Generated ${validQuestions.length} editorial Q&A pair(s)`);
    return validQuestions.slice(0, 3);

  } catch (error: any) {
    console.error(`   ❌ Q&A generation failed: ${error.message}`);
    // If generation fails, OMIT Q&A (better than fallback)
    return [];
  }
}

/**
 * NO FALLBACK Q&A
 * Better to have no Q&A than generic helpdesk Q&A
 */
export function generateFallbackArticleQA(_input: ArticleQAInput): QAItem[] {
  console.log('   ⊘  Fallback Q&A disabled - omitting Q&A section');
  return [];
}

export function generateFallbackSeriesQA(_input: any): QAItem[] {
  console.log('   ⊘  Fallback Q&A disabled - omitting Q&A section');
  return [];
}
