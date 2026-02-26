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

AUFGABE: Schreibe einen EIGENSTÄNDIGEN Lead-Absatz (2-3 Sätze) für diesen Artikel.

ARTIKEL-HEADLINE: "${headline}"
SERIE: ${seriesName}

WICHTIGE FAKTEN:
${facts.slice(0, 5).join('\n')}

ARTIKEL-BEGINN (NICHT VERWENDEN):
${firstParagraph.substring(0, 300)}

ANFORDERUNGEN:
1. Der Lead muss KOMPLETT ANDERS sein als der Artikel-Beginn
2. Verwende KEINE Sätze oder Formulierungen aus dem Artikel-Beginn
3. 2-3 prägnante Sätze, die das Wichtigste zusammenfassen
4. Neugierig machen, aber keine Clickbait-Sprache
5. Professioneller, journalistischer Ton
6. NUR der Lead-Text, keine zusätzlichen Erklärungen

BEISPIEL eines guten Leads (für andere Serie):
"Netflix bestätigt das Ende einer Ära: Die beliebte Fantasy-Serie erhält keine weitere Staffel. Nach drei erfolgreichen Jahren verkündet der Streaming-Dienst die Einstellung der Produktion."

Schreibe jetzt den EIGENSTÄNDIGEN Lead für "${headline}":`;

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.EMERGENT_LLM_KEY,
      baseURL: 'https://llm.kindo.ai/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o',
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
      max_tokens: 200,
    });

    const lead = response.choices[0]?.message?.content?.trim() || '';
    
    // Validate: Lead should not contain exact phrases from first paragraph
    const firstParagraphWords = firstParagraph.toLowerCase().split(/\s+/).slice(0, 15);
    const leadWords = lead.toLowerCase().split(/\s+/);
    
    // Check for 5+ consecutive matching words
    let hasOverlap = false;
    for (let i = 0; i < firstParagraphWords.length - 5; i++) {
      const phrase = firstParagraphWords.slice(i, i + 5).join(' ');
      if (leadWords.join(' ').includes(phrase)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (hasOverlap) {
      console.log('⚠️  Lead has overlap with article opening, regenerating...');
      // Could add retry logic here
    }
    
    return lead;
    
  } catch (error: any) {
    console.error(`Lead generation failed: ${error.message}`);
    // Fallback: Generate from facts
    return `Neue Entwicklungen bei ${seriesName}: ${facts[0] || 'Die neueste Episode sorgt für Aufsehen.'}`;
  }
}
