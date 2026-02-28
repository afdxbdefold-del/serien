/**
 * Natural Paragraph Generator for News Articles
 * Ensures all articles follow journalistic paragraph structure
 */

interface ParsedArticle {
  leadParagraph: string;
  bodyParagraphs: string[];
  subheading?: string;
  isValid: boolean;
  errors: string[];
}

/**
 * Validate paragraph structure
 */
function validateParagraph(text: string): { valid: boolean; error?: string } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const wordCount = text.split(/\s+/).length;

  if (sentences.length > 4) {
    return { valid: false, error: 'Paragraph exceeds 4 sentences' };
  }

  if (wordCount > 100) {
    return { valid: false, error: 'Paragraph exceeds 100 words' };
  }

  return { valid: true };
}

/**
 * Convert Markdown formatting to HTML
 */
function convertMarkdownToHTML(text: string): string {
  return text
    // Bold: **text** or __text__ -> <strong>text</strong>
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_ -> <em>text</em>
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}

/**
 * Split text into natural paragraphs
 * Input: Raw text from LLM (may contain Markdown)
 */
function splitIntoNaturalParagraphs(text: string): string[] {
  // Don't remove anything - keep the text as-is including markdown
  const cleanText = text.trim();
  
  // Split by sentence (but avoid splitting on abbreviations like R.R., Dr., etc.)
  const sentences = cleanText
    .split(/(?<=[.!?])(?<!\b[A-Z]\.)(?<!\b[A-Z]\.[A-Z]\.)\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  let wordCount = 0;

  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).length;
    
    // Check if adding this sentence would exceed limits
    if (
      currentParagraph.length >= 3 || // Max 3 sentences
      (wordCount + sentenceWords > 80 && currentParagraph.length > 0) // Max ~80 words
    ) {
      // Finalize current paragraph
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
      wordCount = 0;
    }

    currentParagraph.push(sentence);
    wordCount += sentenceWords;
  }

  // Add last paragraph
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs;
}

/**
 * Generate natural paragraph HTML structure
 */
export function generateNaturalArticleHTML(
  rawContent: string,
  seriesName: string,
  options?: {
    includeSubheading?: boolean;
    subheadingText?: string;
  }
): string {
  const errors: string[] = [];

  // Split into paragraphs
  const paragraphs = splitIntoNaturalParagraphs(rawContent);

  if (paragraphs.length < 3) {
    errors.push('Article must have at least 3 paragraphs');
  }

  // Extract lead paragraph (first one)
  const leadParagraph = paragraphs[0];
  if (!leadParagraph) {
    errors.push('Missing lead paragraph');
    throw new Error('Cannot generate article: ' + errors.join(', '));
  }

  // Validate lead
  const leadValidation = validateParagraph(leadParagraph);
  if (!leadValidation.valid) {
    errors.push(`Lead paragraph: ${leadValidation.error}`);
  }

  // Body paragraphs (rest)
  const bodyParagraphs = paragraphs.slice(1);

  // Validate all body paragraphs
  bodyParagraphs.forEach((p, i) => {
    const validation = validateParagraph(p);
    if (!validation.valid) {
      errors.push(`Body paragraph ${i + 1}: ${validation.error}`);
    }
  });

  // Self-check
  if (errors.length > 0) {
    console.error('❌ Article generation failed:');
    errors.forEach(e => console.error('  - ' + e));
    throw new Error('Article does not meet quality standards');
  }

  // Build HTML
  let html = '';

  // Lead paragraph with class (convert markdown)
  html += `<p class="lead">${convertMarkdownToHTML(leadParagraph)}</p>\n\n`;

  // Optional subheading (if > 500 words)
  const totalWords = rawContent.split(/\s+/).length;
  if (totalWords > 500 && options?.includeSubheading && options?.subheadingText) {
    const insertAfter = Math.floor(bodyParagraphs.length / 2);
    
    bodyParagraphs.forEach((p, i) => {
      if (i === insertAfter) {
        html += `<h2>${options.subheadingText}</h2>\n\n`;
      }
      html += `<p>${convertMarkdownToHTML(p)}</p>\n\n`;
    });
  } else {
    // No subheading
    bodyParagraphs.forEach(p => {
      html += `<p>${convertMarkdownToHTML(p)}</p>\n\n`;
    });
  }

  return html.trim();
}

/**
 * Validate generated HTML
 */
export function validateArticleHTML(html: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for lead paragraph
  if (!html.includes('class="lead"')) {
    errors.push('Missing lead paragraph with class="lead"');
  }

  // Count paragraphs
  const paragraphCount = (html.match(/<p>/g) || []).length;
  if (paragraphCount < 4) {
    errors.push(`Only ${paragraphCount} paragraphs (minimum 3 required)`);
  }

  // Check for forbidden tags
  const forbiddenTags = ['<div', '<span', '<br'];
  forbiddenTags.forEach(tag => {
    if (html.includes(tag)) {
      errors.push(`Forbidden tag found: ${tag}`);
    }
  });

  // Check paragraph lengths (rough check)
  const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/g) || [];
  paragraphs.forEach((p, i) => {
    const text = p.replace(/<[^>]+>/g, '');
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 4) {
      errors.push(`Paragraph ${i + 1} has more than 4 sentences`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Example usage
 */
export function exampleUsage() {
  const rawContent = `
    Disney+ hat offiziell die zweite Staffel der Star Wars Spin-off Serie Skeleton Crew verlängert.
    Christopher Ford kehrt als Head Writer zurück. Die Dreharbeiten finden in Manhattan Beach statt.
    Die Serie spielt nach Return of the Jedi. Sie findet im gleichen Zeitrahmen wie The Mandalorian statt.
    Im Finale treffen die Charaktere auf den Supervisor. Jod zerstört ihn mit einem Lichtschwert.
    Der Planet wird dadurch schutzlos. Die Kinder müssen die Barriere zerstören um Hilfe zu holen.
    Die Neue Republik trifft ein und rettet den Tag. Jods Piraten werden besiegt.
  `;

  const html = generateNaturalArticleHTML(
    rawContent,
    'Star Wars: Skeleton Crew',
    {
      includeSubheading: false
    }
  );

  const validation = validateArticleHTML(html);
  
  console.log('Generated HTML:');
  console.log(html);
  console.log('\nValidation:', validation.valid ? '✅ PASSED' : '❌ FAILED');
  if (!validation.valid) {
    validation.errors.forEach(e => console.log('  - ' + e));
  }
}
