import { parseJsonResponse } from './json-utils';
/**
 * Google Discover Content Generator
 * Generates evergreen, editorial content for Series Hub pages
 * Optimized for Google Discover & Search
 */

interface DiscoverContentInput {
  seriesName: string;
  overview: string;
  genres: string[];
  firstAirYear: number | null;
  numberOfSeasons: number | null;
  status: string | null;
  networks: string[];
  creators: string[];
  cast: any[];
}

interface DiscoverContent {
  evergreenIntro: string;
  seriesStatus: string;
  newsContext: string;
  miniQA: Array<{ question: string; answer: string }>;
}

/**
 * Generate all Discover-optimized content sections
 */
export async function generateDiscoverContent(
  input: DiscoverContentInput
): Promise<DiscoverContent> {
  const {
    seriesName,
    overview,
    genres,
    firstAirYear,
    numberOfSeasons,
    status,
    networks,
    creators,
    cast,
  } = input;

  // Build context
  const genreText = genres.length > 0 ? genres.join(', ') : 'Drama';
  const networkText = networks.length > 0 ? networks.join(', ') : 'unbekannt';
  const mainCast = cast.slice(0, 3).map(c => c.name).join(', ');
  const creatorText = creators.length > 0 ? creators.join(', ') : 'unbekannt';
  const yearText = firstAirYear ? `seit ${firstAirYear}` : '';
  const seasonsText = numberOfSeasons ? `${numberOfSeasons} Staffel${numberOfSeasons > 1 ? 'n' : ''}` : '';

  const prompt = `Erstelle redaktionelle Evergreen-Inhalte für "${seriesName}" (Google Discover optimiert).

Daten: Genre: ${genreText} | Sender: ${networkText} | ${yearText} | ${seasonsText} | Status: ${status || 'unbekannt'}
Cast: ${mainCast || 'diverse'} | Schöpfer: ${creatorText}
TMDB: "${overview}"

Schreibe 4 Abschnitte:

1. evergreenIntro (300-400 Wörter, 3-4 Absätze): Genre, Ton, Grundidee, kulturelle Relevanz. Spoilerfrei, journalistisch, keine Listen.
2. seriesStatus (100-150 Wörter): Aktueller Status, bestätigte Staffeln, Produktionsstatus. Nur Fakten, keine Gerüchte.
3. newsContext (2-3 Sätze): Redaktionelle Einleitung zur News-Sammlung.
4. miniQA (3 praktische Fragen): Wo läuft es? Wie viele Staffeln? Wer spielt mit?

Kein Markdown, reiner Text. Antwort als JSON:
{"evergreenIntro": "...", "seriesStatus": "...", "newsContext": "...", "miniQA": [{"question": "...", "answer": "..."}, ...]}`;

  try {
    const { url: llmUrl, headers: llmHeaders, model: llmModel } = (await import('./llm-config')).getLLMFetchConfig();
    const response = await fetch(llmUrl, {
      method: 'POST',
      headers: llmHeaders,
      body: JSON.stringify({
        model: llmModel,
        messages: [
          {
            role: 'system',
            content: 'TV-Redakteur. Sachlich, journalistisch, präzise. Antworten immer im JSON-Format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();

    if (!content) {
      throw new Error('Empty response from LLM');
    }

    // Parse JSON response
    const parsedContent = parseJsonResponse(content);

    // Validate minimum length
    if (parsedContent.evergreenIntro.length < 250) {
      console.warn('⚠️  Evergreen intro too short, regenerating...');
      // Could implement retry logic here
    }

    return parsedContent;

  } catch (error) {
    console.error('Error generating Discover content:', error);
    
    // Fallback content
    return {
      evergreenIntro: `${seriesName} ist eine ${genreText}-Serie, die ${yearText} auf ${networkText} startete. Die Serie hat sich zu einem wichtigen Teil der modernen TV-Landschaft entwickelt und zieht ein breites Publikum an.`,
      seriesStatus: `Die Serie ${seriesName} umfasst aktuell ${seasonsText}. Der Status der Produktion wird regelmäßig aktualisiert.`,
      newsContext: `Alle wichtigen Meldungen und Updates zu ${seriesName} finden sich in der folgenden Übersicht.`,
      miniQA: [
        { question: `Wo läuft ${seriesName}?`, answer: `Die Serie ist auf ${networkText} verfügbar.` },
        { question: `Wie viele Staffeln gibt es?`, answer: seasonsText || 'Die Anzahl wird noch bekannt gegeben.' },
        { question: 'Wer spielt die Hauptrolle?', answer: mainCast || 'Das Cast wird noch bekannt gegeben.' },
      ],
    };
  }
}
