/**
 * Simple Markdown to HTML converter
 * Specifically for Pipeline v2 - handles ## and ### headings
 */

export function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Convert headings (must be at line start)
  // H3 first (to avoid matching ## in ###)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  
  // Convert paragraphs
  // Split by double newlines
  const blocks = html.split(/\n\n+/);
  
  const processedBlocks = blocks.map(block => {
    const trimmed = block.trim();
    
    // Skip if already HTML tag
    if (trimmed.startsWith('<h2>') || trimmed.startsWith('<h3>') || trimmed.startsWith('<p')) {
      return trimmed;
    }
    
    // Empty block
    if (trimmed.length === 0) {
      return '';
    }
    
    // Wrap in paragraph
    return `<p>${trimmed}</p>`;
  });
  
  return processedBlocks.filter(b => b.length > 0).join('\n\n');
}
