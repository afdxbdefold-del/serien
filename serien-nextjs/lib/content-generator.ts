/**
 * STEP 4: AI Content Generator
 * Generates German news articles with natural paragraph structure
 */

import OpenAI from 'openai';
import { ExtractedFacts } from './fact-extractor';
import { generateNaturalArticleHTML, validateArticleHTML } from './article-formatter';

const CONTENT_GENERATION_PROMPT = `Du bist ein professioneller deutscher Serien-News-Redakteur.

Deine Aufgabe: Schreibe einen originalen deutschen News-Artikel basierend auf den gegebenen Fakten.

STIL-REGELN:
1. **Sprache:** Fließendes, journalistisches Deutsch (kein übersetztes Englisch!)
2. **Struktur:** Kurze, prägnante Absätze (max. 3 Sätze pro Absatz)
3. **Ton:** Informativ, sachlich, aber interessant
4. **Länge:** 400-600 Wörter
5. **Format:** Nur reiner Text, keine Markdown-Formatierung, keine Überschriften (außer am Anfang)

CONTENT-REGELN:
1. Nutze ALLE relevanten Fakten aus der Liste
2. Behalte Namen, Daten und Zahlen EXAKT bei
3. Erfinde NICHTS - nur die gegebenen Fakten verwenden
4. Vermeide "Textwüsten" - mache kurze, lesefreundliche Absätze
5. Beginne mit den wichtigsten News (Lead-Paragraph)

STRUKTUR:
- Lead (wichtigste Info, 2-3 Sätze)
- Hauptteil (Details, Hintergrund)
- Abschluss (Ausblick, relevante Zusatzinfo)

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
