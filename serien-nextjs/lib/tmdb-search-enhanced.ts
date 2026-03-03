/**
 * ENHANCED TMDB SEARCH v2
 * 
 * Improvements:
 * 1. Extract full series name from article context
 * 2. Try multiple query variations
 * 3. Better confidence scoring
 * 4. Fallback strategies
 */

interface TMDBTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
}

interface EnhancedSearchResult {
  tmdbId: number;
  name: string;
  originalName: string;
  confidence: number;
  matchMethod: string;
}

/**
 * Extract full series name from article context
 * Examples:
 * - "'Cross' Renewed for Season 3" → "Cross"  
 * - "Alex Cross Season 3 Details" → "Alex Cross"
 * - "'Cross' um eine 3. Staffel bei Amazon Prime verlängert" → "Cross"
 */
function extractSeriesNameFromContext(title: string, articleText: string): string[] {
  const candidates: string[] = [];
  
  // 1. Extract from title (quoted names) - HIGHEST PRIORITY
  // Support various quote types: ' " ' " ' ' „ "
  // Use simpler alternation instead of character class
  const quotePattern = /['""''„"]([^'""''„"]{2,40})['""''"]/g;
  const quotedMatches = title.matchAll(quotePattern);
  
  for (const match of quotedMatches) {
    if (match[1] && match[1].length > 2) {
      candidates.push(match[1]);
    }
  }
  
  // 2. Extract after "um" or "bekommt" (German patterns)
  const germanPattern = /['""''„"]([^'""''„"]{2,40})['""'']\s+(?:um|bekommt|erhält)/i;
  const germanMatch = title.match(germanPattern);
  if (germanMatch && germanMatch[1]) {
    candidates.push(germanMatch[1]);
  }
  
  // 3. Extract from beginning before "Season", "Staffel", "Renewed"
  const seasonMatch = title.match(/^([A-Z][a-zA-Z\s]{2,40}?)\s+(?:Season|Staffel|Renewed|Cancelled|um|bekommt)/i);
  if (seasonMatch && seasonMatch[1]) {
    const cleaned = seasonMatch[1].trim();
    // Avoid generic words
    if (cleaned.length > 3 && !cleaned.match(/^(The|A|An|Der|Die|Das|New|Old)$/i)) {
      candidates.push(cleaned);
    }
  }
  
  // 4. Look for proper nouns in article text (first 500 chars)
  const textHead = articleText.substring(0, 500);
  const properNounMatches = textHead.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:series|show|returns|stars)/g);
  for (const match of properNounMatches) {
    if (match[1] && match[1].length > 3) {
      candidates.push(match[1]);
    }
  }
  
  // 5. Extract from article text first paragraph
  const firstSentence = textHead.match(/^([^.!?]{20,200})[.!?]/);
  if (firstSentence) {
    const textQuotePattern = /['""''„"]([^'""''„"]{2,40})['""''"]/g;
    const quotedInText = firstSentence[1].matchAll(textQuotePattern);
    for (const match of quotedInText) {
      if (match[1]) {
        candidates.push(match[1]);
      }
    }
  }
  
  // Deduplicate and filter
  const unique = [...new Set(candidates)]
    .filter(c => c.length > 2 && c.length < 40)
    .filter(c => !c.match(/^(Renewed|Season|Staffel|for|um|eine|bei|verlängert)$/i));
  
  return unique;
}

/**
 * String similarity (Levenshtein)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.9; // Partial match boost

  const matrix: number[][] = [];
  for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
  for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Enhanced confidence calculation
 */
function calculateEnhancedConfidence(
  query: string,
  result: TMDBTvResult,
  articleContext: string
): number {
  const nameSimilarity = stringSimilarity(query, result.name);
  const originalNameSimilarity = stringSimilarity(query, result.original_name);
  
  // Check if series name appears in article
  const contextBoost = articleContext.toLowerCase().includes(result.name.toLowerCase()) ? 0.15 : 0;
  
  // Best string match
  let bestMatch = Math.max(nameSimilarity, originalNameSimilarity);
  
  // Apply context boost
  bestMatch = Math.min(bestMatch + contextBoost, 1.0);
  
  // Normalize popularity
  const popularityScore = Math.min(Math.log10(result.popularity + 1) / 3, 1);
  
  // Weight: 75% string match, 25% popularity (more weight on matching)
  return bestMatch * 0.75 + popularityScore * 0.25;
}

/**
 * Enhanced TMDB search with multiple strategies
 */
export async function searchTvEnhanced(
  title: string,
  articleText: string
): Promise<EnhancedSearchResult | null> {
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }
  
  console.log('🔍 Enhanced TMDB search...');
  console.log(`   Title: "${title}"`);
  console.log(`   Text (first 100): "${articleText.substring(0, 100)}"`);
  
  // Extract potential series names
  const candidates = extractSeriesNameFromContext(title, articleText);
  console.log(`   Candidates: ${candidates.join(', ') || '(none)'}`);
  
  if (candidates.length === 0) {
    console.log('   ⚠️  No series name candidates found');
    return null;
  }
  
  // Try each candidate
  let bestResult: EnhancedSearchResult | null = null;
  let bestConfidence = 0;
  
  for (const candidate of candidates) {
    console.log(`   🔎 Searching for: "${candidate}"`);
    
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(candidate)}&language=de-DE`
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (!data.results || data.results.length === 0) continue;
      
      // Calculate confidence for all results
      const resultsWithConfidence = data.results.map((result: TMDBTvResult) => ({
        ...result,
        confidence: calculateEnhancedConfidence(candidate, result, articleText),
      }));
      
      // Sort by confidence
      resultsWithConfidence.sort((a: any, b: any) => b.confidence - a.confidence);
      
      const topResult = resultsWithConfidence[0];
      
      console.log(`      → Found: "${topResult.name}" (confidence: ${(topResult.confidence * 100).toFixed(1)}%)`);
      
      if (topResult.confidence > bestConfidence) {
        bestConfidence = topResult.confidence;
        bestResult = {
          tmdbId: topResult.id,
          name: topResult.name,
          originalName: topResult.original_name,
          confidence: topResult.confidence,
          matchMethod: `Query: "${candidate}"`,
        };
      }
    } catch (error) {
      console.log(`      ❌ Search failed: ${error}`);
    }
  }
  
  if (bestResult) {
    console.log(`   ✅ Best match: "${bestResult.name}" (${(bestResult.confidence * 100).toFixed(1)}%)`);
  } else {
    console.log(`   ❌ No match found`);
  }
  
  return bestResult;
}
