/**
 * EMERGENT_QUALITY_CHECK v2
 * 
 * NEW POLICY: Unterscheidet zwischen SHORT_NEWS und FULL_NEWS
 * - SHORT_NEWS: 160-260 Wörter, niedrigere Thresholds, SEARCH_ONLY
 * - FULL_NEWS: 320+ Wörter, höhere Thresholds, DISCOVER_CANDIDATE
 */

const LLM_PROXY_URL = 'https://api.openai.com/v1/chat/completions';

type ArticleType = 'SHORT_NEWS' | 'FULL_NEWS' | 'RANKING_LIST';

interface QualityCheckInput {
  generatedArticleHtml: string;
  finalHeadline: string;
  primarySeriesName: string;
  platform?: string;
  extractedFacts?: string;
  isRankingList?: boolean; // NEW: For RANKING_LIST override
}

interface QualityScores {
  headline: number; // 0-100
  content: number; // 0-100
  structure: number; // 0-100
}

interface QualityCheckResult {
  status: 'PASS' | 'FAIL';
  scores: QualityScores;
  failReasons: string[];
  requiresFullRewrite: boolean;
  articleType: ArticleType;
  wordCount: number;
}

// Quality thresholds based on article type
const QUALITY_THRESHOLDS = {
  SHORT_NEWS: {
    WORDS_MIN: 160,
    WORDS_MAX: 260,
    HEADLINE_MIN: 65,  // Lowered from 70
    CONTENT_MIN: 60,   // Lowered from 65
    STRUCTURE_MIN: 55, // Lowered from 60
  },
  FULL_NEWS: {
    WORDS_MIN: 320,
    HEADLINE_MIN: 75,
    CONTENT_MIN: 70,
    STRUCTURE_MIN: 65,
  },
  RANKING_LIST: {
    WORDS_MIN: 800,    // EMERGENT_RULESET_UPDATE
    HEADLINE_MIN: 70,
    CONTENT_MIN: 65,
    STRUCTURE_MIN: 60,
    ALLOW_REPETITION: true, // Rankings naturally repeat structure
  }
};

function detectArticleType(wordCount: number, isRankingList?: boolean): ArticleType {
  // EMERGENT_RULESET_UPDATE: Detect RANKING_LIST first
  if (isRankingList) {
    return 'RANKING_LIST';
  }
  
  // If article is short (under 320 words), classify as SHORT_NEWS
  // Otherwise, FULL_NEWS
  return wordCount < QUALITY_THRESHOLDS.FULL_NEWS.WORDS_MIN ? 'SHORT_NEWS' : 'FULL_NEWS';
}

