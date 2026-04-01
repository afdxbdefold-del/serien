/**
 * STEP 4: AI Content Generator
 * Generates German news articles with natural paragraph structure
 */

import OpenAI from 'openai';
import { ExtractedFacts } from './fact-extractor';
import { generateNaturalArticleHTML, validateArticleHTML } from './article-formatter';
import { LLM_CONFIG } from './llm-config';


// EMERGENT_RULESET_UPDATE: RANKING_LIST Prompt
const CONTENT_GENERATION_PROMPT_RANKING = `Rolle: Redakteur bei serienjunkies.de.

Schreibe einen Ranking-Artikel (800-1800 Wörter) über die besten Episoden einer TV-Serie.

Aufbau:
- Einleitung (80-120 Wörter): Serie, Plattform, kulturelle Bedeutung, was diese Auswahl besonders macht.
- Pro Episode: **[Platz]. [Titel]** → Kontext (1 Satz), Highlight (2-3 Sätze mit Plot-Details), Begründung (1-2 Sätze). 80-150 Wörter pro Item.

Ton: Sachlich-enthusiastisch, faktenbasiert, keine Superlative. Jedes Item einzeln ausformulieren, keine Meta-Zusammenfassungen.

Reiner Text, Absätze durch Leerzeilen getrennt.`;

const CONTENT_GENERATION_PROMPT_NEWS = `Rolle: Redakteur bei serienjunkies.de. Sachlich, nüchtern, journalistisch.

Schreibe einen News-Artikel mit mindestens 4 Absätzen (2-4 Sätze, max 22 Wörter/Satz):

1. Lead: Was ist passiert? Welche Serie? Welcher Sender/Streamer?
2. Kontext: Staffelstatus, Produktion, Einordnung.
3. Details: Produktion, Besetzung, konkrete Informationen.
4. Weiteres: Zusätzliche Infos, keine Wiederholung des Leads.

Fakten zuerst, dann Einordnung. Keine Leser-Ansprache, keine Hype-Phrasen, keine Markdown-Formatierung. Reiner Text, Absätze durch Leerzeilen getrennt.`;

const CONTENT_GENERATION_PROMPT_FULL = `Rolle: Redakteur bei serienjunkies.de.

Schreibe einen vollständigen, originalen deutschen Artikel (450-900 Wörter, mindestens 5 Absätze).

Rechtlich: Quelltext NIEMALS wortwörtlich oder Satz-für-Satz übernehmen. Komplett neu formulieren, max 1-2 kurze Zitate.

Aufbau (je 2-4 Sätze, max 90 Wörter/Absatz):
1. Lead: Was ist passiert? Serie + Plattform. Klar und direkt.
2. Kontext: Staffelstatus, Timeline, Einordnung.
3. Details: Was ist bekannt? Was ist unbestätigt?
4. Weiterer Kontext: Cast, Produktion, verwandte Entwicklungen.
5. Ausblick: Was kommt als nächstes? Keine Spekulationen.

Ton: Neutral, sachlich, journalistisch. Keine Leser-Ansprache, keine Hype-Sprache.`;

const CONTENT_GENERATION_PROMPT_EDITORIAL = `Rolle: Redakteur bei serienjunkies.de.

Schreibe einen Editorial/Listicle-Artikel mit mindestens 5-7 Absätzen (2-4 Sätze, max 22 Wörter/Satz):

1. Lead: Thema, welche Serien, kurzer Überblick.
2-6. Pro Serie ein Absatz: Name, Sender/Streamer, Genre, Besonderheiten. Faktenbasiert.
7. Fazit oder Ausblick, keine Wiederholung des Leads.

Gehe auf JEDE genannte Serie einzeln ein. Erfinde nichts. Behalte Namen und Plattformen exakt bei. Neutral bis leicht wertend, keine Superlative. Reiner Text, keine Markdown-Formatierung.`;

