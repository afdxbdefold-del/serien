/**
 * STEP 4: AI Content Generator
 * Generates German news articles with natural paragraph structure
 */

import OpenAI from 'openai';
import { ExtractedFacts } from './fact-extractor';
import { generateNaturalArticleHTML, validateArticleHTML } from './article-formatter';


// EMERGENT_RULESET_UPDATE: RANKING_LIST Prompt
const CONTENT_GENERATION_PROMPT_RANKING = `Du bist ein erfahrener Redakteur im Stil von serienjunkies.de.

AUFGABE: Erstelle einen deutschen Ranking-Artikel über die besten Episoden einer TV-Serie.

ZIEL-LÄNGE: 800-1800 Wörter (abhängig von Anzahl der Items)

STRUKTUR:

EINLEITUNG (80-120 Wörter):
- Nenne die Serie und Plattform
- Kurzer Kontext zur Serie (Laufzeit, Staffeln, kulturelle Bedeutung)
- Was macht diese Auswahl besonders
- 2-3 Absätze

RANKING-LISTE:
Für JEDES der Top-Episoden/Items:

**[Platzierung]. [Episode-Titel oder Nummer]**
- KONTEXT: In welcher Staffel, welcher Handlungsbogen? (1 Satz)
- HIGHLIGHT: Was passiert in dieser Episode? (2-3 Sätze mit konkreten Details)
- WARUM TOP: Warum gehört sie zu den Besten? (1-2 Sätze)

Länge pro Item: 80-150 Wörter

WICHTIGE REGELN:
- KEINE Meta-Zusammenfassung ("Die folgenden Episoden...")
- JEDES Item einzeln ausformulieren
- Konkrete Plot-Details verwenden
- Keine Platzhalter oder generische Beschreibungen
- Absätze klar trennen

TONALITÄT:
- Sachlich, aber enthusiastisch
- Faktenbasiert
- Keine Übertreibungen
- Glaubwürdig

ABSOLUT VERBOTEN:
- "Fans werden begeistert sein"
- "Eine der besten Serien aller Zeiten"
- Leere Superlative
- KI-Phrasen

Schreibe jetzt den vollständigen Ranking-Artikel (reiner Text, Absätze durch Leerzeilen getrennt).`;

const CONTENT_GENERATION_PROMPT_NEWS = `Du bist ein erfahrener Redakteur im Stil von serienjunkies.de.

SCHREIBREGELN:
- Sachlich, nüchtern, journalistisch
- Keine Emojis, kein Marketing-Ton
- Keine Clickbait-Fragen
- Kurze, klare Sätze (max. 22 Wörter pro Satz)
- Absätze mit 2–4 Sätzen
- Fakten zuerst, Einordnung danach

STRUKTUR:

Schreibe mindestens 4 Absätze!

LEAD (Absatz 1):
- Was ist passiert?
- Welche Serie?
- Bei welchem Sender/Streamer?
- Bestätigt, nicht spekulativ
- 2-3 Sätze

ABSATZ 2:
- Kontext (z. B. Staffelstatus, Produktion, Einordnung)
- 2-4 Sätze

ABSATZ 3:
- Weitere Details zur Produktion oder Besetzung
- 2-4 Sätze

ABSATZ 4+:
- Zusätzliche Informationen
- ggf. Vergleich zu früheren Staffeln
- KEINE Wiederholung des Leads

ABSOLUT VERBOTEN:
- "Fans dürfen sich freuen"
- "Ein absolutes Highlight"
- "Endlich ist es soweit"
- "Die beliebte Serie"
- "Wie jetzt bekannt wurde"
- "Sorgt für Aufsehen"
- Hohlphrasen

TONALITÄT:
- Neutral
- Informierend
- Glaubwürdig
- Wie ein echter Redakteur, nicht wie KI

WICHTIG:
- Nutze ALLE relevanten Fakten
- Erfinde NICHTS
- Behalte Namen, Daten exakt bei
- Keine Markdown-Formatierung

Schreibe jetzt den Artikel als reinen Text (ein Absatz pro Zeile, durch Leerzeilen getrennt).`;

