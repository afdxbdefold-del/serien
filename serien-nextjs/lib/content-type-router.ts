/**
 * STEP 1.1: CONTENT_TYPE_ROUTER
 * Routes articles to appropriate pipeline based on content type
 */

export type ContentTypeRoute = 
  | 'NEWS_SINGLE'
  | 'NEWS_MULTI'
  | 'RANKING_LIST'
  | 'EXPLAINER'
  | 'OTHER_SKIP';

export interface ContentTypeRouterResult {
  contentType: ContentTypeRoute;
  confidence: number;
  reasoning: string;
  itemCount?: number; // For RANKING_LIST
  seriesCount?: number;
}

/**
 * Detect if article is a ranking/listicle
 */
function detectRankingList(
  sourceTitle: string,
  sourceUrl: string,
  sourceText: string
): { isRanking: boolean; itemCount: number; signals: string[] } {
  const titleLower = (sourceTitle || '').toLowerCase();
  const urlLower = (sourceUrl || '').toLowerCase();
  const signals: string[] = [];
  
  // Signal A: Title keywords
  const titleKeywords = [
    'top', 'best', 'ranking', 'ranked', 
    'must watch', 'must-watch', 'underrated',
    'episodes ranked', 'liste', 'die besten',
    'platz', 'greatest', 'worst'
  ];
  
  const hasTitleKeyword = titleKeywords.some(kw => titleLower.includes(kw));
  if (hasTitleKeyword) {
    signals.push('title_keyword');
  }
  
  // Signal B: URL patterns
  if (urlLower.includes('/ranked/') || urlLower.includes('/best-')) {
    signals.push('url_pattern');
  }
  
  // Signal C: List item patterns in text
  let itemCount = 0;
  
  // Pattern 1: Numbered lists (1., 2., 3., or #1, #2, #3)
  const numberedMatches = sourceText.match(/(?:^|\n)\s*(?:\d+\.|#\d+|No\.\s*\d+)/gmi);
  if (numberedMatches && numberedMatches.length >= 6) {
    itemCount = Math.max(itemCount, numberedMatches.length);
    signals.push(`numbered_list(${numberedMatches.length})`);
  }
  
  // Pattern 2: H2/H3 headings (common in listicles)
  const headingMatches = sourceText.match(/<h[23][^>]*>/gi);
  if (headingMatches && headingMatches.length >= 6) {
    itemCount = Math.max(itemCount, headingMatches.length);
    signals.push(`headings(${headingMatches.length})`);
  }
  
  // Pattern 3: Repeating episode/season patterns
  const episodeMatches = sourceText.match(/(?:Episode|Season|Staffel|Chapter)\s+\d+/gi);
  if (episodeMatches && episodeMatches.length >= 6) {
    itemCount = Math.max(itemCount, episodeMatches.length);
    signals.push(`episode_pattern(${episodeMatches.length})`);
  }
  
  // Pattern 4: Bullet points
  const bulletMatches = sourceText.match(/(?:^|\n)\s*[•\-\*]\s+/gm);
  if (bulletMatches && bulletMatches.length >= 6) {
    itemCount = Math.max(itemCount, bulletMatches.length);
    signals.push(`bullets(${bulletMatches.length})`);
  }
  
  // Decision: Is it a ranking?
  const isRanking = (hasTitleKeyword || signals.length >= 2) && itemCount >= 6;
  
  return { isRanking, itemCount, signals };
}

/**
 * Detect if article covers multiple series (editorial/comparison)
 */
function detectMultiSeries(sourceText: string): { isMulti: boolean; seriesCount: number } {
  // Look for multiple series mentions
  const seriesPatterns = [
    /(?:die serie|the series?|show)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/gi,
    /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:season|staffel)\s+\d+/gi,
  ];
  
  const foundSeries = new Set<string>();
  
  seriesPatterns.forEach(pattern => {
    const matches = sourceText.match(pattern);
    if (matches) {
      matches.forEach(m => foundSeries.add(m.toLowerCase()));
    }
  });
  
  const seriesCount = foundSeries.size;
  const isMulti = seriesCount >= 3;
  
  return { isMulti, seriesCount };
}

/**
 * Main router function
 */
export async function routeContentType(
  sourceTitle: string,
  sourceUrl: string,
  sourceText: string
): Promise<ContentTypeRouterResult> {
  
  // Step 1: Check for RANKING_LIST
  const rankingDetection = detectRankingList(sourceTitle, sourceUrl, sourceText);
  
  if (rankingDetection.isRanking) {
    return {
      contentType: 'RANKING_LIST',
      confidence: 0.95,
      reasoning: `Ranking detected: ${rankingDetection.signals.join(', ')}`,
      itemCount: rankingDetection.itemCount,
    };
  }
  
  // Step 2: Check for multi-series editorial
  const multiSeriesDetection = detectMultiSeries(sourceText);
  
  // If multi-series AND not breaking news, route to NEWS_MULTI
  const isBreakingNews = /(?:breaking|just in|confirmed|announced|revealed|exclusive)/i.test(sourceTitle);
  
  if (multiSeriesDetection.isMulti && !isBreakingNews) {
    return {
      contentType: 'NEWS_MULTI',
      confidence: 0.85,
      reasoning: `Multi-series editorial detected (${multiSeriesDetection.seriesCount} series)`,
      seriesCount: multiSeriesDetection.seriesCount,
    };
  }
  
  // Step 3: Check for EXPLAINER (how-to, guide, explanation)
  const explainerKeywords = ['how to', 'explained', 'guide', 'what is', 'why', 'verstehen', 'erklärt'];
  const isExplainer = explainerKeywords.some(kw => (sourceTitle || '').toLowerCase().includes(kw));
  
  if (isExplainer) {
    return {
      contentType: 'EXPLAINER',
      confidence: 0.80,
      reasoning: 'Explainer article detected (how-to/guide format)',
    };
  }
  
  // Step 4: Default to NEWS_SINGLE
  return {
    contentType: 'NEWS_SINGLE',
    confidence: 0.90,
    reasoning: 'Standard single-series news article',
  };
}
