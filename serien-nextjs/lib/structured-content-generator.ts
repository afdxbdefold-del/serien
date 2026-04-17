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

/**
 * Detect if a headline is likely in English rather than German.
 * Uses common English words that wouldn't appear in German headlines.
 */
function isLikelyEnglish(text: string): boolean {
  const lower = text.toLowerCase();
  // Common English words that rarely appear in German
  const englishIndicators = [
    /\bthe\b/, /\bhits\b/, /\bnew\b/, /\breturns?\b/, /\bstrong\b/,
    /\bseason\b/, /\bshow\b/, /\breveal(s|ed)?\b/, /\brenew(s|ed)?\b/,
    /\bcancel(s|ed|led)?\b/, /\bfirst\b/, /\blook\b/, /\bwhat\b/,
    /\bwhy\b/, /\bhow\b/, /\bgets?\b/, /\brating(s)?\b/,
    /\btrailer\b/, /\brelease\b/, /\bupdate\b/, /\bfinally\b/,
    /\bconfirm(s|ed)?\b/, /\bannounce[ds]?\b/, /\bwatch\b/,
    /\bcoming\b/, /\beverything\b/, /\bknow\b/, /\bbest\b/,
    /\bworst\b/, /\bbiggest\b/, /\bhigh\b/, /\bhigher\b/,
  ];
  // German indicators - if present, it's probably German
  const germanIndicators = [
    /\bder\b/, /\bdie\b/, /\bdas\b/, /\bein(e)?\b/, /\bund\b/,
    /\bfür\b/, /\bmit\b/, /\bvon\b/, /\bnach\b/, /\bneu(e|es|er|en)?\b/,
    /\bstaffel\b/, /\bserie\b/, /\bfolge\b/, /\bkehrt\b/,
    /\bwird\b/, /\bhat\b/, /\bist\b/, /\bsind\b/, /\bwurde\b/,
    /\büberraschend\b/, /\bendlich\b/, /\berstmals\b/, /ä|ö|ü|ß/,
  ];
  
  let englishScore = 0;
  let germanScore = 0;
  
  for (const pattern of englishIndicators) {
    if (pattern.test(lower)) englishScore++;
  }
  for (const pattern of germanIndicators) {
    if (pattern.test(lower)) germanScore++;
  }
  
  // If more English indicators than German, it's likely English
  return englishScore >= 2 && englishScore > germanScore;
}

interface StructuredContentInput {
  facts: any; // ExtractedFacts object from fact-extractor
  seriesName: string;
  originalHeadline: string;
  sourceText: string;
  contentType: 'NEWS' | 'ENDING_EXPLAINED' | 'RANKING';
  wordCountTarget?: number;
  temperature?: number;
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
  const { facts, seriesName, originalHeadline, contentType, wordCountTarget = 400, temperature } = input;
  
  console.log('📝 Generating structured content...');
  console.log(`   Series: ${seriesName}`);
  console.log(`   Type: ${contentType}`);
  console.log(`   Target: ${wordCountTarget} words`);
  if (temperature !== undefined) console.log(`   Temperature: ${temperature}`);
  
  // Build prompt based on content type
  const prompt = buildPrompt(input);
  
  // Call LLM with structured output
  const response = await callLLMStructured(prompt, 2, temperature);
  
  // Validate and assemble
  const output = assembleMarkdown(response);
  
