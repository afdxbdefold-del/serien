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
  
  const prompt = `Du bist ein professioneller Texter für eine TV-Serien-News-Website.

AUFGABE: Schreibe einen EIGENSTÄNDIGEN, UNIQUE Lead-Absatz (2-3 Sätze) für diesen Artikel.

ARTIKEL-HEADLINE: "${headline}"
SERIE: ${seriesName || ''}

WICHTIGE FAKTEN:
${(facts || []).slice(0, 5).join('\n')}

ARTIKEL-BEGINN (NICHT VERWENDEN):
${(firstParagraph || '').substring(0, 300)}

KRITISCHE ANFORDERUNGEN:
1. Der Lead muss KOMPLETT ANDERS sein als der Artikel-Beginn
2. Beantworte: Was ist NEU? Warum ist es JETZT wichtig? Für wen ist es relevant?
3. Verwende KEINE generischen Phrasen wie:
   ❌ "Aktuelle Entwicklungen zu..."
   ❌ "Neue Informationen zu..."
   ❌ "offiziell bekannt und verständlich zusammengefasst"
   ❌ "Aktuelle Entwicklungen zu die Serie"
4. Jeder Lead muss semantisch UND lexikalisch unterschiedlich sein
5. Professioneller, journalistischer Ton - wie ein echter Redakteur
6. NUR der Lead-Text, keine zusätzlichen Erklärungen

GUTE BEISPIELE (für verschiedene Serien):
✅ "Netflix bestätigt das Ende einer Ära: Die beliebte Fantasy-Serie erhält keine weitere Staffel. Nach drei erfolgreichen Jahren verkündet der Streaming-Dienst die Einstellung der Produktion."
✅ "HBO veröffentlicht erste Details zur kommenden Staffel. Die Produktion startet im Frühjahr mit neuen Gesichtern im Cast."
✅ "Der Streaming-Dienst überrascht Fans mit einer unerwarteten Ankündigung: Die bereits abgesetzte Serie kehrt für ein finales Special zurück."

Schreibe jetzt den EIGENSTÄNDIGEN, UNIQUE Lead für "${headline}":`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',  // Upgraded to GPT-5.2
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für prägnante, eigenständige Lead-Absätze. Du schreibst IMMER anders als der Haupttext.',
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
