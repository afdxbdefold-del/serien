/**
 * TMDB Watch Providers API Integration
 * Fetches streaming availability for Germany (DE)
 */

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
  display_priority: number;
}

export interface WatchProvidersResult {
  link: string;
  flatrate?: WatchProvider[];
  buy?: WatchProvider[];
  rent?: WatchProvider[];
  ads?: WatchProvider[];
  free?: WatchProvider[];
}

export interface TMDBWatchProvidersResponse {
  id: number;
  results: {
    [countryCode: string]: WatchProvidersResult;
  };
}

/**
 * Fetch watch providers for a TV series in Germany
 */
export async function getTVWatchProviders(seriesId: number): Promise<WatchProvidersResult | null> {
  const apiKey = process.env.TMDB_API_KEY;
  
  if (!apiKey) {
    console.error('TMDB_API_KEY not configured');
    return null;
  }

  try {
    const url = `https://api.themoviedb.org/3/tv/${seriesId}/watch/providers?api_key=${apiKey}`;
    const response = await fetch(url, {
      next: { revalidate: 86400 } // Cache for 24 hours
    });

    if (!response.ok) {
      console.error(`TMDB API error: ${response.status}`);
      return null;
    }

    const data: TMDBWatchProvidersResponse = await response.json();
    
    // Return German (DE) providers
    return data.results?.DE || null;
    
  } catch (error) {
    console.error('Error fetching TMDB watch providers:', error);
    return null;
  }
}

/**
 * Get TMDB image URL for provider logo (routed via our proxy for edge-caching).
 */
export function getTMDBLogoUrl(logoPath: string, size: 'original' | 'w92' | 'w154' | 'w185' = 'w92'): string {
  return `/img/tmdb/${size}${logoPath}`;
}

/**
 * Get display name for provider (optional localization)
 */
export function getProviderDisplayName(providerName: string): string {
  const nameMap: Record<string, string> = {
    'Amazon Prime Video': 'Prime Video',
    'Disney Plus': 'Disney+',
    'Apple TV Plus': 'Apple TV+',
    'Paramount Plus': 'Paramount+',
    'WOW': 'WOW (Sky)',
    'Joyn Plus': 'Joyn+',
    'RTL Plus': 'RTL+',
  };
  
  // First, apply name mapping
  let displayName = nameMap[providerName] || providerName;
  
  // Then, translate common English phrases to German
  const translations: Record<string, string> = {
    'Free with Ads': 'Kostenlos mit Werbung',
    'Standard with Ads': 'Standard mit Werbung',
    'Basic with Ads': 'Basis mit Werbung',
    'with Ads': 'mit Werbung',
    'Premium': 'Premium',
    'Standard': 'Standard',
    'Basic': 'Basis',
  };
  
  // Apply translations
  for (const [english, german] of Object.entries(translations)) {
    if (displayName.includes(english)) {
      displayName = displayName.replace(english, german);
    }
  }
  
  return displayName;
}
