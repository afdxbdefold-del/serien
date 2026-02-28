/**
 * Wikipedia Data Fetcher for Series Information
 * Fetches additional context and information from Wikipedia
 */

interface WikipediaData {
  summary: string;
  fullUrl: string;
  success: boolean;
}

/**
 * Fetch Wikipedia summary for a TV series
 */
export async function fetchWikipediaSummary(
  seriesName: string,
  originalTitle?: string
): Promise<WikipediaData> {
  try {
    // Try with series name first, then original title if available
    const searchTerms = [seriesName];
    if (originalTitle && originalTitle !== seriesName) {
      searchTerms.push(originalTitle);
    }

    for (const searchTerm of searchTerms) {
      try {
        // Wikipedia API - search for the article
        const searchUrl = `https://de.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchTerm + ' Fernsehserie')}&limit=1&format=json`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();

        if (!searchData[1] || searchData[1].length === 0) {
          continue; // Try next search term
        }

        const pageTitle = searchData[1][0];
        const pageUrl = searchData[3][0];

        // Fetch the page extract
        const extractUrl = `https://de.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json`;
        
        const extractResponse = await fetch(extractUrl);
        const extractData = await extractResponse.json();

        const pages = extractData.query.pages;
        const pageId = Object.keys(pages)[0];
        
        if (pageId === '-1') {
          continue; // Page not found, try next search term
        }

        const extract = pages[pageId].extract;

        if (extract && extract.length > 100) {
          return {
            summary: extract,
            fullUrl: pageUrl,
            success: true,
          };
        }
      } catch (error) {
        console.error(`Wikipedia fetch failed for "${searchTerm}":`, error);
        continue;
      }
    }

    // No results found
    return {
      summary: '',
      fullUrl: '',
      success: false,
    };

  } catch (error) {
    console.error('Wikipedia fetch error:', error);
    return {
      summary: '',
      fullUrl: '',
      success: false,
    };
  }
}

/**
 * Check if TMDB overview is too short/generic
 */
export function isTMDBOverviewInsufficient(overview: string): boolean {
  if (!overview || overview.length < 100) {
    return true;
  }

  // Check for generic phrases that indicate poor quality
  const genericPhrases = [
    'keine beschreibung',
    'coming soon',
    'wird bald',
    'noch nicht verfügbar',
  ];

  const lowerOverview = overview.toLowerCase();
  return genericPhrases.some(phrase => lowerOverview.includes(phrase));
}
