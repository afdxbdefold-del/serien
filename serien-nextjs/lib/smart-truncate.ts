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
  
  // If we found a sentence boundary and it's not too far back (at least 60% of maxLength)
  if (lastSentenceEnd > maxLength * 0.6) {
    return text.substring(0, lastSentenceEnd + 1).trim();
  }
  
  // If no good sentence boundary, look for the last complete word
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    return text.substring(0, lastSpace).trim() + '…';
  }
  
  // Fallback: hard truncate
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
