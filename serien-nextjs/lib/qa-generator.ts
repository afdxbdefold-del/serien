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

// Initialize OpenAI with Emergent LLM integration
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
  // Try OpenAI first
  try {
    const openai = getOpenAIClient();
    
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
    const validQuestions = questions.filter((q: QAItem) => {
      const wordCount = q.answer.split(/\s+/).length;
      return wordCount >= 30 && wordCount <= 90 && q.question.length > 10;
    });

    if (validQuestions.length > 0) {
      console.log('✅ OpenAI Q&A generated:', validQuestions.length, 'questions');
      return validQuestions;
    }

  } catch (error: any) {
    console.log('⚠️  OpenAI Q&A failed, using fallback:', error.message);
  }

  // Fallback to rule-based generation
  const { generateFallbackArticleQA } = await import('./qa-generator-fallback');
  const fallbackQuestions = generateFallbackArticleQA(input);
  console.log('✅ Fallback Q&A generated:', fallbackQuestions.length, 'questions');
  return fallbackQuestions;
}

/**
 * Generate evergreen Q&A for series page
 * Returns exactly 5 questions
 */
export async function generateSeriesQA(input: SeriesQAInput): Promise<QAItem[]> {
  // Try OpenAI first
  try {
    const openai = getOpenAIClient();
    
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
    const questions = parsed.questions || [];

    if (questions.length > 0) {
      console.log('✅ OpenAI Series Q&A generated:', questions.length, 'questions');
      return questions;
    }

  } catch (error: any) {
    console.log('⚠️  OpenAI Series Q&A failed, using fallback:', error.message);
  }

  // Fallback to rule-based generation
  const { generateFallbackSeriesQA } = await import('./qa-generator-fallback');
  const fallbackQuestions = generateFallbackSeriesQA(input);
  console.log('✅ Fallback Series Q&A generated:', fallbackQuestions.length, 'questions');
  return fallbackQuestions;
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
