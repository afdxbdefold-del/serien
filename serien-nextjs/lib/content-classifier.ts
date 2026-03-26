/**
 * STEP 1: Content Classification
 * Classifies articles into SINGLE_SERIES_NEWS, MULTI_SERIES_EDITORIAL, or SKIP
 */

import OpenAI from 'openai';

export type ContentType = 
  | 'SINGLE_SERIES_NEWS' 
  | 'MULTI_SERIES_EDITORIAL' 
  | 'MOVIE' 
  | 'MIXED' 
  | 'UNKNOWN';

export interface ClassificationResult {
  content_type: ContentType;
  confidence: number;
  series_candidates: string[];
  signals: {
    title: string[];
    text: string[];
  };
  reasoning?: string;
}

const CLASSIFIER_PROMPT = `You are a strict entertainment content classifier for a German TV series news website.

Your ONLY task is to classify incoming articles into ONE of these types:
- SINGLE_SERIES_NEWS: News about ONE specific TV series (e.g. "Stranger Things Season 5 confirmed")
- MULTI_SERIES_EDITORIAL: Editorial/listicle about MULTIPLE TV series (e.g. "Top 10 Netflix series in 2026", "Best sci-fi series")
- MOVIE: About movies (REJECT)
- MIXED: About both movies AND TV series (REJECT)
- UNKNOWN: Cannot determine or unclear (REJECT)

RULES:
1. TV series ONLY - no movies
2. Editorials listing multiple TV series are ALLOWED and encouraged
3. If the article mentions even ONE movie prominently → classify as MOVIE or MIXED
4. Extract series names you find (even if classification is MOVIE/MIXED/UNKNOWN)
5. Be strict: when in doubt, use UNKNOWN

Return ONLY valid JSON (no markdown, no explanation):
{
  "content_type": "SINGLE_SERIES_NEWS" | "MULTI_SERIES_EDITORIAL" | "MOVIE" | "MIXED" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "series_candidates": ["Series Name 1", "Series Name 2"],
  "signals": {
    "title": ["keyword from title that helped classification"],
    "text": ["keyword from text that helped classification"]
  },
  "reasoning": "brief 1-sentence explanation"
}`;

export async function classifyContent(
  title: string,
  url: string,
  textHead: string
): Promise<ClassificationResult> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
  });

  const userPrompt = `
INPUT:
Title: ${title}
URL: ${url}
Text (first 1500 chars):
${textHead.substring(0, 1500)}

Classify this content now.
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: CLASSIFIER_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_completion_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from classifier');
    }

    const result = JSON.parse(content) as ClassificationResult;
    
    // Validation
    const validTypes: ContentType[] = ['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL', 'MOVIE', 'MIXED', 'UNKNOWN'];
    if (!validTypes.includes(result.content_type)) {
      throw new Error(`Invalid content_type: ${result.content_type}`);
    }

    return result;
    
  } catch (error: any) {
    console.error('❌ Classification failed:', error.message);
    // Fallback to UNKNOWN on error
    return {
      content_type: 'UNKNOWN',
      confidence: 0,
      series_candidates: [],
      signals: { title: [], text: [] },
      reasoning: `Error: ${error.message}`
    };
  }
}

export function shouldSkipArticle(classification: ClassificationResult): boolean {
  return !['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL'].includes(classification.content_type);
}