export async function generateGermanArticle(
  facts: ExtractedFacts,
  primarySeriesName: string,
  contentType: 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL' | 'FULL_ARTICLE' | 'RANKING_LIST',
  allSeriesNames?: string[],
  sourceUrl?: string, // NEW: For adding "Quelle" block
  targetWordCount?: number, // NEW: Dynamic word count target based on source
  rankingItemCount?: number // NEW: For RANKING_LIST mode
): Promise<string> {
  const client = new OpenAI({
    apiKey: LLM_CONFIG.apiKey,
    baseURL: LLM_CONFIG.baseURL,
  });

  // Choose prompt based on content type
  let systemPrompt = CONTENT_GENERATION_PROMPT_NEWS;
  
  if (contentType === 'RANKING_LIST') {
    systemPrompt = CONTENT_GENERATION_PROMPT_RANKING;
  } else if (contentType === 'FULL_ARTICLE') {
    systemPrompt = CONTENT_GENERATION_PROMPT_FULL;
  } else if (contentType === 'MULTI_SERIES_EDITORIAL') {
    systemPrompt = CONTENT_GENERATION_PROMPT_EDITORIAL;
  }

  // Build facts prompt differently for each type
  let factsPrompt = '';
  
  if (contentType === 'RANKING_LIST') {
    // RANKING_LIST mode - expanded format
    const minWords = targetWordCount ? Math.max(800, targetWordCount - 200) : 800;
    const maxWords = targetWordCount ? Math.min(1800, targetWordCount + 200) : 1800;
    const targetWords = targetWordCount || 1200;
    const itemCount = rankingItemCount || 15;
    const wordsPerItem = Math.floor(targetWords / (itemCount + 2)); // +2 for intro/outro
    
    factsPrompt = `
FAKTEN FÜR DEN RANKING-ARTIKEL:
Serie: ${primarySeriesName}
${facts.season_numbers.length > 0 ? `Staffeln: ${facts.season_numbers.join(', ')}` : ''}
${facts.networks_platforms.length > 0 ? `Plattform: ${facts.networks_platforms.join(', ')}` : ''}
Anzahl Items im Ranking: ${itemCount}

KEY STATEMENTS (Details zu Episoden/Items):
${facts.key_statements.slice(0, Math.min(20, itemCount * 2)).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ARTIKEL-TYP: Ranking/Liste der besten Episoden
ZIEL-LÄNGE: ${targetWords} Wörter (Range: ${minWords}-${maxWords} Wörter)
Wörter pro Item: ca. ${wordsPerItem} Wörter

WICHTIG:
- Einleitung: 80-120 Wörter
- JEDES der ${itemCount} Items: ${Math.max(80, wordsPerItem)} Wörter
- Jedes Item mit konkreten Plot-Details
- KEINE generischen Zusammenfassungen
- Nutze ALLE verfügbaren Details aus den KEY STATEMENTS

Schreibe jetzt den vollständigen Ranking-Artikel (${minWords}-${maxWords} Wörter).
`.trim();
  } else if (contentType === 'FULL_ARTICLE') {
    // FULL ARTICLE mode - use dynamic word count if provided
    const minWords = targetWordCount ? Math.max(350, targetWordCount - 150) : 450;
    const maxWords = targetWordCount ? Math.min(1200, targetWordCount + 150) : 900;
    const targetWords = targetWordCount || 650;
    
    factsPrompt = `
FAKTEN FÜR DEN ARTIKEL:
Serie: ${primarySeriesName}
${facts.season_numbers.length > 0 ? `Staffeln: ${facts.season_numbers.join(', ')}` : ''}
${facts.people_names.length > 0 ? `Personen: ${facts.people_names.slice(0, 10).join(', ')}` : ''}
${facts.networks_platforms.length > 0 ? `Plattformen: ${facts.networks_platforms.join(', ')}` : ''}
${facts.release_dates.length > 0 ? `Zeitrahmen: ${facts.release_dates.join(', ')}` : ''}

KEY STATEMENTS:
${facts.key_statements.slice(0, 12).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ARTIKEL-TYP: Vollständiger Artikel
ZIEL-LÄNGE: ${targetWords} Wörter (Range: ${minWords}-${maxWords} Wörter)
HAUPT-SERIE: ${primarySeriesName}

WICHTIG: 
- Schreibe einen KOMPLETT NEUEN Artikel basierend auf diesen Fakten
- NIEMALS Originaltext kopieren oder paraphrasieren
- Ziel: ca. ${targetWords} Wörter (mindestens ${minWords}, maximal ${maxWords})
- NUTZE ALLE verfügbaren Fakten und Details
- Bei langen Quellen: Gehe in die Tiefe, erkläre ausführlich

Schreibe jetzt den vollständigen deutschen Artikel (${minWords}-${maxWords} Wörter).
`.trim();
  } else if (contentType === 'SINGLE_SERIES_NEWS') {
    factsPrompt = `
FAKTEN FÜR DEN ARTIKEL:
Serie: ${primarySeriesName}
${facts.season_numbers.length > 0 ? `Staffeln: ${facts.season_numbers.join(', ')}` : ''}
${facts.people_names.length > 0 ? `Personen: ${facts.people_names.slice(0, 10).join(', ')}` : ''}
${facts.networks_platforms.length > 0 ? `Plattformen: ${facts.networks_platforms.join(', ')}` : ''}
${facts.release_dates.length > 0 ? `Zeitrahmen: ${facts.release_dates.join(', ')}` : ''}

KEY STATEMENTS:
${facts.key_statements.slice(0, 8).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ARTIKEL-TYP: News-Artikel über eine Serie
HAUPT-SERIE: ${primarySeriesName}

Schreibe jetzt den deutschen Artikel (nur Text, Absätze durch Leerzeilen trennen).
`.trim();
  } else {
    // MULTI_SERIES_EDITORIAL
    const seriesList = allSeriesNames && allSeriesNames.length > 0 
      ? allSeriesNames 
      : facts.series_names;
    
    factsPrompt = `
FAKTEN FÜR DEN ARTIKEL:
Serien (insgesamt ${seriesList.length}):
${seriesList.map((name, i) => `  ${i + 1}. ${name}`).join('\n')}

${facts.networks_platforms.length > 0 ? `Plattformen: ${facts.networks_platforms.join(', ')}` : ''}
${facts.release_dates.length > 0 ? `Zeitrahmen: ${facts.release_dates.join(', ')}` : ''}

KEY STATEMENTS:
${facts.key_statements.slice(0, 10).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ARTIKEL-TYP: Editorial/Listicle über mehrere Serien
WICHTIG: Gehe auf JEDE der ${seriesList.length} Serien einzeln ein!

Schreibe jetzt den deutschen Artikel (nur Text, Absätze durch Leerzeilen trennen).
`.trim();
  }

  try {
    const response = await client.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: factsPrompt }
      ],
      temperature: 0.7,
      max_completion_tokens: contentType === 'FULL_ARTICLE' 
        ? Math.min(3500, Math.max(2000, (targetWordCount || 650) * 3)) // Dynamic based on target
        : (contentType === 'MULTI_SERIES_EDITORIAL' ? 2000 : 1500),
    });

    const rawContent = response.choices[0]?.message?.content;
    
    if (!rawContent) {
      throw new Error('No content generated');
    }

    console.log('✅ Raw content generated');
    console.log(`   Length: ${rawContent.length} characters`);

    // AGGRESSIVE CLEANUP: Remove ALL HTML tags that LLM might have added
    let cleanedContent = rawContent.replace(/<[^>]+>/g, '');
    
    // Clean up LLM artifacts and hallucinations
    cleanedContent = cleanedContent
      // Remove generic filler sentences - MOST FLEXIBLE PATTERN
      // Matches: "Die [anything]-Serie "[anything]" berichtet über die neue staffel"
      .replace(/Die\s+.+?(Serie|Plattform)\s+[„"].+?[""]?\s+berichtet\s+über\s+die\s+neue\s+staffel\.?/gi, '')
      // Simpler variation without "Die"
      .replace(/[„"].+?[""]?\s+berichtet\s+über\s+die\s+neue\s+staffel\.?/gi, '')
      // Remove standalone "Inhaltlich steht" that sometimes appears orphaned
      .replace(/^\s*Inhaltlich steht\s*/gm, '')
      // Clean up double spaces and empty lines
      .replace(/\s{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log('🧹 Cleaned LLM artifacts');

    // Apply Natural Paragraph Formatter (STEP 4 + Natural Paragraphs Feature!)
    console.log('📝 Applying natural paragraph structure...');
    
    const formattedHTML = generateNaturalArticleHTML(
      cleanedContent,
      primarySeriesName,
      {
        includeSubheading: cleanedContent.split(/\s+/).length > 500,
        subheadingText: contentType === 'MULTI_SERIES_EDITORIAL' 
          ? `Alle Serien im Überblick`
          : `Mehr zu ${primarySeriesName}`
      }
    );

    // Validate
    const validation = validateArticleHTML(formattedHTML);
    if (!validation.valid) {
      console.error('❌ Validation failed:');
      validation.errors.forEach(e => console.error('  - ' + e));
      throw new Error('Generated content failed validation');
    }

    console.log('✅ Content validated and formatted');
    
    return formattedHTML;
    
  } catch (error: any) {
    console.error('❌ Content generation failed:', error.message);
    throw error;
  }
}
