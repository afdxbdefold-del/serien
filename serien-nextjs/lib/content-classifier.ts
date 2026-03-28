import { parseJsonResponse } from './json-utils';
/**
 * STEP 1: Content Classification
 * Classifies articles into SINGLE_SERIES_NEWS, MULTI_SERIES_EDITORIAL, FEATURE_ESSAY, or SKIP
 */

import OpenAI from 'openai';

export type ContentType = 
  | 'SINGLE_SERIES_NEWS' 
  | 'MULTI_SERIES_EDITORIAL' 
  | 'FEATURE_ESSAY'
  | 'MOVIE' 
  | 'MIXED' 
  | 'UNKNOWN';

export interface ClassificationResult {
  content_type: ContentType;
  confidence: number;
  primary_series?: string;
  series_candidates: string[];
  signals: {
    title: string[];
    text: string[];
  };
  reasoning?: string;
}

const CLASSIFIER_PROMPT = `You are a strict entertainment content classifier for a German TV series NEWS website.

Your ONLY task is to classify incoming articles into ONE of these types:

✅ ACCEPTED TYPES:
- SINGLE_SERIES_NEWS: ACTUAL NEWS about ONE specific TV series
  Examples: "Stranger Things Season 5 release date", "Game of Thrones spinoff cancelled", "New cast member announced"
  MUST contain: A NEW event, announcement, update, or development
  
- MULTI_SERIES_EDITORIAL: Editorial/listicle about MULTIPLE TV series 
  Examples: "Top 10 Netflix series in 2026", "Best sci-fi series to watch"

⛔ REJECTED TYPES:
- FEATURE_ESSAY: Evergreen analysis, retrospective, opinion piece with NO new news
  Examples: "Why Mad Men is a masterpiece", "Steven Spielberg's favorite show", "What makes Breaking Bad great"
  These have NO new event - they're just analysis of existing content. REJECT these!
  
- MOVIE: About movies (REJECT)
- MIXED: About both movies AND TV series (REJECT)
- UNKNOWN: Cannot determine or unclear (REJECT)

CRITICAL RULES:
1. TV series ONLY - no movies
2. NEWS requires a NEW EVENT (release, cancellation, casting, renewal, etc.)
3. If it's just "Why X is great" or "Celebrity loves X" with NO new development → FEATURE_ESSAY (REJECT)
4. Old interviews or retrospectives are NOT news → FEATURE_ESSAY
5. Be strict: when in doubt, use UNKNOWN

⚠️ IMPORTANT - AVOID THESE COMMON MISTAKES:
- "X's Rival" or "Competitor to X" means the article is NOT about X
- "Following X's success" → Article is about a DIFFERENT show
- Celebrity opinions about old shows are FEATURE_ESSAY, not NEWS
- "17 years ago..." or referencing old interviews = NOT current news

Return ONLY valid JSON (no markdown, no explanation):
{
  "content_type": "SINGLE_SERIES_NEWS" | "MULTI_SERIES_EDITORIAL" | "FEATURE_ESSAY" | "MOVIE" | "MIXED" | "UNKNOWN",
  "confidence": 0.0-1.0,
  "primary_series": "The MAIN series this article is about (if applicable)",
  "series_candidates": ["Series Name 1", "Series Name 2"],
  "signals": {
    "title": ["keyword from title that helped classification"],
    "text": ["keyword from text that helped classification"]
  },
  "reasoning": "brief 1-sentence explanation - what NEW event does this article report? If none, say so."
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
Title: ${title || 'Untitled'}
URL: ${url || ''}
Text (first 1500 chars):
${(textHead || '').substring(0, 1500)}

Classify this content now.
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
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

    const result = parseJsonResponse(content) as ClassificationResult;
    
    // Validation
    const validTypes: ContentType[] = ['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL', 'FEATURE_ESSAY', 'MOVIE', 'MIXED', 'UNKNOWN'];
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
