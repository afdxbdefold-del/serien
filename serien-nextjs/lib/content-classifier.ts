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
  | 'PERSONALITY_NEWS'
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
- SINGLE_SERIES_NEWS: ACTUAL NEWS about ONE specific TV series WHERE THE SERIES IS THE NEWS SUBJECT.
  ✅ PRIORITY EVENTS (highest value for serien.de's DACH streaming audience):
     • New season announcement / release date / premiere date
     • Renewal / cancellation / pickup decisions ("Renewed for Season 5", "cancelled after 2 seasons")
     • New series order / pilot greenlight / development announcement
     • Cast change at series level (new actor joins, lead exits)
     • Streamer / network move (Show moves from Netflix to HBO)
     • Season finale / episode-level event with series-wide impact
     • Streaming-platform milestone tied to the series ("Top 10 in DACH for 3 weeks")
     • Anniversary / reunion / retrospective tied to a SPECIFIC SERIES MOMENT
  Examples:
    • "Stranger Things Season 5 release date confirmed"
    • "Game of Thrones spin-off cancelled"
    • "Conviction adds Kevin McKidd to cast"
    • "Severance renewed for Season 3 at Apple TV+"
  
- MULTI_SERIES_EDITORIAL: Editorial/listicle about MULTIPLE TV series 
  Examples: "Top 10 Netflix series", "Best sci-fi series to watch", "Celebrity's favorite TV shows"
  INCLUDES: Celebrity opinions listing multiple shows, retrospectives comparing series, recommendation lists
  → If the article mentions 2+ different TV series as main subjects → MULTI_SERIES_EDITORIAL
  → STILL set primary_series to the MAIN focus (e.g., if "Spielberg loves Mad Men" → primary_series = "Mad Men")

- PERSONALITY_NEWS: News about a TV actor's PERSONAL life — even if a series name appears in the title.
  ⚠️ Anti-HCU Pass (Juni 2026): serien.de's pipeline REJECTS PERSONALITY_NEWS unconditionally
  (except manual override). Be GENEROUS in classifying as PERSONALITY_NEWS so they get filtered.
  Mark as PERSONALITY_NEWS when the ARTICLE-CORE-EVENT is:
    • Health: illness, recovery, surgery, cancer update, mental-health interview, weight, sobriety
    • Memoir / autobiography / personal essay / open letter
    • Allegations: abuse, harassment, lawsuit, settlement, criminal charges
    • Relationships: marriage, divorce, dating, family
    • Death of the person (obituary), tribute, memorial
    • Pure career retrospective ("how X became a star") without a series-level event hook
  Series in the title (e.g. "(Nashville)", "Clarkson's Farm Season 5") is only "known for" CONTEXT,
  not the news subject. Even when a season number appears in the headline, if the article-core
  is about the PERSON's life, classify as PERSONALITY_NEWS.
  Examples (ALL = PERSONALITY_NEWS, even with a series in the title):
    • "Hayden Panettiere (Nashville) details abuse incident in new memoir"
    • "Jeremy Clarkson reveals cancer is in remission" (his health, not Clarkson's Farm S5)
    • "Moshe Kasher diagnosed with cancer mid-shoot"
    • "Bryan Cranston (Breaking Bad) sues former agent"
    • "Conan O'Brien retrospective ahead of late-night return"

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
2. SINGLE_SERIES_NEWS requires a SERIES-LEVEL event (renewal, cancellation, casting, premiere date, finale). A "Star X talks about his life" article is PERSONALITY_NEWS even if Star X is on series Y.
3. If article mentions MULTIPLE series (even without news) → MULTI_SERIES_EDITORIAL (ACCEPT!)
4. Actor retrospectives / anniversaries / birthday reunions → SINGLE_SERIES_NEWS ONLY if anchored to a series-level event (reunion episode, anniversary special, returning series). Pure career retrospective without series event → PERSONALITY_NEWS.
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
  "content_type": "SINGLE_SERIES_NEWS" | "MULTI_SERIES_EDITORIAL" | "FEATURE_ESSAY" | "PERSONALITY_NEWS" | "MOVIE" | "MIXED" | "UNKNOWN",
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
  // ── PRE-FILTER: Multi-topic roundups ──────────────────────────────────
  // Weekly roundup headlines like "LL Cool J Returns to 'NCIS,' Will Trent
  // Grieves, Bear Grylls Runs Wild..., 'Daredevil' Welcomes Back..." jam 3+
  // different series into one headline. These are SEO-worthless (no clear
  // primary topic for Google Discover) AND Claude safety-blocks them hard.
  // Reject BEFORE hitting the LLM.
  const titleOnly = (title || '').trim();
  if (titleOnly) {
    // Count quoted show names (single or double quotes / smart quotes)
    const quotedShows = (titleOnly.match(/['‘'"]([A-Z][A-Za-z0-9 &\.\-]{2,40})['’'"]/g) || []);
    // Count comma-separated clauses (each usually one show "does X")
    const commaClauses = titleOnly.split(/[,;]/).filter(c => c.trim().length > 4).length;
    // Count capitalized series-name-like tokens (2+ caps words in a row)
    const seriesLikePatterns = (titleOnly.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []).length;

    // Heuristic: 3+ quoted shows OR (4+ comma clauses AND 3+ series-like patterns)
    const isRoundup =
      quotedShows.length >= 3 ||
      (commaClauses >= 4 && seriesLikePatterns >= 3);

    if (isRoundup) {
      console.log(`  ↳ ROUNDUP-DETECTED: ${quotedShows.length} quoted, ${commaClauses} clauses — skipping`);
      return {
        content_type: 'UNKNOWN',
        confidence: 0.95,
        series_candidates: [],
        signals: { title: ['roundup-pattern'], text: [] },
        reasoning: `ROUNDUP_PREFILTER: ${quotedShows.length} quoted shows, ${commaClauses} comma-separated topics`,
      };
    }
  }

  const client = createLLMClient();

  const userPrompt = `
INPUT:
Title: ${title || 'Untitled'}
URL: ${url || ''}
Text (first 4000 chars):
${(textHead || '').substring(0, 4000)}

Classify this content now.
`.trim();

  // Retry with exponential backoff. On Claude safety refusals (403 access_denied)
  // we do a last-ditch heuristic fallback rather than returning UNKNOWN — our
  // pipeline only fetches serien-related sources, so a refused article is almost
  // always legitimate TV news that Claude won't touch (crime, death, sensitive topics).
  const MAX_ATTEMPTS = 3;
  let lastError: any;
  let isSafetyBlock = false;
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
      const validTypes: ContentType[] = ['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL', 'FEATURE_ESSAY', 'PERSONALITY_NEWS', 'MOVIE', 'MIXED', 'UNKNOWN'];
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
      // Detect Claude safety refusal — don't retry, it will always refuse.
      if (/403|access_denied|safety|content_policy|content policy/i.test(msg)) {
        isSafetyBlock = true;
        console.warn(`⚠️  Safety block detected on attempt ${attempt}: ${msg.substring(0, 140)} — switching to heuristic`);
        break;
      }
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
        console.warn(`⚠️  Classifier attempt ${attempt}/${MAX_ATTEMPTS} failed: ${msg.substring(0, 160)} — retry in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }
      break; // out of retries
    }
  }

  // ── HEURISTIC FALLBACK (only on safety refusal) ────────────────────────
  // Claude refused for safety reasons. Use a keyword heuristic: if the
  // title/text contains TV/series signals, classify as SINGLE_SERIES_NEWS
  // rather than dropping the article to UNKNOWN.
  console.log(`[classifier] Loop exited. isSafetyBlock=${isSafetyBlock} lastError=${lastError?.message?.slice(0,120)}`);
  if (isSafetyBlock) {
    const blob = `${title} ${textHead}`.toLowerCase();
    const titleLower = title.toLowerCase();

    // Positive signals: TV series indicators
    const tvSignals = [
      'season', 'staffel', 'series', 'serie', 'episode', 'finale',
      ' hbo', 'netflix', 'prime video', 'disney+', 'apple tv', 'paramount',
      'peacock', 'hulu', ' bbc', 'showtime', ' fx ', ' amc ', ' itv ', 'stars',
      'cast', 'showrunner', 'renewed', 'canceled', 'cancelled', 'trailer', 'premiere',
      'drama', 'comedy', 'thriller', 'sitcom', 'actor', 'actress',
    ];
    const hits = tvSignals.filter(s => blob.includes(s));

    // Negative signals: industry/business/celebrity-gossip indicators
    // If the TITLE is dominated by these, skip the heuristic rescue to avoid
    // generating drafts for unmatchable articles (e.g. "Madonna's Manager …",
    // "Microdramas Platform … Shifts Strategy", "… Exec Honored With Award").
    const industryNoise = [
      'strategy', 'revenue', 'ugc', 'ipo', 'merger', 'acquisition',
      'platform shift', 'exec ', 'executive', 'award', 'honored',
      'manager', 'tour', 'coachella', 'concert', 'album',
      'microdrama', 'youtube',
    ];
    const noiseHits = industryNoise.filter(s => titleLower.includes(s));

    console.log(`[classifier] Heuristic: TV=${hits.length} noise=${noiseHits.length} (${hits.slice(0,5).join(',')})`);

    // Rescue only if we have strong TV signals AND noise doesn't dominate
    if (hits.length >= 2 && noiseHits.length < 2) {
      console.log(`  ↳ Heuristic rescued: ${hits.length} TV signals → SINGLE_SERIES_NEWS`);
      return {
        content_type: 'SINGLE_SERIES_NEWS',
        confidence: 0.5,
        series_candidates: [],
        signals: { title: [], text: hits.slice(0, 5) },
        reasoning: `HEURISTIC_AFTER_SAFETY_BLOCK: ${hits.length} TV signals detected`
      };
    }
    console.log(`  ↳ Heuristic: skip (TV=${hits.length}, noise=${noiseHits.length}) — keep UNKNOWN`);
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
  // Anti-HCU-Pass (Juni 2026): PERSONALITY_NEWS wird in der Pipeline-v2 jetzt
  // hart abgelehnt (siehe scripts/pipeline-v2.ts) — der Skip-Helper bleibt
  // konservativ, damit andere Caller (Tests, Admin-UI) den Klassifikations-
  // Treffer noch sehen können. Der eigentliche Reject erfolgt in der Pipeline.
  return !['SINGLE_SERIES_NEWS', 'MULTI_SERIES_EDITORIAL', 'PERSONALITY_NEWS'].includes(classification.content_type);
}
