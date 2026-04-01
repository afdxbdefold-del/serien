/**
 * EMERGENT_ARTICLE_STYLE_REWRITE
 * 
 * Schreibt Artikel-Inhalte im Stil deutscher TV-News-Redaktionen um
 * - Vergleichbar mit serienjunkies.de
 * - Neutral, faktisch, nicht-werblich
 */

import { getLLMFetchConfig } from './llm-config';

const { url: LLM_PROXY_URL, headers: LLM_HEADERS, model: LLM_MODEL } = getLLMFetchConfig();

interface ArticleStyleInput {
  extractedFacts: string;
  seriesName: string;
  platform?: string;
  eventType: 'renewal' | 'cancellation' | 'casting' | 'release' | 'production' | 'other';
}

export async function rewriteArticleStyle(input: ArticleStyleInput): Promise<string> {
  const systemPrompt = `Rolle: Redakteur bei serienjunkies.de.

Schreibe einen sachlichen, journalistischen Artikel aus den gegebenen Fakten.

Aufbau:
1. Lead (max 2 Sätze): Was ist passiert? Bei welcher Serie?
2. Kontext: Vorherige Staffel / Status.
3. Details: Cast, Produktion, Timeline (nur Bestätigtes).
4. Ausblick (optional, nur faktisch).

Regeln:
- Max 3 Sätze, 60 Wörter pro Absatz. Eine Idee pro Absatz.
- Kurze Hauptsätze, Aktiv statt Passiv.
- Kein Pressemitteilungs-Ton, keine Marketing-Adjektive, keine Leser-Ansprache.
- Nur <p>-Tags, keine Emojis.`;

  const userPrompt = `FAKTEN:
${input.extractedFacts}

SERIE:
${input.seriesName}

${input.platform ? `PLATTFORM:\n${input.platform}\n\n` : ''}EVENT-TYP:
${input.eventType}

Schreibe jetzt einen sachlichen Artikel im deutschen TV-News-Stil.`;

  try {
    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: LLM_HEADERS,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower for more factual output
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Clean up any markdown or extra formatting
    let cleanContent = content
      .replace(/```html\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // Ensure proper paragraph structure
    if (!cleanContent.startsWith('<p>')) {
      cleanContent = cleanContent
        .split('\n\n')
        .map(para => `<p>${para}</p>`)
        .join('\n');
    }
    
    return cleanContent;

  } catch (error) {
    console.error('Article style rewrite failed:', error);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const testInput: ArticleStyleInput = {
    extractedFacts: `- Netflix hat die Dreharbeiten zur finalen Staffel 5 von Stranger Things beendet
- Die fünfte Staffel ist die letzte der Serie
- Voraussichtlicher Release: 2025
- Die Duffer Brothers haben ein emotionales Statement veröffentlicht
- Die Serie lief seit 2016`,
    seriesName: 'Stranger Things',
    platform: 'Netflix',
    eventType: 'production',
  };

  rewriteArticleStyle(testInput).then(result => {
    console.log('✅ REWRITTEN ARTICLE:\n');
    console.log(result);
  });
}
