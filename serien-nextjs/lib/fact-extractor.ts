/**
 * STEP 3: Fact Extraction
 * Extracts structured facts from source articles
 * NO translation, NO rewriting, PRESERVE entities
 */

import OpenAI from 'openai';

export interface ExtractedFacts {
  series_names: string[];
  season_numbers: number[];
  episode_numbers: number[];
  people_names: string[];
  key_statements: string[];
  release_dates: string[];
  networks_platforms: string[];
}

const FACT_EXTRACTION_PROMPT = `You are a precise fact extraction system for TV series news articles.

Your ONLY task is to extract structured facts WITHOUT translating or rewriting.

RULES:
1. Extract exactly as written in the source (preserve original language and spelling)
2. DO NOT translate German to English or vice versa
3. DO NOT rephrase or rewrite
4. Extract ALL mentioned:
   - Series names (exactly as written)
   - Season numbers (e.g. "Staffel 3", "Season 5")
   - Episode numbers
   - People names (actors, directors, showrunners)
   - Key factual statements (quotes, announcements)
   - Release dates or timeframes
   - Networks/platforms mentioned

Return ONLY valid JSON (no markdown):
{
  "series_names": ["exact series name 1", "exact series name 2"],
  "season_numbers": [3, 5],
  "episode_numbers": [1, 8],
  "people_names": ["Name 1", "Name 2"],
  "key_statements": [
    "exact quote or fact 1",
    "exact quote or fact 2"
  ],
  "release_dates": ["2026", "Frühjahr 2026"],
  "networks_platforms": ["Netflix", "Disney+"]
}`;

export async function extractFacts(
  sourceTitle: string,
  sourceText: string
): Promise<ExtractedFacts> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://llmapi.emergentagent.com/v1',
  });

  const userPrompt = `
SOURCE ARTICLE:
Title: ${sourceTitle}

Text:
${sourceText.substring(0, 3000)}

Extract all facts now (preserve exact wording, no translation).
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: FACT_EXTRACTION_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from fact extractor');
    }

    const facts = JSON.parse(content) as ExtractedFacts;
    
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
