/**
 * Series Extended Overview Generator
 * 
 * Generates AI-powered extended synopses for series pages
 * - 300-400 words
 * - SEO-optimized
 * - Spoiler-free
 * - Engaging tone
 * - Uses TMDB + Wikipedia data when available
 */

import { fetchWikipediaSummary, isTMDBOverviewInsufficient } from './wikipedia-fetcher';

interface SeriesOverviewInput {
  seriesName: string;
  originalTitle?: string;
  originalOverview: string;
  genres: string[];
  firstAirYear: number | null;
  numberOfSeasons: number | null;
  status: string | null;
  cast: any[];
  creators: string[];
  networks: string[];
}

/**
 * Generate extended overview for a series using GPT-5.2
 */
export async function generateSeriesExtendedOverview(
  input: SeriesOverviewInput
): Promise<string> {
  const {
    seriesName,
    originalTitle,
    originalOverview,
    genres,
    firstAirYear,
    numberOfSeasons,
    status,
    cast,
    creators,
    networks,
  } = input;

  // Check if we should fetch Wikipedia data
  const needsWikipedia = isTMDBOverviewInsufficient(originalOverview);
  let wikipediaData = null;
  let sources = 'TMDB';

  if (needsWikipedia) {
    console.log('   📚 TMDB-Overview unzureichend, hole Wikipedia-Daten...');
    wikipediaData = await fetchWikipediaSummary(seriesName, originalTitle);
    if (wikipediaData.success) {
      console.log(`   ✓ Wikipedia-Daten gefunden (${wikipediaData.summary.length} Zeichen)`);
      sources = 'TMDB + Wikipedia';
    }
  }

  // Build context for the LLM
  const genreText = genres.length > 0 ? genres.join(', ') : 'Drama';
  const mainCast = cast.slice(0, 3).map(c => c.name).join(', ');
  const creatorText = creators.length > 0 ? creators.join(', ') : 'unbekannt';
  const networkText = networks.length > 0 ? networks.join(', ') : 'unbekannt';
  const seasonsText = numberOfSeasons ? `${numberOfSeasons} Staffel${numberOfSeasons > 1 ? 'n' : ''}` : '';
  const yearText = firstAirYear ? `seit ${firstAirYear}` : '';

  // Build information sources text
  let informationSources = `- TMDB Overview: "${originalOverview}"`;
  if (wikipediaData && wikipediaData.success) {
    informationSources += `\n- Wikipedia-Zusammenfassung: "${wikipediaData.summary.substring(0, 800)}${wikipediaData.summary.length > 800 ? '...' : ''}"`;
  }

  const prompt = `Schreibe eine Serien-Beschreibung für "${seriesName}" (300-400 Wörter, 3-4 Absätze, spoilerfrei).

Infos:
${informationSources}
Genre: ${genreText} | Jahr: ${yearText} | Staffeln: ${seasonsText} | Status: ${status || 'unbekannt'}
Cast: ${mainCast || 'diverse'} | Schöpfer: ${creatorText} | Sender: ${networkText}
Datenquellen: ${sources}

Aufbau:
1. Hook & Prämisse
2. Handlung & Setting (spoilerfrei)
3. Charaktere & Dynamiken
4. Stil & Zielgruppe (optional)

Reiner Text, keine Markdown-Formatierung, keine erfundenen Details. Natürlich, informativ, Keywords ("${seriesName}", "${genreText}") organisch einbauen.`;

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
            content: 'Serien-Redakteur für eine deutsche Entertainment-Website. Schreibe informative, spoilerfreie Beschreibungen in natürlichem Deutsch.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_completion_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0]?.message?.content?.trim();

    if (!generatedText) {
      throw new Error('Empty response from LLM');
    }

    return generatedText;
  } catch (error) {
    console.error('Error generating series overview:', error);
    // Fallback to original overview if generation fails
    return originalOverview || `${seriesName} ist eine ${genreText}-Serie.`;
  }
}
