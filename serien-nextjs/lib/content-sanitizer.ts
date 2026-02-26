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
 * Sanitize article HTML by removing artificial headings
 * 
 * @param html - Raw HTML content from article
 * @returns Sanitized HTML with artificial headings removed
 */
export function sanitizeArticleContent(html: string): string {
  if (!html) return html;
  
  // Simple regex-based approach (no external dependencies)
  // Matches h2, h3, h4 tags with their content
  const headingRegex = /<(h[2-4])[^>]*>(.*?)<\/\1>/gi;
  
  let sanitized = html;
  const matches = Array.from(html.matchAll(headingRegex));
  
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
