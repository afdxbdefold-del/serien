/**
 * STEP 4: AI Content Generator
 * Generates German news articles with natural paragraph structure
 */

import OpenAI from 'openai';
import { ExtractedFacts } from './fact-extractor';
import { generateNaturalArticleHTML, validateArticleHTML } from './article-formatter';

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
  contentType: 'SINGLE_SERIES_NEWS' | 'MULTI_SERIES_EDITORIAL'
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found in environment');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'http://localhost:8002/v1',
  });

  const factsPrompt = `
FAKTEN FÜR DEN ARTIKEL:
Serie(n): ${facts.series_names.join(', ')}
${facts.season_numbers.length > 0 ? `Staffeln: ${facts.season_numbers.join(', ')}` : ''}
${facts.people_names.length > 0 ? `Personen: ${facts.people_names.slice(0, 10).join(', ')}` : ''}
${facts.networks_platforms.length > 0 ? `Plattformen: ${facts.networks_platforms.join(', ')}` : ''}
${facts.release_dates.length > 0 ? `Zeitrahmen: ${facts.release_dates.join(', ')}` : ''}

KEY STATEMENTS:
${facts.key_statements.slice(0, 8).map((s, i) => `${i + 1}. ${s}`).join('\n')}

ARTIKEL-TYP: ${contentType === 'SINGLE_SERIES_NEWS' ? 'News-Artikel über eine Serie' : 'Editorial über mehrere Serien'}
HAUPT-SERIE: ${primarySeriesName}

Schreibe jetzt den deutschen Artikel (nur Text, Absätze durch Leerzeilen trennen).
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: CONTENT_GENERATION_PROMPT },
        { role: 'user', content: factsPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
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
        subheadingText: `Mehr zu ${primarySeriesName}`
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
