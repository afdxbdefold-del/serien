import { parseJsonResponse } from './json-utils';
/**
 * STEP 3: Fact Extraction
 * Extracts structured facts from source articles
 * NO translation, NO rewriting, PRESERVE entities
 */

import { createLLMClient, LLM_CONFIG } from './llm-config';

export interface ExtractedFacts {
  series_names: string[];
  season_numbers: number[];
  episode_numbers: number[];
  people_names: string[];
  key_statements: string[];
  release_dates: string[];
  networks_platforms: string[];
}

const FACT_EXTRACTION_PROMPT = `Extrahiere strukturierte Fakten aus TV-Serien-Artikeln. Bewahre Originalsprache und Schreibweise exakt. Nicht übersetzen, nicht umformulieren.

Extrahiere: Seriennamen, Staffelnummern, Episodennummern, Personennamen (Schauspieler, Regisseure, Showrunner), zentrale Fakten-Aussagen (Zitate, Ankündigungen), Veröffentlichungstermine, Sender/Plattformen.

Antwort als JSON (kein Markdown):
{
  "series_names": [],
  "season_numbers": [],
  "episode_numbers": [],
  "people_names": [],
  "key_statements": [],
  "release_dates": [],
  "networks_platforms": []
}`;

export async function extractFacts(
  sourceTitle: string,
  sourceText: string
): Promise<ExtractedFacts> {
  const client = createLLMClient();

  const userPrompt = `
SOURCE ARTICLE:
Title: ${sourceTitle || 'Untitled'}

Text:
${(sourceText || '').substring(0, 3000)}

Extract all facts now (preserve exact wording, no translation).
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: FACT_EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0,
      max_completion_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    const finishReason = response.choices[0]?.finish_reason;
    
    if (!content) {
      throw new Error('No response from fact extractor');
    }
    
    // If truncated, try to repair the JSON
    if (finishReason === 'length') {
      console.log('   ⚠️ Fact extraction truncated, attempting repair...');
    }

    const facts = parseJsonResponse(content) as ExtractedFacts;
    
    console.log('✅ Facts extracted:');
    console.log(`  Series: ${facts.series_names.length}`);
    console.log(`  People: ${facts.people_names.length}`);
    console.log(`  Key statements: ${facts.key_statements.length}`);
    
    return facts;
    
  } catch (error: any) {
    console.error('❌ Fact extraction failed:', error.message);
    throw error;
  }
}
