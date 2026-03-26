/**
 * EMERGENT_HEADLINE_OPTIMIZATION
 * 
 * Optimiert Artikel-Überschriften für natürlichen, journalistischen Stil
 * - Keine Werbetexte
 * - Max 90 Zeichen
 * - Plattform max 1x erwähnen
 * - Deutsch (de-DE)
 */

const LLM_PROXY_URL = 'https://api.openai.com/v1/chat/completions';

interface HeadlineOptimizationInput {
  rawContent: string;
  originalHeadline: string;
  seriesName: string;
  platform?: string;
}

interface HeadlineVariant {
  headline: string;
  naturalness: number;
  clarity: number;
  discoverSuitability: number;
  totalScore: number;
}

interface HeadlineOptimizationResult {
  final_headline: string;
  alternatives: string[];
}

export async function optimizeHeadline(input: HeadlineOptimizationInput): Promise<HeadlineOptimizationResult> {
  const systemPrompt = `Du bist ein professioneller Redakteur für deutsche Serien-News.

AUFGABE: Erstelle 5 optimierte Überschriften-Varianten für einen Serien-Artikel.

REGELN:
- Plattform (${input.platform || 'Streaming-Dienst'}) MAX 1x erwähnen
- Keine doppelten Wörter oder Phrasen
- Kein Werbe-Ton oder Pressemitteilungs-Stil
- MAX 90 Zeichen
- Kein Clickbait
- Keine Füllwörter oder übertriebene Adjektive
- Natürlich und journalistisch
- Deutsch (de-DE)

BEWERTUNG (0-10 Punkte):
- Naturalness: Wie natürlich klingt die Überschrift?
- Clarity: Wie klar ist die Aussage?
- Discover Suitability: Wie gut für Google Discover?

FORMAT:
Antworte NUR mit einem JSON-Array:
[
  {
    "headline": "Überschrift hier",
    "naturalness": 8,
    "clarity": 9,
    "discoverSuitability": 7
  },
  ...
]`;

  const userPrompt = `ORIGINAL ÜBERSCHRIFT:
${input.originalHeadline}

SERIE:
${input.seriesName}

${input.platform ? `PLATTFORM:\n${input.platform}\n\n` : ''}ARTIKEL-INHALT (Auszug):
${input.rawContent.substring(0, 500)}...

Erstelle jetzt 5 optimierte Überschriften-Varianten mit Bewertungen.`;

  try {
    const response = await fetch(LLM_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.1',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const variants: HeadlineVariant[] = JSON.parse(content).map((v: any) => ({
      ...v,
      totalScore: v.naturalness + v.clarity + v.discoverSuitability,
    }));

    // Sort by total score (descending)
    variants.sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      // If tie, prefer shorter headline
      return a.headline.length - b.headline.length;
    });

    // Return best headline + alternatives
    return {
      final_headline: variants[0].headline,
      alternatives: variants.slice(1, 4).map(v => v.headline),
    };

  } catch (error) {
    console.error('Headline optimization failed:', error);
    // Fallback to original headline
    return {
      final_headline: input.originalHeadline,
      alternatives: [],
    };
  }
}

// CLI usage example
if (require.main === module) {
  const testInput: HeadlineOptimizationInput = {
    rawContent: 'Netflix hat heute offiziell die Dreharbeiten zur finalen Staffel von Stranger Things beendet. Die fünfte und letzte Staffel wird voraussichtlich 2025 erscheinen...',
    originalHeadline: 'Stranger Things: Netflix verkündet Ende der Dreharbeiten für finale Staffel 5!',
    seriesName: 'Stranger Things',
    platform: 'Netflix',
  };

  optimizeHeadline(testInput).then(result => {
    console.log('✅ OPTIMIZED HEADLINE:');
    console.log(result.final_headline);
    console.log('\n📋 ALTERNATIVES:');
    result.alternatives.forEach((alt, i) => console.log(`${i + 1}. ${alt}`));
  });
}
