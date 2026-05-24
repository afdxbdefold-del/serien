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
 * Calculate word overlap ratio between two texts (0-1).
 */
function calculateWordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size);
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
  
  // STEP 0: Fix escaped Markdown that wasn't converted properly
  // Pattern: \#\# or \\#\\# followed by text (usually numbered headings)
  // This happens when Markdown escapes leak into HTML content
  sanitized = sanitized.replace(/\\#\\#\s*/g, '');  // \\#\\# -> nothing (already in h2 tag)
  sanitized = sanitized.replace(/\\\#\\\#\s*/g, ''); // \#\# -> nothing
  sanitized = sanitized.replace(/##\s+(?=\d+\.)/g, ''); // ## 1. -> 1. (markdown heading in HTML)
  
  // STEP 0a: Make YouTube/Video iframes responsive
  // Remove fixed width/height and wrap in responsive container
  // Don't add inline styles - let CSS handle the positioning
  sanitized = sanitized.replace(
    /<iframe([^>]*)(width=["'][^"']*["'])([^>]*)(height=["'][^"']*["'])([^>]*)>/gi,
    '<div class="video-embed-wrapper"><iframe$1$3$5>'
  );
  // Close the wrapper div after the iframe
  sanitized = sanitized.replace(/<\/iframe>/gi, '</iframe></div>');
  // Fix double-wrapped cases
  sanitized = sanitized.replace(/<\/div><\/div>/g, '</div>');
  
  // Also handle iframes with only width or only height
  sanitized = sanitized.replace(
    /<iframe([^>]*)(width=["']\d+["'])([^>]*)>/gi,
    (match, before, width, after) => {
      if (match.includes('video-embed-wrapper')) return match; // Already wrapped
      return `<div class="video-embed-wrapper"><iframe${before}${after}>`;
    }
  );
  
  // STEP 0b: Make Instagram embeds responsive
  // Remove min-width from inline styles to allow proper mobile display
  sanitized = sanitized.replace(
    /(<blockquote[^>]*class="[^"]*instagram-media[^"]*"[^>]*style="[^"]*)(min-width:\s*\d+px;?)([^"]*")/gi,
    '$1$3'
  );
  // Also remove max-width that might be too large
  sanitized = sanitized.replace(
    /(<blockquote[^>]*class="[^"]*instagram-media[^"]*"[^>]*style="[^"]*)(max-width:\s*\d+px;?)([^"]*")/gi,
    '$1max-width:100%;$3'
  );
  // Wrap Instagram embeds in a responsive container
  sanitized = sanitized.replace(
    /(<blockquote[^>]*class="[^"]*instagram-media[^"]*")/gi,
    '<div class="embed-container" style="max-width:100%;overflow:hidden;">$1'
  );
  // Close the wrapper after the blockquote's script tag
  sanitized = sanitized.replace(
    /(<\/blockquote>)(\s*<script[^>]*instagram[^>]*><\/script>)/gi,
    '$1$2</div>'
  );
  
  // STEP 0c: Convert leftover **bold** markdown that didn't survive the
  // markdown→HTML pass. This happens when cast/character/streamer linking
  // injects <a> tags INSIDE a markdown bold span (`**Foo**` becomes
  // `**<a href="…">Foo</a>**`), which standard markdown parsers refuse to
  // close across HTML. We finish the job here.
  sanitized = sanitized.replace(/\*\*([^*\n]{1,200}?)\*\*/g, '<strong>$1</strong>');

  // STEP 1: Remove first paragraph if excerpt exists
  // The excerpt/lead is shown separately above the content as bold intro.
  // The contentHtml often contains its own lead as first <p> — always remove it
  // to prevent double-intro display.
  if (excerpt && excerpt.trim().length > 20) {
    const firstPMatch = sanitized.match(/^(\s*<p[^>]*>.*?<\/p>)/s);
    if (firstPMatch) {
      const firstPContent = firstPMatch[1];
      const firstPPlain = firstPContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Only remove if it looks like a lead (no H2 inside, reasonable length, before main content)
      const isLeadLike = firstPPlain.length > 30 && firstPPlain.length < 800 && !firstPContent.includes('<h2');
      if (isLeadLike) {
        sanitized = sanitized.replace(/^\s*<p[^>]*>.*?<\/p>/s, '').trim();
      }
    }
  }
  
  // STEP 2: Remove artificial headings
  const headingRegex = /<(h[2-4])[^>]*>(.*?)<\/\1>/gi;

  // STEP 1.5: Remove "Weitere News zu..." and "Alle Entwicklungen zur Serie..." link boxes
  sanitized = sanitized.replace(/<p[^>]*class="internal-link-box"[^>]*>.*?<\/p>/gi, '');

  // STEP 1.6: Remove embedded "Weitere Artikel zur Serie" list block
  // (rendered separately as cards by the page)
  sanitized = sanitized.replace(/<div[^>]*class="[^"]*related-articles[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');

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
