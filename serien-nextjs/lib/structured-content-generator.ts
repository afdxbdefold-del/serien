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
 * Build prompt for list/ranking articles (e.g., "10 Shows like X")
 */
function buildListArticlePrompt(
  input: StructuredContentInput, 
  targetSections: number, 
  factsText: string, 
  characterNames: string
): string {
  const { seriesName, originalHeadline, wordCountTarget } = input;
  
  return `Du bist ein professioneller TV-Serien-Journalist für serien.de.

AUFGABE: Schreibe einen LISTENARTIKEL über "${originalHeadline}".

HAUPTSERIE: ${seriesName}

FAKTEN:
${factsText}

STRUKTUR:

1. HEADLINE (max 70 Zeichen)

2. META DESCRIPTION (140-160 Zeichen)
   - MUSS enthalten: Serienname + Anzahl + Keyword
   - Neugier erzeugen!
   
   Beispiel: "14 Serien wie The Big Bang Theory? Die besten Alternativen zum Streamen – von Friends bis Young Sheldon."

3. LEAD (2-3 Sätze)

4. CONTENT (${targetSections} Sections)
   
   WICHTIG: Jede vorgestellte Serie bekommt EINE EIGENE H2-Section!
   
   Format pro Serie:
   ## 1. [Serienname]
   [2-3 Absätze: Worum geht es? Warum passt sie? Wo streamen?]
   
   ## 2. [Nächste Serie]
   [2-3 Absätze]
   
   etc.

5. Q&A (3-4 Fragen)

STIL:
- Jede Serie mind. 80-100 Wörter
- Streaming-Plattformen nennen
- Nicht zu kurz - alle Serien ausführlich vorstellen!

ZIELWORTANZAHL: ~${wordCountTarget} Wörter`;
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
  
  // Calculate sections needed - more for RANKING/list articles
  const sectionsNeeded = Math.ceil(wordCountTarget / 150); // ~150 words per section
  const targetSections = contentType === 'RANKING' 
    ? Math.max(5, Math.min(sectionsNeeded, 15)) // 5-15 sections for lists
    : Math.max(3, Math.min(sectionsNeeded, 7)); // 3-7 sections for news
  
  // Special prompt for list/ranking articles
  const isListArticle = contentType === 'RANKING';
  
  const basePrompt = isListArticle ? buildListArticlePrompt(input, targetSections, factsText, characterNames) : `Du bist ein professioneller TV-Serien-Journalist für serien.de.

AUFGABE: Schreibe einen strukturierten deutschen Artikel über "${originalHeadline}".

SERIE: ${seriesName}

FAKTEN AUS QUELLE:
${factsText}

${characterNames ? `\n🎭 CHARAKTERE, DIE DU VERWENDEN MUSST:\n${characterNames}\n` : ''}

STRUKTUR-ANFORDERUNGEN:

1. HEADLINE (max 70 Zeichen)
   - Klar, informativ, SEO-optimiert
   - Keine Clickbait

2. META DESCRIPTION (140-160 Zeichen)
   - MUSS enthalten: Serienname + Keyword (Start/Handlung/Cast/Staffel)
   - Neugier erzeugen → User soll klicken wollen!
   - Sauberes Deutsch, keine Encoding-Probleme
   
   Beispiel-Struktur:
   "Kommt Staffel X von [Serie]? Alle Infos zu Start, Handlung und Cast – aktueller Stand und Prognose."
   "Wer stirbt in Staffel X von [Serie]? Die schockierenden Todesfälle im Cast und was dahinter steckt."

3. LEAD (2-3 Sätze, ~50 Wörter)
   - Beantwortet: Was ist neu? Warum wichtig?
   - NICHT den ersten Absatz wiederholen
   - Eigenständig und unique
   - MUSS einen konkreten Fakt enthalten (Datum, Name, Zahl)

4. CONTENT (${targetSections} Sections mit H2-Überschriften)
   
   Jede Section:
   - H2-ÜBERSCHRIFT: Max 6 Wörter, prägnant, informativ
   - 2-3 ABSÄTZE: Je 2-3 Sätze (NIEMALS mehr als 3 Sätze pro Absatz!)
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

🚫 ANTI-AI REGELN (STRIKT BEFOLGEN):

⛔ KRITISCH - KEINE ERFUNDENEN FAKTEN:
- Schreibe NUR über Informationen aus den FAKTEN oben
- ERFINDE KEINE Daten, Staffelnummern, Release-Termine
- Wenn du etwas nicht weißt, lass es weg
- NIEMALS "neue Staffel", "Revival", "Fortsetzung", "Rückkehr" behaupten, wenn nicht EXPLIZIT in Fakten steht
- "Neu auf Disney+" / "Neu auf Netflix" = Serie ist jetzt dort VERFÜGBAR zum Streamen, NICHT neue Staffel!
- "Exklusiv auf X" = Alte Serie wechselt Streaming-Dienst, KEIN neuer Content!

⛔ VERBOTENE BEGRIFFE für Streaming-Ankündigungen:
- "Revival", "Comeback", "kehrt zurück", "neue Staffel", "Fortsetzung"
- Stattdessen: "jetzt verfügbar", "ab sofort streambar", "wechselt zu"

VERBOTENE WÖRTER/PHRASEN (NIEMALS verwenden):
- "tauchen ein", "eintauchen"
- "spannend", "aufregend", "fesselnd"
- "Darüber hinaus", "Insgesamt", "Zusammenfassend"
- "Es ist wichtig zu beachten", "Es bleibt abzuwarten"
- "verspricht", "sorgt für Aufsehen", "begeistert Fans"
- "emotional", "mitreißend", "packend"

SATZANFÄNGE:
- NIEMALS zwei aufeinanderfolgende Sätze gleich beginnen
- Variiere: "Die", "Nach", "Mit", "Im", "Laut", "Bereits", Name + Verb
- Statt "Die Serie zeigt... Die Fans..." → "Die Serie zeigt... Fans erwarten..."

ABSÄTZE:
- Max 3 Sätze pro Absatz
- Erster Absatz = konkreter Fakt (Datum, Zahl, Name)
- Kurz und direkt, keine Füllsätze

STIL:
- Schreibe wie ein erfahrener Redakteur, nicht wie eine KI
- Fakten vor Meinungen
- Konkret vor abstrakt
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
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('No LLM API key found');
  }
  
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey,
      baseURL: 'https://api.openai.com/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
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
      max_completion_tokens: 2000,
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
