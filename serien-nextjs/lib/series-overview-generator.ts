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

  const prompt = `Du bist ein professioneller TV-Serien-Redakteur für eine deutsche Entertainment-Website.

Schreibe eine erweiterte, SEO-optimierte Serien-Beschreibung für "${seriesName}".

**Vorgaben:**
- Länge: 300-400 Wörter
- Ton: Informativ, engagierend, professionell
- Zielgruppe: Deutsche TV-Serien-Fans
- KEINE Spoiler
- KEINE Markdown-Formatierung (kein **, keine #, keine _)
- Nur reiner Text mit natürlichen Absätzen
- Natürliche Integration von Keywords: "${seriesName}", "${genreText}", "Serie", "Staffel"
- Struktur in 3-4 Absätze

**Verfügbare Informationen:**
- Original-Overview: "${originalOverview}"
- Genre: ${genreText}
- Jahr: ${yearText}
- Staffeln: ${seasonsText}
- Status: ${status || 'unbekannt'}
- Hauptdarsteller: ${mainCast || 'diverse'}
- Schöpfer: ${creatorText}
- Sender/Plattform: ${networkText}

**Struktur:**
1. Paragraph: Hook & Prämisse (Was macht die Serie besonders?)
2. Paragraph: Handlung & Setting (spoilerfrei, atmosphärisch)
3. Paragraph: Charaktere & Dynamiken (Hauptfiguren, ohne Details)
4. Paragraph (optional): Stil, Ton & Zielgruppe (Warum sollte man einschalten?)

**Wichtig:**
- Keine Spoiler über Staffel 1 hinaus
- Keine erfundenen Details - nur basierend auf gegebenen Infos
- Natürlicher, fließender Schreibstil
- SEO-freundlich aber nicht künstlich
- KEIN Markdown - nur reiner Text mit Absätzen

Schreibe jetzt die erweiterte Beschreibung:`;

  try {
    const response = await fetch('http://localhost:8002/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein professioneller TV-Redakteur, der informative und engagierende Serien-Beschreibungen schreibt.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
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
