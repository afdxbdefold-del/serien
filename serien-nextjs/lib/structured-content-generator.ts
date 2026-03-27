/**
 * STRUCTURED CONTENT GENERATOR v2
 * 
 * Generates complete article structure in ONE LLM call:
 * - Headline
 * - Meta Description
 * - Lead (Intro)
 * - Content sections with H2 headings
 * - Q&A pairs
 * 
 * Output: Clean Markdown with proper ## headings
 */

interface StructuredContentInput {
  facts: any; // ExtractedFacts object from fact-extractor
  seriesName: string;
  originalHeadline: string;
  sourceText: string;
  contentType: 'NEWS' | 'ENDING_EXPLAINED' | 'RANKING';
  wordCountTarget?: number;
}

interface ContentSection {
  h2: string;
  paragraphs: string[];
}

interface StructuredContentOutput {
  headline: string;
  metaDescription: string;
  lead: string;
  sections: ContentSection[];
  qa: Array<{ question: string; answer: string }>;
  
  // Generated markdown (assembled from sections)
  markdown: string;
}

/**
 * Generate structured content with H2s built-in
 */
export async function generateStructuredContent(
  input: StructuredContentInput
): Promise<StructuredContentOutput> {
  const { facts, seriesName, originalHeadline, contentType, wordCountTarget = 400 } = input;
  
  console.log('📝 Generating structured content...');
  console.log(`   Series: ${seriesName}`);
  console.log(`   Type: ${contentType}`);
  console.log(`   Target: ${wordCountTarget} words`);
  
  // Build prompt based on content type
  const prompt = buildPrompt(input);
  
  // Call LLM with structured output
  const response = await callLLMStructured(prompt);
  
  // Validate and assemble
  const output = assembleMarkdown(response);
  
  console.log(`   ✅ Generated: ${output.sections.length} sections, ${output.qa.length} Q&A`);
  
  return output;
}

/**
 * Build prompt based on content type
 */
function buildPrompt(input: StructuredContentInput): string {
  const { facts, seriesName, originalHeadline, contentType, wordCountTarget } = input;
  
  // Convert facts object to flat list
  const factsList: string[] = [];
  
  if (facts.key_statements && facts.key_statements.length > 0) {
    factsList.push(...facts.key_statements);
  }
  if (facts.season_numbers && facts.season_numbers.length > 0) {
    factsList.push(`Staffeln/Seasons: ${facts.season_numbers.join(', ')}`);
  }
  if (facts.release_dates && facts.release_dates.length > 0) {
    factsList.push(`Release: ${facts.release_dates.join(', ')}`);
  }
  if (facts.networks_platforms && facts.networks_platforms.length > 0) {
    factsList.push(`Platforms: ${facts.networks_platforms.join(', ')}`);
  }
  if (facts.people_names && facts.people_names.length > 0) {
    factsList.push(`WICHTIGE PERSONEN/CHARAKTERE: ${facts.people_names.slice(0, 10).join(', ')}`);
  }
  if (facts.series_names && facts.series_names.length > 0) {
    factsList.push(`Serien: ${facts.series_names.join(', ')}`);
  }
  
  // Extract character names separately for emphasis
  const characterNames = facts.people_names && facts.people_names.length > 0 
    ? facts.people_names.slice(0, 10).join(', ')
    : '';
  
  const factsText = factsList.slice(0, 15).map((f, i) => `${i + 1}. ${f}`).join('\n') || '(Keine spezifischen Fakten extrahiert)';
  
  // Calculate sections needed
  const sectionsNeeded = Math.ceil(wordCountTarget / 150); // ~150 words per section
  const targetSections = Math.max(3, Math.min(sectionsNeeded, 5)); // 3-5 sections
  
  const basePrompt = `Du bist ein professioneller TV-Serien-Journalist für serien.de.

AUFGABE: Schreibe einen strukturierten deutschen Artikel über "${originalHeadline}".

SERIE: ${seriesName}

FAKTEN AUS QUELLE:
${factsText}

${characterNames ? `\n🎭 CHARAKTERE, DIE DU VERWENDEN MUSST:\n${characterNames}\n` : ''}

STRUKTUR-ANFORDERUNGEN:

1. HEADLINE (max 70 Zeichen)
   - Klar, informativ, SEO-optimiert
   - Keine Clickbait

2. META DESCRIPTION (max 155 Zeichen)
   - Zusammenfassung mit Hook
   - Enthält Serie + Hauptfakt

3. LEAD (2-3 Sätze, ~50 Wörter)
   - Beantwortet: Was ist neu? Warum wichtig?
   - NICHT den ersten Absatz wiederholen
   - Eigenständig und unique

4. CONTENT (${targetSections} Sections mit H2-Überschriften)
   
   Jede Section:
   - H2-ÜBERSCHRIFT: Max 6 Wörter, prägnant, informativ
   - 2-3 ABSÄTZE: Je 2-4 Sätze
   - Fließender Übergang zur nächsten Section
   
   🚨 KRITISCH - NAMEN VERWENDEN:
   ${characterNames ? `- Du MUSST diese Namen verwenden: ${characterNames}` : '- Verwende verfügbare Charakternamen'}
   - Nenne Namen beim ersten Vorkommen im Text (nicht in Überschriften)
   - Verwende z.B. "Robby untersucht den Fall" statt "Ein Arzt untersucht"
   - Vermeide: "das Team", "die Ärzte", "das Personal" → Nutze konkrete Namen!
   - Nach der ersten Erwähnung: Pronomen OK
   
   H2-Beispiele:
   ✅ "Verlängerung für Staffel 3 bestätigt"
   ✅ "Dreharbeiten starten im Sommer"
   ✅ "Neue Charaktere vorgestellt"
   ❌ "Was bedeutet das für die Fans?" (Frage)
   ❌ "Die spannende Entwicklung der Serie" (zu lang)

5. Q&A (3-5 Fragen)
   - Häufige User-Fragen
   - Kurze, klare Antworten (2-3 Sätze)

STIL:
- Professionell wie Serienjunkies
- Faktisch, nicht spekulativ
- Keine AI-Phrasen ("tauchen ein", "spannende Entwicklung")
- Deutsche Anführungszeichen: „..." nicht "..."
- 🎯 KONKRETE NAMEN VERWENDEN, NICHT GENERISCH SCHREIBEN

KRITISCHE REGEL:
${characterNames ? `Du MUSST mindestens 3 der folgenden Namen im Content verwenden: ${characterNames}` : 'Verwende alle verfügbaren Namen aus den Fakten'}
Nutze Namen statt "ein Arzt", "das Team", "die Crew"!`;

  return basePrompt;
}

