/**
 * Character Content Generator
 * Generates discover-optimized content for fictional character pages
 */

import { LlmChat, UserMessage } from 'emergentintegrations/llm/chat';

interface CharacterData {
  name: string;
  seriesName: string;
  tmdbSeriesData?: any;
  tmdbCharacterData?: any;
  actorName?: string;
}

interface GeneratedContent {
  shortDescription: string;
  whoIsContent: string;
  roleInSeriesContent: string;
  importanceContent: string;
  appearancesContent: string;
  qa: Array<{ question: string; answer: string }>;
  metaTitle: string;
  metaDescription: string;
}

/**
 * Generate all content sections for a character page
 */
export async function generateCharacterContent(
  data: CharacterData
): Promise<GeneratedContent> {
  const prompt = `Du bist ein Serien-Redakteur und erstellst eine Autoritätsseite über die fiktive Figur "${data.name}" aus der Serie "${data.seriesName}".

WICHTIGE REGELN:
- Schreibe journalistisch, NICHT im Wiki-Stil
- Keine Aufzählungen, nur Fließtext
- Keine Spoiler ohne klare Kennzeichnung
- Keine generischen KI-Phrasen
- Keine Marketing-Sprache
- Faktenbasiert, keine Spekulationen

KONTEXT:
${data.tmdbCharacterData ? `TMDB-Daten: ${JSON.stringify(data.tmdbCharacterData, null, 2)}` : 'Keine TMDB-Daten verfügbar'}
${data.actorName ? `Darsteller: ${data.actorName}` : ''}

AUFGABE: Erstelle folgende Abschnitte:

1. SHORT_DESCRIPTION (2-3 Sätze)
   - Kurze Einordnung: Wer ist die Figur? Warum relevant?

2. WHO_IS (150-250 Wörter)
   - Charakterbeschreibung
   - Rolle innerhalb der Serie
   - Bedeutung für Handlung und Ton
   - Verständlich erklären

3. ROLE_IN_SERIES (150-200 Wörter)
   - Charakterentwicklung
   - Innere Konflikte
   - Narrative Funktion
   - Neutral erklärend

4. IMPORTANCE (100-150 Wörter)
   - Einfluss auf Story
   - Beziehungen zu anderen Figuren
   - Dynamiken

5. APPEARANCES (100-150 Wörter)
   - Wichtige Story-Momente (spoilerfrei oder markiert)
   - Zentrale Wendepunkte

6. QA (3-5 figurenspezifische Fragen)
   - KEINE generischen Fragen
   - Figuren-individuell
   - Antworten: 2-4 Sätze

7. META_TITLE (max 60 Zeichen)
   Format: "${data.name} (${data.seriesName}) – Rolle, Bedeutung & Hintergrund"

8. META_DESCRIPTION (140-160 Zeichen)
   Fokus: Figur + Serie + Relevanz

AUSGABEFORMAT (JSON):
{
  "shortDescription": "...",
  "whoIsContent": "...",
  "roleInSeriesContent": "...",
  "importanceContent": "...",
  "appearancesContent": "...",
  "qa": [
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."},
    {"question": "...", "answer": "..."}
  ],
  "metaTitle": "...",
  "metaDescription": "..."
}

Antworte NUR mit dem JSON, keine Einleitung.`;

  try {
    const chat = new LlmChat({
      api_key: process.env.EMERGENT_LLM_KEY || '',
      session_id: `char-gen-${Date.now()}`,
      system_message: 'Du bist ein professioneller Serien-Redakteur.',
    }).with_model('openai', 'gpt-4o');

    const userMessage = new UserMessage({ text: prompt });
    const response = await chat.send_message(userMessage);

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const content = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!content.shortDescription || !content.whoIsContent || !content.roleInSeriesContent) {
      throw new Error('Missing required content fields');
    }

    return content as GeneratedContent;
  } catch (error: any) {
    console.error('Character content generation failed:', error.message);
    throw error;
  }
}

/**
 * Create slug for character page
 */
export function createCharacterSlug(characterName: string, seriesName: string): string {
  const cleanChar = characterName
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const cleanSeries = seriesName
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${cleanChar}-${cleanSeries}`;
}
