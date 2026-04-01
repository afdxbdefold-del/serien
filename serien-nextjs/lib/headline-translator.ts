/**
 * HEADLINE TRANSLATOR
 * 
 * Policy: TRANSLATE_ONLY
 * - Übersetzt Headlines treu von Englisch nach Deutsch
 * - KEIN kreatives Umschreiben
 * - KEIN Marketing-Sprache hinzufügen
 * - Behält Struktur, Intent und Tonalität bei
 */

import { createLLMClient, LLM_CONFIG } from './llm-config';

const TRANSLATE_ONLY_PROMPT = `Übersetze die englische Headline treu ins Deutsche. Behalte Struktur, Intent und Tonalität exakt bei.

Regeln:
- Nur übersetzen, nicht umschreiben oder interpretieren
- Keine Wörter hinzufügen die nicht im Original stehen (kein "offiziell", "bestätigt", "endlich", "Hit-Serie")
- Unsicherheit bewahren: "might" → "könnte", nicht "wird"
- Keine Ausrufezeichen hinzufügen
- Wortstellung und Artikel für deutsche Grammatik anpassen ist erlaubt

Beispiele:
"Stranger Things Season 5: Everything We Know" → "Stranger Things Staffel 5: Alles was wir wissen"
"The Witcher Might Get Cancelled" → "The Witcher könnte abgesetzt werden"

Antworte NUR mit der übersetzten Headline.`;

export async function translateHeadlineOnly(
  originalEnglishHeadline: string,
  seriesName: string
): Promise<string> {
  const client = createLLMClient();

  try {
    const response = await client.chat.completions.create({
      model: LLM_CONFIG.model,
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
