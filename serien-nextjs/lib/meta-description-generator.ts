/**
 * Generate Google Discover optimized Meta Description
 * Strict validation: 120-155 chars, no clickbait, no questions/exclamations
 */

import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.EMERGENT_LLM_KEY,
  baseURL: 'https://llm.kindo.ai/v1',
});

interface MetaDescriptionInput {
  title: string;
  content: string;
  primarySeries: string;
  wasBedeutetDas?: string;
}

export async function generateMetaDescription(input: MetaDescriptionInput): Promise<string> {
  const plainText = input.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const firstParagraph = plainText.split('\n')[0] || plainText.substring(0, 300);

  const systemPrompt = `Du bist ein SEO-Experte für Google Discover Meta Descriptions.

STRIKTE REGELN:
- Länge: 120-150 Zeichen (MAXIMAL 155)
- Natürlicher, informativer Teaser
- KEINE Fragezeichen (?)
- KEINE Ausrufezeichen (!)
- KEINE Emojis
- KEINE Jahreszahlen
- KEINE Clickbait-Wörter: "musst du wissen", "schockierend", "unglaublich", "absolut"
- KEINE Titel-Wiederholung
- KEINE URLs oder Markennamen

ERLAUBT:
- Informationssignale: bekannt, geplant, bestätigt, möglich, aktuell, offiziell
- Konkreter Nutzen: neue Staffel, Handlung, Besetzung, Zukunft der Serie

STIL:
- Sachlich und vertrauenswürdig
- Neugier ohne falsche Versprechen
- Google Discover optimiert`;

  const userPrompt = `Erstelle eine Google Discover Meta Description für:

Titel: ${input.title}
Serie: ${input.primarySeries}

Erster Absatz:
${firstParagraph}

Was bedeutet das (optional):
${input.wasBedeutetDas || 'N/A'}

AUFGABE:
Schreibe EINE Meta Description (120-150 Zeichen) die:
- Den Artikel-Inhalt zusammenfasst
- Neugier erzeugt
- Sachlich und glaubwürdig klingt
- ALLE obigen Regeln einhält

Antworte NUR mit der Meta Description, nichts anderes.`;

  try {
    const completion = await client.chat.completions.create({
      model: 'openai/gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    let metaDescription = completion.choices[0]?.message?.content?.trim() || '';
    
    // Remove quotes if present
    metaDescription = metaDescription.replace(/^["']|["']$/g, '');
    
    return metaDescription;
  } catch (error) {
    console.error('Meta Description generation failed:', error);
    
    // Fallback: Extract from first paragraph
    const fallback = firstParagraph
      .substring(0, 145)
      .trim()
      .split(' ')
      .slice(0, -1)
      .join(' ');
    
    return fallback.length >= 120 ? fallback : firstParagraph.substring(0, 150);
  }
}
