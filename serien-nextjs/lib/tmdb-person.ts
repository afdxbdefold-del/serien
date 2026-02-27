/**
 * TMDB Person API Integration
 * For actor pages and auto-linking
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

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
}

/**
 * Search for person by name
 * Returns top result if valid actor
 */
export async function searchTMDBPerson(name: string): Promise<TMDBPersonSearchResult | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}&language=de-DE`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const results = data.results || [];

    // Find first valid actor
    const validActor = results.find((person: TMDBPersonSearchResult) => {
      return (
        person.known_for_department === 'Acting' &&
        person.popularity > 5
      );
    });

    return validActor || null;
  } catch (error) {
    console.error(`TMDB person search failed for "${name}":`, error);
    return null;
  }
}

/**
 * Get detailed person info
 */
export async function getTMDBPersonDetails(tmdbId: number): Promise<TMDBPersonDetails | null> {
  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/person/${tmdbId}?api_key=${TMDB_API_KEY}&language=de-DE`
    );

    if (!response.ok) {
      return null;
    }

    return await response.json();
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
    const response = await fetch(
      `${TMDB_BASE_URL}/person/${tmdbId}/combined_credits?api_key=${TMDB_API_KEY}&language=de-DE`
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
