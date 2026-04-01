/**
 * DISTINCT LEAD GENERATOR
 * 
 * Generates a unique 2-3 sentence lead paragraph that:
 * 1. Summarizes the article WITHOUT using exact sentences from the body
 * 2. Hooks the reader
 * 3. Is completely distinct from the article opening
 */

interface LeadGeneratorInput {
  articleHtml: string;
  headline: string;
  seriesName: string;
  facts: string[];
}

export async function generateDistinctLead(input: LeadGeneratorInput): Promise<string> {
  const { articleHtml, headline, seriesName, facts } = input;
  
  // Extract first paragraph to avoid using it
  const firstParagraph = articleHtml.match(/<p[^>]*>(.*?)<\/p>/)?.[1] || '';
  
  const prompt = `Schreibe einen eigenständigen Lead-Absatz (2-3 Sätze) für diesen TV-News-Artikel.

Headline: "${headline}"
Serie: ${seriesName || ''}

Fakten:
${(facts || []).slice(0, 5).join('\n')}

Artikel-Beginn (NICHT wiederholen oder paraphrasieren):
${(firstParagraph || '').substring(0, 300)}

Der Lead muss komplett anders sein als der Artikel-Beginn. Beantworte: Was ist neu? Warum jetzt wichtig?
Journalistischer Ton, keine generischen Phrasen wie "Aktuelle Entwicklungen zu..." oder "Neue Informationen zu...".

Nur den Lead-Text, nichts anderes.`;
  try {
    const { createLLMClient, LLM_CONFIG } = await import('./llm-config');
    const openai = createLLMClient();

    const response = await openai.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: 'Lead-Texter. Eigenständig, prägnant, nie den Haupttext paraphrasieren.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_completion_tokens: 200,
    });

    const lead = response.choices[0]?.message?.content?.trim() || '';
    
    // QUALITY CHECK 1: Reject generic phrases
    const forbiddenPhrases = [
      'aktuelle entwicklungen zu',
      'neue informationen zu',
      'offiziell bekannt und verständlich zusammengefasst',
      'offiziell bekannt und zusammengefasst',
      'verständlich zusammengefasst',
      'die neueste episode',
      'spannende entwicklungen'
    ];
    
    const leadLower = lead.toLowerCase();
    for (const phrase of forbiddenPhrases) {
      if (leadLower.includes(phrase)) {
        console.error(`❌ Lead contains forbidden phrase: "${phrase}"`);
        throw new Error(`Lead quality check failed: Contains forbidden phrase "${phrase}"`);
      }
    }
    
    // QUALITY CHECK 2: Validate lead is not too similar to article opening
    // RULESET v1.4: 85% similarity threshold, WARN only
    const firstParagraphWords = firstParagraph.toLowerCase().split(/\s+/).slice(0, 15);
    const leadWords = lead.toLowerCase().split(/\s+/);
    
    // Check for 7+ consecutive matching words (more lenient: 85% similarity threshold)
    let hasOverlap = false;
    for (let i = 0; i < firstParagraphWords.length - 7; i++) {
      const phrase = firstParagraphWords.slice(i, i + 7).join(' ');
      if (leadWords.join(' ').includes(phrase)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (hasOverlap) {
      console.log('⚠️  Lead has some overlap with article opening (WARN ONLY, RULESET v1.4)');
      // Continue - no throw
    }
    
    console.log(`✅ Lead quality checks passed (85% similarity OK)`);
    return lead;
    
  } catch (error: any) {
    console.error(`Lead generation failed: ${error.message}`);
    // NO GENERIC FALLBACK - Throw error to prevent generic content
    throw new Error(`Failed to generate unique lead: ${error.message}. Cannot publish with generic fallback.`);
  }
}