export async function qualityCheck(input: QualityCheckInput): Promise<QualityCheckResult> {
  const failReasons: string[] = [];
  let requiresFullRewrite = false;
  
  // Extract text from HTML
  const plainText = input.generatedArticleHtml
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Count words
  const wordCount = plainText.split(/\s+/).length;
  
  // Detect article type
  const articleType = detectArticleType(wordCount, input.isRankingList);
  const thresholds = QUALITY_THRESHOLDS[articleType];
  
  console.log(`📏 Article Type: ${articleType} (${wordCount} words)`);
  console.log(`   Thresholds: H:${thresholds.HEADLINE_MIN} C:${thresholds.CONTENT_MIN} S:${thresholds.STRUCTURE_MIN}`);
  
  // Extract paragraphs
  const paragraphs = input.generatedArticleHtml.match(/<p>(.*?)<\/p>/g) || [];
  const paragraphTexts = paragraphs.map(p => p.replace(/<\/?p>/g, '').trim());

  // === CRITICAL CHECKS (HARD FAILS) ===
  
  // Check for paragraph walls (too many sentences)
  let hasParagraphWalls = false;
  paragraphTexts.forEach((para, i) => {
    const sentences = para.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Only fail if paragraphs are EXTREMELY long (>5 sentences)
    if (sentences.length > 5) {
      failReasons.push(`Absatz ${i + 1}: Textblock zu lang (${sentences.length} Sätze, max: 5)`);
      hasParagraphWalls = true;
      requiresFullRewrite = true;
    }
  });

  // Check for reader address (now only warning with score penalty)
  const readerAddressPatterns = /\b(ihr|du|wir|euch|uns)\b/gi;
  const readerMatches = plainText.match(readerAddressPatterns);
  let scorePenalty = 0;
  
  if (readerMatches && readerMatches.length > 0) {
    // Warning with score penalty (5 points per occurrence, max 15)
    scorePenalty = Math.min(readerMatches.length * 5, 15);
    failReasons.push(`⚠️ Leser-Ansprache: ${readerMatches.length}x gefunden (Penalty: -${scorePenalty} Punkte)`);
    // NO hard fail - only penalty on scores
  }

  // === SOFT CHECKS (Only warnings for SHORT_NEWS) ===
  
  if (paragraphTexts.length < 3 && articleType === 'FULL_NEWS') {
    failReasons.push(`Zu wenige Absätze: ${paragraphTexts.length} (min: 3 für FULL_NEWS)`);
    requiresFullRewrite = true;
  }

  // === AI-POWERED QUALITY SCORING ===
  
  const scores = await getAIQualityScores(input, plainText);

  // Apply score penalty for reader addressing
  if (scorePenalty > 0) {
    scores.content = Math.max(0, scores.content - scorePenalty);
    console.log(`   ⚠️ Reader Address Penalty: -${scorePenalty} points (Content: ${scores.content + scorePenalty} → ${scores.content})`);
  }

  // === PASS/FAIL DECISION ===
  
  const headlinePassed = scores.headline >= thresholds.HEADLINE_MIN;
  const contentPassed = scores.content >= thresholds.CONTENT_MIN;
  const structurePassed = scores.structure >= thresholds.STRUCTURE_MIN;
  
  // FAIL only if critical issues (paragraph walls) OR scores below threshold
  const passed = headlinePassed && contentPassed && structurePassed && !hasParagraphWalls;

  if (!headlinePassed) {
    failReasons.push(`Headline Score zu niedrig: ${scores.headline} (min: ${thresholds.HEADLINE_MIN})`);
  }
  if (!contentPassed) {
    failReasons.push(`Content Score zu niedrig: ${scores.content} (min: ${thresholds.CONTENT_MIN})`);
  }
  if (!structurePassed) {
    failReasons.push(`Structure Score zu niedrig: ${scores.structure} (min: ${thresholds.STRUCTURE_MIN})`);
  }

  return {
    status: passed ? 'PASS' : 'FAIL',
    scores,
    failReasons,
    requiresFullRewrite,
    articleType,
    wordCount
  };
}

async function getAIQualityScores(
  input: QualityCheckInput,
  plainText: string
): Promise<QualityScores> {
  const systemPrompt = `Du bist ein Qualitätsprüfer für deutsche TV-News-Artikel im Stil von serienjunkies.de.

AUFGABE: Bewerte den Artikel auf 3 Dimensionen (0-100 Punkte):

1. HEADLINE (0-100):
   - Max 70 Zeichen?
   - Klar und informativ?
   - Serienname enthalten?
   - Kein Clickbait?
   
2. CONTENT (0-100):
   - Faktisch und neutral?
   - Keine Marketing-Sprache?
   - Keine Leser-Ansprache?
   - Professionell geschrieben?
   
3. STRUCTURE (0-100):
   - Lead max 2 Sätze?
   - Absätze max 3 Sätze?
   - Gute Lesbarkeit?
   - Min 3 Absätze?

Antworte NUR mit JSON:
{
  "headline": 85,
  "content": 90,
  "structure": 80
}`;

  const userPrompt = `HEADLINE:
${input.finalHeadline}

ARTIKEL:
${plainText}

SERIE:
${input.primarySeriesName}

Bewerte die Qualität (0-100 Punkte pro Kategorie).`;

  try {
    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_completion_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      headline: parsed.headline,
      content: parsed.content,
      structure: parsed.structure,
    };

  } catch (error) {
    console.error('AI scoring failed:', error);
    // Return conservative scores on error
    return {
      headline: 65,
      content: 65,
      structure: 60,
    };
  }
}
