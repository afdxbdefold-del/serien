/**
 * Semantic H2 Heading Generator
 * Automatically adds proper H2/H3 structure to articles BEFORE publication
 * 
 * Uses LLM to generate semantic, contextual headings
 */

interface HeadingGeneratorConfig {
  contentHtml: string;
  articleTitle: string;
  seriesName: string;
}

/**
 * Analyze content and add semantic H2 headings
 */
export async function addSemanticHeadings(config: HeadingGeneratorConfig): Promise<string> {
  const { contentHtml, articleTitle, seriesName } = config;
  
  console.log('📝 Analyzing content structure...');
  
  // Check if H2s already exist
  const existingH2Count = (contentHtml.match(/<h2>/g) || []).length;
  
  if (existingH2Count > 0) {
    console.log(`   ℹ️  Already has ${existingH2Count} H2 tags, skipping generation`);
    return contentHtml;
  }
  
  console.log('   No H2 tags found, generating semantic structure...');
  
  // Split into paragraphs
  const paragraphMatches = contentHtml.match(/<p[^>]*>[\s\S]*?<\/p>/gi);
  
  if (!paragraphMatches || paragraphMatches.length < 4) {
    console.log(`   ⚠️  Too few paragraphs (found: ${paragraphMatches?.length || 0}, need: 4+)`);
    return contentHtml;
  }
  
  // Extract plain text from paragraphs (skip lead)
  const textParagraphs = paragraphMatches
    .map(p => p.replace(/<[^>]*>/g, ' ').trim())
    .filter(text => text.length > 50);
  
  if (textParagraphs.length < 4) {
    console.log(`   ⚠️  Not enough text paragraphs (found: ${textParagraphs.length}, need: 4+)`);
    return contentHtml;
  }
  
  console.log(`   Found ${textParagraphs.length} paragraphs, generating headings...`);
  
  // Use LLM to generate 3-4 semantic headings
  const headings = await generateHeadingsWithLLM(textParagraphs, articleTitle, seriesName);
  
  if (headings.length === 0) {
    console.log('   ⚠️  LLM failed to generate headings');
    return contentHtml;
  }
  
  // Insert headings into HTML
  const result = insertHeadingsIntoHtml(contentHtml, headings);
  
  const finalH2Count = (result.match(/<h2>/g) || []).length;
  console.log(`   ✅ Added ${finalH2Count} H2 headings`);
  
  return result;
}

/**
 * Generate semantic headings using LLM
 */
async function generateHeadingsWithLLM(
  paragraphs: string[],
  articleTitle: string,
  seriesName: string
): Promise<string[]> {
  const emergentApiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!emergentApiKey) {
    console.log('   ⚠️  No EMERGENT_LLM_KEY, cannot generate headings');
    return [];
  }
  
  // Take first 5 paragraphs for context
  const context = paragraphs.slice(0, 5).join('\n\n');
  
  const prompt = `Du bist ein professioneller Redakteur. Analysiere folgenden Artikel-Text und generiere 3-4 prägnante H2-Überschriften.

ARTIKEL-TITEL: ${articleTitle}
SERIE: ${seriesName}

ARTIKEL-TEXT:
${context}

ANFORDERUNGEN:
- 3-4 Überschriften
- Max 6 Wörter pro Überschrift
- Klar und informativ
- Keine Fragen
- Keine Clickbait

FORMAT (NUR die Überschriften, eine pro Zeile):`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: emergentApiKey,
      baseURL: 'http://localhost:8002/v1',  // Emergent proxy
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });
    
    const text = response.choices[0]?.message?.content || '';
    
    // Parse headings (one per line)
    const headings = text
      .split('\n')
      .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(line => line.length > 5 && line.length < 65)
      .slice(0, 4);
    
    headings.forEach((h, i) => console.log(`   ${i + 1}. "${h}"`));
    
    return headings;
  } catch (error: any) {
    console.log(`   ⚠️  LLM call failed: ${error.message}`);
    return [];
  }
}

/**
 * Insert headings into HTML at appropriate positions
 */
function insertHeadingsIntoHtml(html: string, headings: string[]): string {
  // Strategy: Insert H2 after every 2nd paragraph (skip lead)
  const parts = html.split('</p>');
  
  if (parts.length < 4) return html;
  
  let result = parts[0] + '</p>'; // Keep lead paragraph
  let headingIndex = 0;
  
  for (let i = 1; i < parts.length - 1; i++) {
    // Add heading every 2 paragraphs
    if (i % 2 === 1 && headingIndex < headings.length) {
      result += `\n\n<h2>${headings[headingIndex]}</h2>\n\n`;
      headingIndex++;
    }
    
    result += parts[i] + '</p>';
  }
  
  // Add last part (if any)
  if (parts[parts.length - 1].trim()) {
    result += parts[parts.length - 1];
  }
  
  return result;
}
