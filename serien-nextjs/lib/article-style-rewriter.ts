/**
 * EMERGENT_ARTICLE_STYLE_REWRITE
 * 
 * Schreibt Artikel-Inhalte im Stil deutscher TV-News-Redaktionen um
 * - Vergleichbar mit serienjunkies.de
 * - Neutral, faktisch, nicht-werblich
 */

const LLM_PROXY_URL = 'https://api.openai.com/v1/chat/completions';

interface ArticleStyleInput {
  extractedFacts: string;
  seriesName: string;
  platform?: string;
  eventType: 'renewal' | 'cancellation' | 'casting' | 'release' | 'production' | 'other';
}

export async function rewriteArticleStyle(input: ArticleStyleInput): Promise<string> {
  const systemPrompt = `Du bist ein professioneller Redakteur für deutsche TV-Serien-News im Stil von serienjunkies.de.

AUFGABE: Schreibe einen sachlichen, journalistischen Artikel aus gegebenen Fakten.

HARTE REGELN:
- Deutsch (de-DE)
- KEIN Pressemitteilungs-Ton
- KEINE Marketing-Adjektive ("erfolgreich", "beliebt", "spannend")
- KEINE Hype-Sprache ("endlich", "jetzt", "bald")
- KEINE Leser-Ansprache ("ihr", "du", "wir", "Fans")
- KEINE rhetorischen Fragen
- KEINE Füller-Schlussfolgerungen ("Es bleibt spannend...")

STRUKTUR:
1. Lead-Absatz (max 2 Sätze)
   - Was ist passiert?
   - Bei welcher Serie?
   
2. Kontext-Absatz
   - Vorherige Staffel / Status
   
3. Weitere Details
   - Cast, Produktion, Timeline (nur wenn bekannt)
   
4. Kurzer Ausblick (optional, nur faktisch)

ABSATZ-REGELN:
- Max 3 Sätze pro Absatz
- Eine Idee pro Absatz
- Kein Absatz länger als 60 Wörter

SPRACH-REGELN:
- Plattform-Nennung vermeiden wenn möglich
- Keine Synonyme für gleiche Fakten
- Kurze Hauptsätze bevorzugen
- Aktiv statt Passiv

❌ VERMEIDE:
- "Die erfolgreiche Hit-Serie..."
- "Fans dürfen sich freuen..."
- "Amazon Prime Video hat offiziell bekannt gegeben..."
- "Wie XY meldet..."

✅ BEVORZUGE:
- "Amazon hat eine zweite Staffel bestätigt."
- "Details zum Starttermin gibt es noch nicht."
- "Die Dreharbeiten beginnen im Sommer."

OUTPUT:
- Nur <p>-Tags
- Keine Emojis
- Kein Marketing-Sprech
- Sauberes HTML`;

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
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
