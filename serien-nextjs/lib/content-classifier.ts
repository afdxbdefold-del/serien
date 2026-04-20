import { parseJsonResponse } from './json-utils';
/**
 * STEP 1: Content Classification
 * Classifies articles into SINGLE_SERIES_NEWS, MULTI_SERIES_EDITORIAL, FEATURE_ESSAY, or SKIP
 */

import { createLLMClient, LLM_CONFIG } from './llm-config';

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

✅ ACCEPTED TYPES (BIAS TOWARDS ACCEPTANCE when TV series content is plausible):
- SINGLE_SERIES_NEWS: ACTUAL NEWS about ONE specific TV series
  Examples: "Stranger Things Season 5 release date", "Game of Thrones spinoff cancelled", "New cast member announced", "Actor reflects on past role (anniversary, birthday, reunion, retrospective)", "Celebrity criticizes a specific show"
  MUST contain: A NEW event, announcement, update, development, interview, retrospective, cast reunion, or public commentary
  
- MULTI_SERIES_EDITORIAL: Editorial/listicle about MULTIPLE TV series 
  Examples: "Top 10 Netflix series", "Best sci-fi series to watch", "Celebrity's favorite TV shows"
  INCLUDES: Celebrity opinions listing multiple shows, retrospectives comparing series, recommendation lists
  → If the article mentions 2+ different TV series as main subjects → MULTI_SERIES_EDITORIAL
  → STILL set primary_series to the MAIN focus (e.g., if "Spielberg loves Mad Men" → primary_series = "Mad Men")

⛔ REJECTED TYPES (use ONLY if you are CERTAIN):
- FEATURE_ESSAY: Pure analysis about ONE series with ZERO news hook — no anniversary, no interview, no recent event
  Examples: "Why Breaking Bad is a masterpiece" (no news), "What makes The Wire great" (no news)
  If there IS any recent hook (anniversary, actor interview, streaming re-release) → classify as SINGLE_SERIES_NEWS instead.
  
- MOVIE: Article is PRIMARILY about a feature film (not TV). REJECT only if no TV series is the main subject.
- MIXED: Article genuinely weighs movies AND TV series equally AND both are the main subjects. Do NOT use if TV dominates.
- UNKNOWN: Article is clearly NOT about TV/film at all (politics, sports, tech, books-only, gaming). 
  ⚠️ DO NOT use UNKNOWN as a safe default — if a series name appears in title or text, PICK AN ACCEPTED TYPE.

CRITICAL RULES:
1. TV series ONLY - no movies as main subject
2. NEWS requires a NEW EVENT (release, cancellation, casting, renewal, anniversary, interview, reunion, public commentary, streaming milestone, etc.)
3. If article mentions MULTIPLE series (even without news) → MULTI_SERIES_EDITORIAL (ACCEPT!)
4. Actor retrospectives / anniversaries / birthday reunions → SINGLE_SERIES_NEWS (the event IS the news)
5. Celebrity talking about their favorite shows = MULTI_SERIES_EDITORIAL (they usually mention multiple)
6. Streaming-success milestones (views, chart positions) → SINGLE_SERIES_NEWS

🎯 DEFAULT BEHAVIOUR:
When a TV series is clearly the main subject of the article but you are uncertain which exact news category fits, DEFAULT to SINGLE_SERIES_NEWS with a note in reasoning.
NEVER pick UNKNOWN just because the news angle is subtle. UNKNOWN is for articles that have NOTHING to do with TV.

⚠️ IMPORTANT - AVOID THESE COMMON MISTAKES:
- "X's Rival" or "Competitor to X" means the article is NOT about X
- "Following X's success" → Article is about a DIFFERENT show
- "Steven Spielberg's favorite show" with mentions of multiple series → MULTI_SERIES_EDITORIAL

CRITICAL - SERIES NAME EXTRACTION:
- If title is GENERIC (e.g., "Netflix's Crime Thriller", "HBO's New Drama"), you MUST find the series name IN THE TEXT
- Look for: author names (Jø Nesbø → Harry Hole), actor names + show mentions, specific show titles in quotes
- Example: "Netflix's Crime Thriller..." + text mentions "Detective Hole" → primary_series = "Harry Hole" or "Detective Hole"
- Example: "HBO's Drama Hit..." + text mentions "The White Lotus" → primary_series = "The White Lotus"
- NEVER leave primary_series empty if the article is about a specific series

TITLE PATTERNS → AUTOMATIC CLASSIFICATION:
- "Top 10...", "Best...", "Ranking..." → MULTI_SERIES_EDITORIAL
- "X's Favorite Series/Show" → MULTI_SERIES_EDITORIAL
- "All-Time Favorite" → MULTI_SERIES_EDITORIAL
- "Must-Watch Series" → MULTI_SERIES_EDITORIAL

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
  "reasoning": "brief 1-sentence explanation - what NEW event does this article report? If none but multiple series mentioned, say so."
}`;


export async function classifyContent(
  title: string,
  url: string,
  textHead: string
): Promise<ClassificationResult> {
  const client = createLLMClient();

  const userPrompt = `
INPUT:
Title: ${title || 'Untitled'}
URL: ${url || ''}
Text (first 4000 chars):
${(textHead || '').substring(0, 4000)}

Classify this content now.
`.trim();

  // Retry up to 3× on transient proxy errors (502, 401, timeout, ECONNRESET).
  // Until today 3 articles/day were skipped because Claude/proxy hiccupped and
  // the classifier immediately returned UNKNOWN.
  const MAX_ATTEMPTS = 3;
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          { role: 'system', content: CLASSIFIER_PROMPT },
          { role: 'user', content: userPrompt }
        ],
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

      if (attempt > 1) {
        console.log(`  ℹ Classifier succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const msg = error?.message || String(error);
      // IMPORTANT: retry on *every* error by default. The previous whitelist
      // (only 502/503/timeout/ECONNRESET/…) missed JSON-parse SyntaxErrors and
      // unknown SDK errors — those caused silent UNKNOWN fallback in <50ms.
      // Only skip retry if we've exhausted attempts.
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.warn(`⚠️  Classifier attempt ${attempt}/${MAX_ATTEMPTS} failed: ${msg.substring(0, 160)} — retry in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      break; // out of retries
    }
  }

  console.error('❌ Classification failed after retries:', lastError?.message);
  const errMsg = lastError?.message || 'unknown error';
  return {
    content_type: 'UNKNOWN',
    confidence: 0,
    series_candidates: [],
    signals: { title: [], text: [] },
    reasoning: `CLASSIFIER_ERROR: ${errMsg}`
  };
}

export function shouldSkipArticle(classification: ClassificationResult): boolean {
  return !['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL'].includes(classification.content_type);
}