/**
 * Call LLM with structured output format
 */
async function callLLMStructured(prompt: string): Promise<any> {
  const emergentApiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!emergentApiKey) {
    throw new Error('EMERGENT_LLM_KEY not found');
  }
  
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: emergentApiKey,
      baseURL: 'http://localhost:8002/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'Du bist ein Experte für strukturierte, professionelle TV-Serien-Artikel. Du folgst IMMER der vorgegebenen Struktur.',
        },
        {
          role: 'user',
          content: prompt + `

OUTPUT FORMAT (JSON):
{
  "headline": "string (max 70 chars)",
  "metaDescription": "string (max 155 chars)",
  "lead": "string (2-3 Sätze)",
  "sections": [
    {
      "h2": "string (max 6 Wörter)",
      "paragraphs": ["string", "string", "string"]
    }
  ],
  "qa": [
    {
      "question": "string",
      "answer": "string (2-3 Sätze)"
    }
  ]
}

Antworte NUR mit dem JSON, keine zusätzlichen Erklärungen.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error: any) {
    console.log(`   ❌ LLM call failed: ${error.message}`);
    throw error;
  }
}

/**
 * Assemble structured response into clean Markdown
 */
function assembleMarkdown(response: any): StructuredContentOutput {
  // Validate
  if (!response.headline || !response.sections || response.sections.length === 0) {
    throw new Error('Invalid LLM response: missing required fields');
  }
  
  // Build markdown
  let markdown = response.lead + '\n\n';
  
  response.sections.forEach((section: ContentSection) => {
    // Add H2
    markdown += `## ${section.h2}\n\n`;
    
    // Add paragraphs
    section.paragraphs.forEach((p: string) => {
      markdown += `${p}\n\n`;
    });
  });
  
  return {
    headline: response.headline,
    metaDescription: response.metaDescription || '',
    lead: response.lead,
    sections: response.sections,
    qa: response.qa || [],
    markdown: markdown.trim(),
  };
}
