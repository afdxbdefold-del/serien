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
 * Clean article title to extract series name
 * Removes common noise words from recap/review titles
 */
function cleanTitleForSeriesExtraction(title: string): string {
  let cleaned = title;
  
  // Remove common noise patterns (case insensitive)
  // Order matters: more specific patterns first!
  const noisePatterns = [
    /\s+finale\s+recap\s+and\s+ending\s+explained/gi,
    /\s+finale\s+recap\s+and\s+ending/gi,
    /\s+recap\s+and\s+ending\s+explained/gi,
    /\s+finale\s+recap/gi,
    /\s+episode\s+\d+\s+recap/gi,
    /\s+season\s+\d+\s+episode\s+\d+/gi,
    /\s+s\d+e\d+/gi,
    /\s+recap\s+and\s+ending/gi,
    /\s+ending\s+explained/gi,
    /\s+recap$/gi,
    /\s+review$/gi,
    /\s+explained$/gi,
    /\s+breakdown$/gi,
    /\s+ending$/gi,
    /\s+finale$/gi,
  ];
  
  for (const pattern of noisePatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // Trim and clean up extra spaces
  cleaned = cleaned.trim().replace(/\s+/g, ' ');
  
  return cleaned;
}

/**
 * Extract full series name from article context
 * String-based approach (no regex) - more robust with various quote types
 */
function extractSeriesNameFromContext(title: string, articleText: string): string[] {
  const candidates: string[] = [];
  
  // Clean title first to remove noise
  const cleanedTitle = cleanTitleForSeriesExtraction(title);
  
  // All possible quote characters we want to support
  // Using Unicode escape sequences to avoid parsing issues
  const quoteChars = [
    "'",        // ASCII single quote (U+0027)
    '"',        // ASCII double quote (U+0022)
    '\u2018',   // Unicode left single quote
    '\u2019',   // Unicode right single quote
    '\u201C',   // Unicode left double quote
    '\u201D',   // Unicode right double quote
    '\u201E',   // German opening quote
    '\u00BB',   // French right quote
    '\u00AB',   // French left quote
  ];
  
  // ══════════════════════════════════════════════════════════════════════════
  // STRATEGY 0 (NEW): Extract "also known as" alternative titles
  // e.g., "'That Night,' also known as 'Esa Noche,'" → ["That Night", "Esa Noche"]
  // ══════════════════════════════════════════════════════════════════════════
  const alsoKnownPatterns = [
    /also known as ['\u2018\u2019\u201C\u201D"']([^'\u2018\u2019\u201C\u201D"']+)['\u2018\u2019\u201C\u201D"']/gi,
    /auch bekannt als ['\u2018\u2019\u201C\u201D"']([^'\u2018\u2019\u201C\u201D"']+)['\u2018\u2019\u201C\u201D"']/gi,
  ];
  
  for (const pattern of alsoKnownPatterns) {
    const matches = articleText.matchAll(pattern);
    for (const match of matches) {
      const altName = match[1].trim();
      if (altName.length >= 2 && altName.length <= 40) {
        candidates.push(altName);
        console.log(`   🌍 Alternative name found: "${altName}"`);
      }
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1 (HIGHEST PRIORITY): Find quoted text in ORIGINAL title
  // This is the most reliable - if a series name is in quotes, use it!
  // e.g., 'Prime Video\'s "Deadloch" Gets Perfect Score' → "Deadloch"
  // ══════════════════════════════════════════════════════════════════════════
  for (const openQuote of quoteChars) {
    const startIdx = title.indexOf(openQuote);
    if (startIdx === -1) continue;
    
    // Look for any closing quote after this position
    for (const closeQuote of quoteChars) {
      const endIdx = title.indexOf(closeQuote, startIdx + 1);
      if (endIdx === -1 || endIdx === startIdx) continue;
      
      const extracted = title.substring(startIdx + 1, endIdx).trim();
      
      // Valid series name candidate?
      if (extracted.length >= 2 && extracted.length <= 40 && !extracted.includes('\n')) {
        candidates.push(extracted);
        console.log(`   📌 Quoted in title (HIGH PRIORITY): "${extracted}"`);
      }
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // STRATEGY 1.5 (NEW): Find quoted text in first 500 chars of article
  // e.g., "Netflix's 'That Night,' also known as 'Esa Noche,'"
  // ══════════════════════════════════════════════════════════════════════════
  const firstPart = articleText.substring(0, 500);
  for (const openQuote of quoteChars) {
    let searchStart = 0;
    while (searchStart < firstPart.length) {
      const startIdx = firstPart.indexOf(openQuote, searchStart);
      if (startIdx === -1) break;
      
      for (const closeQuote of quoteChars) {
        const endIdx = firstPart.indexOf(closeQuote, startIdx + 1);
        if (endIdx === -1 || endIdx === startIdx) continue;
        
        const extracted = firstPart.substring(startIdx + 1, endIdx).trim();
        
        if (extracted.length >= 2 && extracted.length <= 40 && !extracted.includes('\n') && !candidates.includes(extracted)) {
          candidates.push(extracted);
          console.log(`   📝 Quoted in intro: "${extracted}"`);
        }
      }
      searchStart = startIdx + 1;
    }
  }
  
  // If we found quoted text, prioritize those
  if (candidates.length > 0) {
    console.log(`   ✅ Using quoted/alternative candidates`);
    return candidates;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // STRATEGY 2: Check for known series names in title/text
  // Only runs if no quoted text found in title!
  // NOTE: Only include series with 4+ characters to avoid false positives!
  // ══════════════════════════════════════════════════════════════════════════
  const knownSeries = [
    'Invincible', 'The Boys', 'Stranger Things', 'Wednesday', 'Squid Game',
    'House of the Dragon', 'The Last of Us', 'Andor', 'The Mandalorian',
    'Daredevil', 'Punisher', 'The Punisher', 'Jessica Jones', 'Luke Cage',
    'Harry Potter', 'Game of Thrones', 'Breaking Bad', 'Better Call Saul',
    'The Walking Dead', 'Yellowstone', 'The Madison', 'Severance',
    'The White Lotus', 'Euphoria', 'Succession', 'The Bear',
    'Cobra Kai', 'Outer Banks', 'Bridgerton', 'Elite',
    'Money Heist', 'Dark', 'Babylon Berlin', '1899', 'Tribes of Europa',
    'Reacher', 'Jack Ryan', 'The Terminal List', 'Citadel',
    'Rings of Power', 'Wheel of Time', 'Foundation', 'For All Mankind',
    'Ted Lasso', 'Shrinking', 'The Morning Show', 'Slow Horses',
    'Bad Monkey', 'The Rookie', 'Smallville', 'Arrow', 'The Flash',
    'Supernatural', 'Lucifer', 'The Witcher', 'Shadow and Bone',
    'Arcane', 'Castlevania', 'One Piece', 'Avatar', 'Percy Jackson',
    'Ahsoka', 'Obi-Wan Kenobi', 'The Book of Boba Fett', 'Skeleton Crew',
    'Loki', 'WandaVision', 'Moon Knight', 'She-Hulk', 'Ms. Marvel',
    'Secret Invasion', 'Echo', 'Agatha All Along', 'Ironheart',
    'Peacemaker', 'Titans', 'Doom Patrol', 'Harley Quinn',
    'The Handmaid\'s Tale', 'Under the Banner of Heaven',
    'Only Murders in the Building', 'Abbott Elementary', 'What We Do in the Shadows',
    'The Penguin', 'Creature Commandos', 'Lanterns',
    // Neue Serien hinzugefügt (removed short names like 'ER', 'You')
    'Peaky Blinders', 'Emergency Room', 'Walker', 'Walker Texas Ranger', 'Born to Bowl',
    'The Testaments', 'Dexter', 'True Detective', 'Fargo', 'Shogun',
    'Fallout', 'The Gentlemen', 'Baby Reindeer', '3 Body Problem',
    'Ripley', 'Shōgun', 'Halo', 'House', 'Grey\'s Anatomy', 'NCIS',
    'Criminal Minds', 'Law & Order', 'Chicago Fire', 'Chicago PD',
    'Blue Bloods', 'SWAT', 'Tracker', 'Fire Country',
    // Australische/Prime Serien
    'Deadloch', 'The Pitt', 'The Rig', 'Clarkson\'s Farm', 'The Grand Tour', 'Good Omens'
  ];
  
  // Only match known series with minimum 4 characters to avoid false positives
  for (const series of knownSeries) {
    if (series.length < 4) continue; // Skip short names
    
    const seriesLower = series.toLowerCase();
    
    // Use word boundary matching to avoid partial matches
    const wordBoundaryRegex = new RegExp(`\\b${seriesLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (wordBoundaryRegex.test(title) || wordBoundaryRegex.test(articleText.slice(0, 500))) {
      candidates.push(series);
      console.log(`   🎯 Known series found: "${series}"`);
    }
  }
  
  // Strategy 2b: Use cleaned title as candidate (fallback)
  console.log(`   🧹 Cleaned title: "${cleanedTitle}" (length: ${cleanedTitle.length})`);
  if (cleanedTitle.length >= 3 && cleanedTitle.length <= 60 && candidates.length === 0) {
    candidates.push(cleanedTitle);
    console.log(`   ✅ Added cleaned title as candidate`);
  }
  
  // Strategy 2: Find quoted text in article first sentence
  const firstSentenceMatch = articleText.match(/^([^.!?]{20,300})[.!?]/);
  if (firstSentenceMatch) {
    const firstSentence = firstSentenceMatch[1];
    
    for (const openQuote of quoteChars) {
      const startIdx = firstSentence.indexOf(openQuote);
      if (startIdx === -1) continue;
      
      for (const closeQuote of quoteChars) {
        const endIdx = firstSentence.indexOf(closeQuote, startIdx + 1);
        if (endIdx === -1 || endIdx === startIdx) continue;
        
        const extracted = firstSentence.substring(startIdx + 1, endIdx).trim();
        
        if (extracted.length >= 2 && extracted.length <= 40 && !extracted.includes('\n')) {
          candidates.push(extracted);
        }
      }
    }
  }
  
  // Strategy 3: Extract words before "Season", "Staffel", "Renewed"
  const keywords = ['Season', 'Staffel', 'Renewed', 'Cancelled', 'um eine', 'bekommt'];
  
  for (const keyword of keywords) {
    // Check in title
    const keywordIdx = title.indexOf(keyword);
    if (keywordIdx !== -1) {
      const beforeKeyword = title.substring(0, keywordIdx).trim();
      let cleaned = beforeKeyword;
      for (const quote of quoteChars) {
        if (cleaned.endsWith(quote)) {
          cleaned = cleaned.slice(0, -1).trim();
        }
      }
      const words = cleaned.split(/\s+/);
      if (words.length >= 1) {
        const lastWords = words.slice(-Math.min(3, words.length)).join(' ');
        
        if (lastWords.length >= 3 && lastWords.length <= 40) {
          candidates.push(lastWords);
        }
      }
    }
  }
  
  // Strategy 4: Look for "series/show NAME" patterns in text
  const seriesPatterns = [
    'series ',
    'show ',
    'drama ',
    'Serie ',
  ];
  
  for (const pattern of seriesPatterns) {
    const patternIdx = articleText.toLowerCase().indexOf(pattern);
    if (patternIdx === -1) continue;
    
    // Check if there's a quote right after
    const afterPattern = articleText.substring(patternIdx + pattern.length, patternIdx + pattern.length + 50);
    
    for (const openQuote of quoteChars) {
      if (!afterPattern.startsWith(openQuote)) continue;
      
      for (const closeQuote of quoteChars) {
        const endIdx = afterPattern.indexOf(closeQuote, 1);
        if (endIdx === -1) continue;
        
        const extracted = afterPattern.substring(1, endIdx).trim();
        
        if (extracted.length >= 2 && extracted.length <= 40) {
          candidates.push(extracted);
        }
      }
    }
  }
  
  // Deduplicate, filter, and clean
  console.log(`   📋 Raw candidates before filter: ${candidates.length}`, candidates.slice(0, 3));
  
  // Strategy 5 (NEW): Find any word in quotes that appears before common TV keywords
  const tvKeywordsInText = ['Season', 'Staffel', 'series', 'Serie', 'show', 'renewed', 'episode'];
  for (const keyword of tvKeywordsInText) {
    const keywordLower = keyword.toLowerCase();
    const textLower = articleText.toLowerCase();
    const keywordIdx = textLower.indexOf(keywordLower);
    
    if (keywordIdx > 20) {
      // Look backwards for quoted text
      const beforeKeyword = articleText.substring(Math.max(0, keywordIdx - 100), keywordIdx);
      
      for (const openQuote of quoteChars) {
        for (const closeQuote of quoteChars) {
          const lastClose = beforeKeyword.lastIndexOf(closeQuote);
          if (lastClose === -1) continue;
          
          const lastOpen = beforeKeyword.lastIndexOf(openQuote, lastClose - 1);
          if (lastOpen === -1 || lastOpen >= lastClose) continue;
          
          const extracted = beforeKeyword.substring(lastOpen + 1, lastClose).trim();
          if (extracted.length >= 2 && extracted.length <= 40 && !candidates.includes(extracted)) {
            candidates.push(extracted);
            console.log(`   🎯 Found via keyword "${keyword}": "${extracted}"`);
          }
        }
      }
    }
  }
  
  const unique = [...new Set(candidates)]
    .filter(c => c.length >= 2 && c.length <= 60) // Increased from 40 to 60 for longer titles
    .filter(c => !c.match(/^(Renewed|Season|Staffel|for|um|eine|bei|verlängert)$/i))
    .filter(c => c.split(/\s+/).length <= 8); // Max 8 words (increased from 5)
  
  console.log(`   ✨ Filtered candidates: ${unique.length}`, unique);
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
  
  // EXACT MATCH BOOST - if query exactly matches name or original_name
  const queryLower = query.toLowerCase().trim();
  const nameLower = result.name.toLowerCase().trim();
  const originalLower = result.original_name.toLowerCase().trim();
  
  let exactMatchBoost = 0;
  if (queryLower === nameLower || queryLower === originalLower) {
    exactMatchBoost = 0.3; // Strong boost for exact match
  }
  
  // Check if series name appears in article
  const contextBoost = articleContext.toLowerCase().includes(result.name.toLowerCase()) ? 0.15 : 0;
  
  // Check if original name (e.g., "Esa noche") appears in article
  const originalContextBoost = articleContext.toLowerCase().includes(result.original_name.toLowerCase()) ? 0.2 : 0;
  
  // RECENCY BOOST - prefer series released in the last 2 years
  let recencyBoost = 0;
  if (result.first_air_date) {
    const airDate = new Date(result.first_air_date);
    const now = new Date();
    const yearsDiff = (now.getTime() - airDate.getTime()) / (365 * 24 * 60 * 60 * 1000);
    if (yearsDiff <= 1) {
      recencyBoost = 0.15; // Very recent
    } else if (yearsDiff <= 2) {
      recencyBoost = 0.1;
    }
  }
  
  // STREAMING MENTION BOOST - if Netflix/Prime/etc mentioned and series is from that platform
  let streamingBoost = 0;
  const articleLower = articleContext.toLowerCase();
  if (articleLower.includes('netflix') && result.overview?.toLowerCase().includes('netflix')) {
    streamingBoost = 0.1;
  }
  
  // Best string match
  let bestMatch = Math.max(nameSimilarity, originalNameSimilarity);
  
  // Apply all boosts (capped at 1.0)
  bestMatch = Math.min(bestMatch + contextBoost + originalContextBoost + exactMatchBoost + recencyBoost + streamingBoost, 1.0);
  
  // Normalize popularity (reduced weight)
  const popularityScore = Math.min(Math.log10(result.popularity + 1) / 3, 1);
  
  // Weight: 80% string match + boosts, 20% popularity (less reliance on popularity)
  return bestMatch * 0.8 + popularityScore * 0.2;
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
