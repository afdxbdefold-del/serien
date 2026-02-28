/**
 * Smart text truncation that preserves complete sentences
 */

/**
 * Truncate text to a maximum length, ending at a sentence boundary
 * @param text - The text to truncate
 * @param maxLength - Maximum length (default: 200)
 * @returns Truncated text ending with complete sentence
 */
export function smartTruncate(text: string, maxLength: number = 200): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  // Find the last sentence-ending punctuation before maxLength
  const truncated = text.substring(0, maxLength);
  
  // Look for sentence boundaries (., !, ?)
  const lastPeriod = truncated.lastIndexOf('.');
  const lastExclamation = truncated.lastIndexOf('!');
  const lastQuestion = truncated.lastIndexOf('?');
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  // If we found a sentence boundary and it's not too far back (at least 50% of maxLength)
  if (lastSentenceEnd > maxLength * 0.5) {
    return text.substring(0, lastSentenceEnd + 1).trim();
  }
  
  // Look for last colon or semicolon (natural pause points)
  const lastColon = truncated.lastIndexOf(':');
  const lastSemicolon = truncated.lastIndexOf(';');
  const lastNaturalPause = Math.max(lastColon, lastSemicolon);
  
  if (lastNaturalPause > maxLength * 0.6) {
    return text.substring(0, lastNaturalPause + 1).trim();
  }
  
  // If no good sentence boundary, look for the last complete word
  // But ensure we don't cut off in the middle of a critical phrase
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    // Check if we're cutting mid-phrase (words like "dass", "die", "der" etc.)
    const lastWords = truncated.substring(lastSpace - 30, lastSpace).trim().split(' ');
    const lastWord = lastWords[lastWords.length - 1]?.toLowerCase();
    
    // Common German function words that shouldn't end an excerpt
    const functionWords = ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'eines', 
                          'und', 'oder', 'aber', 'dass', 'wenn', 'weil', 'als', 'wie', 'von', 'zu', 'mit',
                          'für', 'auf', 'in', 'an', 'bei', 'nach', 'vor', 'über', 'unter'];
    
    if (functionWords.includes(lastWord)) {
      // Back up to previous word boundary
      const previousSpace = truncated.lastIndexOf(' ', lastSpace - 1);
      if (previousSpace > maxLength * 0.6) {
        return text.substring(0, previousSpace).trim() + '…';
      }
    }
    
    return text.substring(0, lastSpace).trim() + '…';
  }
  
  // Fallback: hard truncate at word boundary
  const fallbackSpace = truncated.lastIndexOf(' ');
  if (fallbackSpace > 0) {
    return text.substring(0, fallbackSpace).trim() + '…';
  }
  
  return truncated.trim() + '…';
}

/**
 * Create excerpt from lead text
 * Ensures complete sentences, optimal length for cards
 */
export function createExcerpt(leadText: string, targetLength: number = 200): string {
  // Remove any HTML tags first
  const cleanText = leadText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  return smartTruncate(cleanText, targetLength);
}
