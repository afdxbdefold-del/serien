/**
 * Content Sanitizer: Remove artificial/placeholder headings from article HTML
 * while preserving legitimate editorial headings like "Zusammenfassung" and "Story"
 * 
 * @priority HIGH
 * @mode SAFE_PATCH
 */

/**
 * Whitelist: Legitimate editorial headings that MUST be preserved
 */
const ALLOWED_HEADINGS = [
  'zusammenfassung',
  'story',
  'was bedeutet das?',
  'was heißt das für die serie?',
  'einordnung',
  'hintergrund',
  'kontext',
  'ausblick',
];

/**
 * Blacklist: Artificial/placeholder headings to remove
 */
const ARTIFICIAL_HEADINGS = [
  'artikel-inhalt',
  'artikelinhalt',
  'artikel',
  'inhalt',
  'artikeltext',
  'news',
  'content',
  'der artikel',
  'text',
  'hauptteil',
];

/**
 * Check if a heading text should be removed
 */
function isArtificialHeading(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  
  // Check whitelist first (MUST keep)
  if (ALLOWED_HEADINGS.includes(normalized)) {
    return false;
  }
  
  // Check if partial match with allowed headings
  for (const allowed of ALLOWED_HEADINGS) {
    if (normalized.includes(allowed)) {
      return false;
    }
  }
  
  // Check blacklist
  if (ARTIFICIAL_HEADINGS.includes(normalized)) {
    return true;
  }
  
  // Additional regex patterns
  const artificialPatterns = [
    /^artikel(\s|-)?inhalt$/i,
    /^artikel$/i,
    /^inhalt$/i,
    /^artikeltext$/i,
    /^news$/i,
    /^content$/i,
    /^hauptteil$/i,
  ];
  
  return artificialPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Sanitize article HTML by removing artificial headings and duplicate leads
 * 
 * @param html - Raw HTML content from article
 * @param excerpt - Article excerpt/lead (optional, to check for duplication)
 * @returns Sanitized HTML with artificial headings and duplicate leads removed
 */
export function sanitizeArticleContent(html: string, excerpt?: string): string {
  if (!html) return html;
  
  let sanitized = html;
  
  // STEP 1: Remove duplicate lead if it appears at the start of content
  if (excerpt) {
    const excerptClean = excerpt.trim();
    // Match first <p> tag
    const firstPMatch = sanitized.match(/<p[^>]*>(.*?)<\/p>/s);
    
    if (firstPMatch) {
      const firstPContent = firstPMatch[1].trim();
      // Remove HTML tags for comparison
      const firstPPlain = firstPContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const excerptPlain = excerptClean.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // If first paragraph matches excerpt (exact or starts with), remove it
      if (firstPPlain === excerptPlain || firstPPlain.startsWith(excerptPlain.substring(0, Math.min(50, excerptPlain.length)))) {
        sanitized = sanitized.replace(/<p[^>]*>.*?<\/p>/s, '').trim();
      }
    }
  }
  
  // STEP 2: Remove artificial headings
  const headingRegex = /<(h[2-4])[^>]*>(.*?)<\/\1>/gi;
  const matches = Array.from(sanitized.matchAll(headingRegex));
  
  for (const match of matches) {
    const fullTag = match[0]; // Complete <h2>...</h2>
    const headingText = match[2]; // Text inside heading
    
    // Strip HTML tags from heading text for comparison
    const plainText = headingText.replace(/<[^>]*>/g, '').trim();
    
    if (isArtificialHeading(plainText)) {
      // Remove this heading (but keep following content!)
      sanitized = sanitized.replace(fullTag, '');
    }
  }
  
  return sanitized;
}

/**
 * Sanitize article content (alias for consistency)
 */
export function removeArtificialHeadings(html: string): string {
  return sanitizeArticleContent(html);
}