const CONTENT_GENERATION_PROMPT_FULL = `Du bist ein erfahrener Redakteur im Stil von serienjunkies.de.

AUFGABE: Schreibe einen VOLLSTÄNDIGEN, ORIGINALEN deutschen Artikel (450-900 Wörter).

RECHTLICHE/SEO-REGELN:
- NIEMALS Quell-Text wortwörtlich übernehmen
- NIEMALS Satz-für-Satz paraphrasieren
- MAX 1-2 kurze Zitate erlaubt (<= 20 Wörter), nur wenn nötig
- Schreibe KOMPLETT NEU basierend auf den Fakten

LÄNGE: 450-900 Wörter (mindestens 350 Wörter)

STRUKTUR (mindestens 5 Absätze):

ABSATZ 1 (Lead):
- Was ist passiert? (Fakten only)
- Welche Serie + Plattform?
- 2-3 Sätze, klar und direkt

ABSATZ 2 (Kontext):
- Wo steht die Serie? (Staffelstatus, Timeline)
- Einordnung in größeres Bild
- 2-4 Sätze

ABSATZ 3 (Details):
- Was ist bekannt?
- Was ist NICHT bestätigt? (wenn relevant)
- Konkrete Informationen
- 3-4 Sätze

ABSATZ 4 (Weiterer Kontext):
- Cast/Produktion (nur wenn bestätigt)
- Verwandte Entwicklungen
- 2-4 Sätze

ABSATZ 5+ (Wrap):
- Was kommt als nächstes?
- Wann gibt es Updates?
- KEINE Spekulationen
- 2-3 Sätze

ABSATZ-REGELN:
- 2-4 Sätze pro Absatz
- Max 90 Wörter pro Absatz
- Keine Textblöcke

ABSOLUT VERBOTEN:
- "Fans dürfen sich freuen"
- "Ein absolutes Highlight"
- "Endlich ist es soweit"
- "Die beliebte Serie"
- "Wie jetzt bekannt wurde"
- Hype-Sprache
- Füller-Sätze

STIL:
- Neutral, sachlich
- Keine Leser-Ansprache (kein "ihr", "du")
- Wie ein professioneller TV-Redakteur
- NICHT wie KI

Schreibe jetzt den VOLLSTÄNDIGEN Artikel (450-900 Wörter, mindestens 5 Absätze).`;

const CONTENT_GENERATION_PROMPT_EDITORIAL = `Du bist ein erfahrener Redakteur im Stil von serienjunkies.de.

SCHREIBREGELN:
- Sachlich, nüchtern, journalistisch
- Keine Emojis, kein Marketing-Ton
- Keine Clickbait-Fragen
- Kurze, klare Sätze (max. 22 Wörter pro Satz)
- Absätze mit 2–4 Sätzen
- Fakten zuerst, Wertungen sparsam

STRUKTUR FÜR EDITORIAL/LISTICLE:

Schreibe mindestens 5-7 Absätze!

LEAD (Absatz 1):
- Einführung: Was ist das Thema?
- Welche Serien werden behandelt?
- Kurzer Überblick (2-3 Sätze)

ABSATZ 2-6 (Pro Serie ein Absatz):
- Serie 1: Name, Sender/Streamer, Genre, was sie auszeichnet
- Serie 2: Name, Sender/Streamer, Genre, Besonderheiten
- Serie 3: Name, Sender/Streamer, Genre, Highlights
- usw. (ein Absatz pro Serie)
- Jeder Absatz: 3-4 Sätze
- Faktenbasiert, keine übertriebenen Lobpreisungen

LETZTER ABSATZ:
- Kurzes Fazit oder Ausblick
- KEINE Wiederholung des Leads

ABSOLUT VERBOTEN:
- "Fans dürfen sich freuen"
- "Ein absolutes Highlight"
- "Ein Muss für jeden Fan"
- "Die beste Serie aller Zeiten"
- "Endlich ist es soweit"
- "Wie jetzt bekannt wurde"
- Übertriebene Superlative
- Hohlphrasen

TONALITÄT:
- Neutral bis leicht wertend
- Informierend
- Glaubwürdig
- Wie ein echter Redakteur, nicht wie KI

WICHTIG:
- Nutze ALLE genannten Serien
- Gehe auf JEDE Serie einzeln ein
- Erfinde NICHTS
- Behalte Namen, Plattformen exakt bei
- Keine Markdown-Formatierung oder Nummern

Schreibe jetzt den Artikel als reinen Text (ein Absatz pro Zeile, durch Leerzeilen getrennt).`;

export async function generateGermanArticle(
  facts: ExtractedFacts,
  primarySeriesName: string,
  contentType: 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL' | 'FULL_ARTICLE' | 'RANKING_LIST',
  allSeriesNames?: string[],
  sourceUrl?: string, // NEW: For adding "Quelle" block
  targetWordCount?: number, // NEW: Dynamic word count target based on source
  rankingItemCount?: number // NEW: For RANKING_LIST mode
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'http://localhost:8002/v1',
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
  
  if (contentType === 'FULL_ARTICLE') {
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
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: factsPrompt }
      ],
      temperature: 0.7,
      max_tokens: contentType === 'FULL_ARTICLE' 
        ? Math.min(3500, Math.max(2000, (targetWordCount || 650) * 3)) // Dynamic based on target
        : (contentType === 'MULTI_SERIES_EDITORIAL' ? 2000 : 1500),
    });

    const rawContent = response.choices[0]?.message?.content;
    
    if (!rawContent) {
      throw new Error('No content generated');
    }

    console.log('✅ Raw content generated');
    console.log(`   Length: ${rawContent.length} characters`);

    // Apply Natural Paragraph Formatter (STEP 4 + Natural Paragraphs Feature!)
    console.log('📝 Applying natural paragraph structure...');
    
    const formattedHTML = generateNaturalArticleHTML(
      rawContent,
      primarySeriesName,
      {
        includeSubheading: rawContent.split(/\s+/).length > 500,
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