  // Note: Headline wird durch Headline Engine in pipeline-v2 ersetzt.
  // Die Arbeits-Headline hier dient nur als Fallback.
  
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
  
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  
  const basePrompt = `Schreibe einen strukturierten Artikel über "${originalHeadline}" für serien.de.

Heutiges Datum: ${today}
Serie: ${seriesName}
Fakten: ${factsText}
${characterNames ? `Charaktere (MÜSSEN verwendet werden): ${characterNames}` : ''}

WICHTIG: Alle Datumsangaben müssen korrekt sein. Heute ist ${today}. Schreibe KEINE vergangenen Jahre als Zukunft. Wenn keine konkreten Termine bekannt sind, schreibe "ein Startdatum steht noch aus" statt ein Jahr zu raten.

SPRACHE: ALLES auf DEUTSCH - ohne Ausnahme!
- Die Headline MUSS auf Deutsch sein. Übersetze englische Quell-Headlines komplett ins Deutsche.
- Die metaDescription MUSS auf Deutsch sein.
- Der Lead MUSS auf Deutsch sein.
- Alle H2-Überschriften MÜSSEN auf Deutsch sein.
- Der gesamte Fließtext MUSS auf Deutsch sein.
- Alle Q&A-Fragen und Antworten MÜSSEN auf Deutsch sein.
- KEIN einziges englisches Wort im gesamten Output (Ausnahme: Seriennamen, Eigennamen wie "Netflix", "Disney+").
- Übersetze ALLE englischen Begriffe: "ratings" → "Quoten/Einschaltquoten", "hits new high" → "erreicht neuen Höchststand", "returns" → "kehrt zurück", "season" → "Staffel", "renewed" → "verlängert", etc.

Struktur:
1. headline: Erzeuge eine KURZE Arbeits-Headline auf Deutsch (wird später durch Headline Engine ersetzt). Max 70 Zeichen. Auf Deutsch.
2. metaDescription: Max 155 Zeichen, fasst den Kern des Artikels zusammen. Enthält den Seriennamen und den wichtigsten Fakt. Auf Deutsch.
3. lead: EXAKT 3 Sätze. Der Lead MUSS die Headline-Logik fortsetzen — nicht wiederholen, sondern weitertragen.

LEAD-REGELN (STRIKT):
- Wenn die Headline einen Konflikt enthält → Satz 1 beschreibt die Konsequenz
- Wenn die Headline eine Überraschung enthält → Satz 1 bestätigt und erweitert sie
- Wenn die Headline eine Veränderung enthält → Satz 1 erklärt was sich konkret ändert

Satz 1: Konsequenz / Bruch / Auswirkung (WAS passiert jetzt konkret?)
Satz 2: Fakten (Wer, Wo, Wann — Cast, Produktion, Plattform)
Satz 3: Warum das für die Story oder das Publikum relevant ist

VERBOTEN im Lead:
- NICHT mit einer Quelle beginnen ("Paramount hat...", "Netflix gab bekannt...")
- NICHT mit einer Zeitangabe beginnen ("In Staffel 2...", "Am 15. Mai...")
- NICHT neutral/generisch beginnen ("Es gibt Neuigkeiten zu...")
- NICHT die Headline umformulieren
- Wenn der Lead auf JEDEN beliebigen Artikel passen würde → Lead ist zu generisch

4. content: ${targetSections} Sections mit H2 (max 6 Wörter, auf Deutsch) + je 2-3 Absätze (2-4 Sätze)
5. qa: 3-5 häufige Fragen mit kurzen Antworten. Auf Deutsch.

Stil: Sachlich, journalistisch. Konkrete Namen statt generische Bezeichnungen ("Robby untersucht" statt "Ein Arzt untersucht"). Deutsche Anführungszeichen: „..."
Übersetze ALLE englischen Wörter aus den Fakten ins Deutsche (z.B. "approximately" → "etwa", "officially" → "offiziell", "wrapped filming" → "Dreharbeiten abgeschlossen"). Kein einziges englisches Wort im Fließtext.
Zielgruppe sind DEUTSCHE Leser. Nenne KEINE klassischen US-Fernsehsender (ABC, NBC, CBS, Fox, The CW) als Empfangshinweis. Beziehe dich stattdessen auf Streaming-Plattformen (Netflix, Disney+, Amazon Prime Video, Sky/WOW, Hulu, Paramount+, Apple TV+ etc.) oder schreibe allgemein "beim jeweiligen Streaming-Anbieter". US-Sender dürfen nur als Produktionshintergrund erwähnt werden, nicht als Empfangsempfehlung.`;

  return basePrompt;
}

/**
 * Call LLM with structured output format
 */
async function callLLMStructured(prompt: string, retries = 2, temperature?: number): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { createLLMClient, LLM_CONFIG } = await import('./llm-config');
      const openai = createLLMClient();

      const response = await openai.chat.completions.create({
        model: LLM_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'Du bist ein deutscher TV-Artikel-Generator für serien.de. ALLE Ausgaben MÜSSEN auf Deutsch sein - Headline, Meta-Description, Lead, Fließtext, H2-Überschriften, Q&A. Auch wenn die Quell-Headline englisch ist, MUSS deine Headline auf Deutsch sein. Antworte NUR mit validem JSON (keine Markdown-Codeblöcke, kein umgebender Text). Umlaute als ae/oe/ue schreiben ist NICHT nötig - verwende echte Umlaute (ä, ö, ü). Verwende KEINE deutschen Anführungszeichen wie „ oder " - nutze einfache Anführungszeichen oder schreibe ohne.',
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
      temperature: temperature ?? 0.7,
      max_tokens: 8192,
    });

    let content = response.choices[0]?.message?.content || '{}';
    
    // Debug: log first 300 chars of response
    console.log(`   📋 Raw LLM response (first 300): ${content.substring(0, 300)}`);
    
    // Use robust JSON parser
    const { parseJsonResponse } = await import('./json-utils');
    return parseJsonResponse(content);
    } catch (error: any) {
      lastError = error;
      const errorType = error.code || error.name || 'Unknown';
      console.log(`   ⚠️ LLM attempt ${attempt}/${retries} failed: [${errorType}] ${error.message}`);
      
      if (attempt < retries) {
        const delay = attempt * 2000; // 2s, 4s
        console.log(`   ⏳ Retrying in ${delay/1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  
  // All retries failed
  throw new Error(`LLM failed after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
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
