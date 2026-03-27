/**
 * HEADLINE TRANSLATOR
 * 
 * Policy: TRANSLATE_ONLY
 * - Übersetzt Headlines treu von Englisch nach Deutsch
 * - KEIN kreatives Umschreiben
 * - KEIN Marketing-Sprache hinzufügen
 * - Behält Struktur, Intent und Tonalität bei
 */

import OpenAI from 'openai';

const TRANSLATE_ONLY_PROMPT = `Du bist ein präziser Übersetzer für journalistische Headlines.

AUFGABE: Übersetze die englische Headline TREU ins Deutsche.

STRIKTE REGELN:
1. TRANSLATE ONLY - kein Umschreiben
2. Behalte die EXAKTE Struktur bei
3. Behalte den EXAKTEN Intent bei
4. Behalte die EXAKTE Tonalität bei
5. KEINE Marketing-Sprache hinzufügen
6. KEINE Plattformen hinzufügen (Netflix, HBO, etc.) wenn nicht im Original
7. KEINE Zeitform ändern
8. KEINE Gewissheit ändern (z.B. "might" → "könnte", NICHT "wird")

VERBOTEN:
- "offiziell"
- "bestätigt" (außer im Original)
- "endlich"
- "Hit-Serie"
- "Mega"
- Ausrufezeichen hinzufügen
- Hype-Sprache

ERLAUBT:
- Wortstellung für deutsche Grammatik anpassen
- Artikel hinzufügen (der/die/das)
- Natürliche deutsche Formulierung OHNE Bedeutungsänderung

BEISPIELE:

Original: "Stranger Things Season 5: Everything We Know"
✅ Gut: "Stranger Things Staffel 5: Alles was wir wissen"
❌ Falsch: "Stranger Things Staffel 5: Netflix bestätigt alle Details"

Original: "The Witcher Might Get Cancelled"
✅ Gut: "The Witcher könnte abgesetzt werden"
❌ Falsch: "The Witcher wird abgesetzt"

Original: "House of the Dragon Episode 5 Recap"
✅ Gut: "House of the Dragon Episode 5 Recap"
❌ Falsch: "House of the Dragon: HBO zeigt spektakuläre Episode 5"

Übersetze NUR. Kein Kommentar, keine Erklärung.`;

export async function translateHeadlineOnly(
  originalEnglishHeadline: string,
  seriesName: string
): Promise<string> {
  const apiKey = process.env.EMERGENT_LLM_KEY;
  
  if (!apiKey) {
    throw new Error('EMERGENT_LLM_KEY not found');
  }
  
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.openai.com/v1',
  });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: TRANSLATE_ONLY_PROMPT },
        { 
          role: 'user', 
          content: `Serie: ${seriesName}\nOriginal Headline: "${originalEnglishHeadline}"\n\nÜbersetze:`
        }
      ],
      temperature: 0.3, // Low temp for consistent translation
      max_completion_tokens: 100,
    });

    const translatedHeadline = response.choices[0]?.message?.content?.trim() || originalEnglishHeadline;
    
    // Remove quotes if AI added them
    const cleanHeadline = translatedHeadline.replace(/^["']|["']$/g, '');
    
    console.log(`   📰 Translated: "${cleanHeadline}"`);
    
    return cleanHeadline;
    
  } catch (error: any) {
    console.error('   ❌ Translation failed:', error.message);
    return originalEnglishHeadline; // Fallback to original
  }
}
