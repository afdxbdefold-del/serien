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
  
  // Look for last colon (natural pause point - perfect for "dass" clauses)
  const lastColon = truncated.lastIndexOf(':');
  
  if (lastColon > maxLength * 0.5) {
    return text.substring(0, lastColon + 1).trim();
  }
  
  // If no good boundary, look for the last complete word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    // Check if we're cutting mid-phrase
    const afterLastSpace = truncated.substring(lastSpace + 1).trim().toLowerCase();
    
    // Common German function words/articles that shouldn't end an excerpt
    const badEndings = ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'eines', 
                        'und', 'oder', 'aber', 'dass', 'wenn', 'weil', 'als', 'wie', 'von', 'zu', 'mit',
                        'für', 'auf', 'in', 'an', 'bei', 'nach', 'vor', 'über', 'unter', 'durch', 'ohne'];
    
    // Check if ending with a function word
    const endsWithBadWord = badEndings.some(word => 
      afterLastSpace === word || afterLastSpace.startsWith(word + ' ')
    );
    
    if (endsWithBadWord) {
      // Try to find a better break point - go back to colon or comma
      const betterBreak = Math.max(
        truncated.lastIndexOf(':', lastSpace),
        truncated.lastIndexOf(',', lastSpace)
      );
      
      if (betterBreak > maxLength * 0.4) {
        return text.substring(0, betterBreak + 1).trim();
      }
      
      // Otherwise back up one more word
      const previousSpace = truncated.lastIndexOf(' ', lastSpace - 1);
      if (previousSpace > maxLength * 0.5) {
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
