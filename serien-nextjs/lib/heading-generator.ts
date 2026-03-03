/**
 * Semantic H2 Heading Generator
 * Automatically adds proper H2/H3 structure to articles BEFORE publication
 * 
 * Generates contextual headings for each section
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
  
  console.log(`   Found ${paragraphMatches.length} paragraphs, generating headings...`);
  
  // Strategy: Add H2 before paragraphs 3, 5, 7 (after lead, every 2 paragraphs)
  let result = '';
  const headingPositions = [2, 4, 6]; // Indices where to insert H2 (before these paragraphs)
  
  for (let i = 0; i < paragraphMatches.length; i++) {
    // Check if we should add H2 before this paragraph
    if (headingPositions.includes(i) && i < paragraphMatches.length) {
      // Generate heading based on THIS paragraph
      const heading = await generateHeadingForParagraph(
        paragraphMatches[i],
        seriesName,
        articleTitle
      );
      
      if (heading) {
        result += `<h2>${heading}</h2>\n\n`;
        console.log(`   ✅ H2: "${heading}"`);
      }
    }
    
    result += paragraphMatches[i] + '\n\n';
  }
  
  const finalH2Count = (result.match(/<h2>/g) || []).length;
  console.log(`   ✅ Generated ${finalH2Count} H2 headings`);
  
  return result.trim();
}

/**
 * Generate a heading for a specific paragraph using LLM
 */
async function generateHeadingForParagraph(
  paragraph: string,
  seriesName: string,
  articleTitle: string
): Promise<string | null> {
  const emergentApiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!emergentApiKey) {
    console.log('   ⚠️  No EMERGENT_LLM_KEY');
    return null;
  }
  
  // Extract plain text
  const plainText = paragraph.replace(/<[^>]*>/g, ' ').trim();
  
  if (plainText.length < 50) {
    return null; // Too short
  }
  
  const prompt = `Du bist ein professioneller Redakteur. Erstelle eine prägnante H2-Überschrift für folgenden Absatz.

ARTIKEL: ${articleTitle}
SERIE: ${seriesName}

ABSATZ:
${plainText.substring(0, 300)}

ANFORDERUNGEN:
- Max 6 Wörter
- Klar und informativ
- Fasse den Absatz zusammen
- Keine Frage
- Keine Clickbait

NUR die Überschrift (ohne Anführungszeichen):`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: emergentApiKey,
      baseURL: 'http://localhost:8002/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 50,
    });
    
    const heading = response.choices[0]?.message?.content?.trim() || '';
    
    // Clean up
    const cleaned = heading
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^H2:\s*/i, '') // Remove "H2:" prefix
      .trim();
    
    // Validate
    if (cleaned.length > 5 && cleaned.length < 65) {
      return cleaned;
    }
    
    return null;
  } catch (error: any) {
    console.log(`   ⚠️  LLM failed: ${error.message}`);
    return null;
  }
}
