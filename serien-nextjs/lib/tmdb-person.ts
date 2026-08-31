/**
 * TMDB Person API Integration
 * For actor pages and auto-linking
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function requireTmdbApiKey(): string {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY is not configured');
  }
  return TMDB_API_KEY;
}

export interface TMDBPersonSearchResult {
  id: number;
  name: string;
  known_for_department: string;
  popularity: number;
  profile_path: string | null;
  known_for: any[];
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  combined_credits?: {
    cast: Array<{
      id: number;
      name?: string;
      title?: string;
      media_type: 'tv' | 'movie';
      character?: string;
      poster_path?: string | null;
      popularity: number;
      vote_average?: number;
      first_air_date?: string;
    }>;
    crew: Array<{
      id: number;
      name?: string;
      title?: string;
      media_type: 'tv' | 'movie';
      job?: string;
      department?: string;
    }>;
  };
}

/**
 * Search for person by name
 * Returns top result if valid actor
 */
export async function searchTMDBPerson(name: string): Promise<TMDBPersonSearchResult | null> {
  try {
    const apiKey = requireTmdbApiKey();
    const response = await fetch(
      `${TMDB_BASE_URL}/search/person?api_key=${apiKey}&query=${encodeURIComponent(name)}&language=de-DE`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    // Find first valid actor (lowered popularity threshold for better coverage)
    const validActor = results.find((person: TMDBPersonSearchResult) => {
      return (
        person.known_for_department === 'Acting' &&
        person.popularity > 2
      );
    });

    return validActor || null;
  } catch (error) {
    console.error(`TMDB person search failed for "${name}":`, error);
    return null;
  }
}

/**
 * Get detailed person info with combined credits
 */
export async function getTMDBPersonDetails(tmdbId: number, includeCredits: boolean = false): Promise<TMDBPersonDetails | null> {
  try {
    const apiKey = requireTmdbApiKey();
    let url = `${TMDB_BASE_URL}/person/${tmdbId}?api_key=${apiKey}&language=de-DE`;
    
    if (includeCredits) {
      url += '&append_to_response=combined_credits';
    }
    
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    // If no German biography, fallback to English
    if ((!data.biography || data.biography.trim() === '') && includeCredits) {
      console.log(`  ℹ️  No German biography for ${data.name}, trying English...`);
      const enUrl = `${TMDB_BASE_URL}/person/${tmdbId}?api_key=${apiKey}&language=en-US`;
      const enResponse = await fetch(enUrl);
      
      if (enResponse.ok) {
        const enData = await enResponse.json();
        data.biography = enData.biography;
      }
    }

    return data;
  } catch (error) {
    console.error(`TMDB person details failed for ID ${tmdbId}:`, error);
    return null;
  }
}

/**
 * Get person's known-for series (filtered by existing on site)
 */
export async function getPersonKnownFor(tmdbId: number): Promise<any[]> {
  try {
    const apiKey = requireTmdbApiKey();
    const response = await fetch(
      `${TMDB_BASE_URL}/person/${tmdbId}/combined_credits?api_key=${apiKey}&language=de-DE`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const cast = data.cast || [];

    // Filter TV shows only, sort by popularity
    return cast
      .filter((item: any) => item.media_type === 'tv')
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10);
  } catch (error) {
    console.error(`TMDB known-for failed for ID ${tmdbId}:`, error);
    return [];
  }
}

/**
 * Create person slug from name
 */
export function createPersonSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/**
 * Get TMDB profile image URL
 */
export function getTMDBProfileImageUrl(profilePath: string | null, size: string = 'w185'): string {
  if (!profilePath) {
    return '/img/placeholder-person.jpg'; // Fallback
  }
  return `https://image.tmdb.org/t/p/${size}${profilePath}`;
}
