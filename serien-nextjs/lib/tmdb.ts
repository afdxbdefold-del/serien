/**
 * TMDB Service
 * Server-side only - handles all TMDB API interactions
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  console.warn('⚠️  TMDB_API_KEY not set - TMDB features disabled');
}

export interface TMDBTvResult {
  id: number;
  name: string;
  original_name: string;
  overview: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  popularity: number;
  vote_average: number;
}

/**
 * Search TMDB and return the candidate list. This stays server-side so the
 * TMDB credential is never shipped to the browser.
 */
export async function searchTvResults(
  query: string,
  language: string = 'de-DE'
): Promise<TMDBTvResult[]> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const response = await fetch(
    `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=${language}`,
    { next: { revalidate: 86400 } }
  );

  if (!response.ok) {
    throw new Error(`TMDB API error: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data.results) ? data.results : [];
}

interface TMDBTvDetails extends TMDBTvResult {
  status: string;
  tagline: string;
  type: string;
  genres: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string; logo_path: string | null }>;
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  in_production: boolean;
  last_air_date: string | null;
  production_companies: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  original_language: string;
  seasons: Array<{
    season_number: number;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
    name: string;
  }>;
}

interface SearchResult {
  tmdbId: number;
  name: string;
  originalName: string;
  overview: string;
  posterPath: string | null;
  backdropPath: string | null;
  firstAirDate: string | null;
  confidence: number;
}

/**
 * String similarity using Levenshtein distance
 * Returns 0-1 score (1 = identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
}

/**
 * Calculate confidence score for TMDB match
 */
function calculateConfidence(
  query: string,
  result: TMDBTvResult
): number {
  const nameSimilarity = stringSimilarity(query, result.name);
  const originalNameSimilarity = stringSimilarity(query, result.original_name);
  
  // Best string match
  const bestMatch = Math.max(nameSimilarity, originalNameSimilarity);
  
  // Normalize popularity (log scale, max ~500)
  const popularityScore = Math.min(Math.log10(result.popularity + 1) / 3, 1);
  
  // Weight: 70% string match, 30% popularity
  return bestMatch * 0.7 + popularityScore * 0.3;
}

/**
 * Search for TV show on TMDB
 * Returns best match with confidence score
 */
export async function searchTv(
  query: string,
  language: string = 'de-DE'
): Promise<SearchResult | null> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  try {
    const results = await searchTvResults(query, language);

    if (results.length === 0) {
      return null;
    }

    // Calculate confidence for all results
    const resultsWithConfidence = results.map((result: TMDBTvResult) => ({
      ...result,
      confidence: calculateConfidence(query, result),
    }));

    // Sort by confidence
    resultsWithConfidence.sort((a: any, b: any) => b.confidence - a.confidence);

    const best = resultsWithConfidence[0];

    return {
      tmdbId: best.id,
      name: best.name,
      originalName: best.original_name,
      overview: best.overview,
      posterPath: best.poster_path,
      backdropPath: best.backdrop_path,
      firstAirDate: best.first_air_date,
      confidence: best.confidence,
    };
  } catch (error) {
    console.error('TMDB search error:', error);
    return null;
  }
}

/**
 * Get detailed TV show information from TMDB
 */
export async function getTvDetails(
  tmdbId: number,
  language: string = 'de-DE'
): Promise<TMDBTvDetails | null> {
  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=${language}`,
      { next: { revalidate: 86400 } } // Cache 24h
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('TMDB getTvDetails error:', error);
    return null;
  }
}

/**
 * Get TMDB image URL
 */
export function getTmdbImageUrl(
  path: string | null,
  size: 'original' | 'w500' | 'w780' | 'w1280' = 'original'
): string | null {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * Get COMPLETE TV series details including cast, crew, videos, keywords
 * This is the MAXIMAL version for storing in database
 */
export async function getTvDetailsComplete(tmdbId: number, language: string = 'de-DE'): Promise<any> {
  if (!TMDB_API_KEY) return null;

  try {
    // Get main details with append_to_response for everything
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=${language}&append_to_response=credits,videos,keywords,external_ids`;
    
    const response = await fetch(url, {
      next: { revalidate: 86400 } // Cache for 24h
    });

    if (!response.ok) return null;

    const data = await response.json();

    // EN-Fallback für overview/tagline: TMDB liefert für junge Serien
    // oft nur in en-US einen Wert; de-DE bleibt leer bis Community-Übersetzung
    // existiert. Wir nehmen den englischen Text als Fallback statt nichts.
    let overview = data.overview as string;
    let tagline = data.tagline as string | null;
    if (language !== 'en-US' && ((!overview || !overview.trim()) || (!tagline || !tagline.trim()))) {
      try {
        const enUrl = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
        const enRes = await fetch(enUrl, { next: { revalidate: 86400 } });
        if (enRes.ok) {
          const en = await enRes.json();
          if ((!overview || !overview.trim()) && en.overview) overview = en.overview;
          if ((!tagline || !tagline.trim()) && en.tagline) tagline = en.tagline;
        }
      } catch { /* swallow — fallback is best-effort */ }
    }

    return {
      // Basic Info
      tmdbId: data.id,
      name: data.name,
      originalName: data.original_name,
      overview,
      tagline: tagline || null,
      type: data.type || null,
      status: data.status,
      inProduction: data.in_production,
      
      // Dates
      firstAirDate: data.first_air_date || null,
      lastAirDate: data.last_air_date || null,
      
      // Episodes & Seasons
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      episodeRunTime: data.episode_run_time || [],
      seasons: data.seasons || [],
      
      // Images
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      
      // Ratings
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      popularity: data.popularity,
      
      // Language & Country
      originalLanguage: data.original_language,
      spokenLanguages: data.spoken_languages || [],
      productionCountries: data.production_countries || [],
      
      // Genres & Networks
      genres: data.genres || [],
      networks: data.networks || [],
      productionCompanies: data.production_companies || [],
      
      // Cast & Crew (Top 20 each)
      cast: data.credits?.cast?.slice(0, 20).map((c: any) => ({
        name: c.name,
        character: c.character,
        profile_path: c.profile_path,
        order: c.order
      })) || [],
      
      crew: data.credits?.crew?.slice(0, 20).map((c: any) => ({
        name: c.name,
        job: c.job,
        department: c.department,
        profile_path: c.profile_path
      })) || [],
      
      // Videos (Trailers - YouTube only)
      trailers: data.videos?.results
        ?.filter((v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
        .slice(0, 5)
        .map((v: any) => ({
          key: v.key,  // YouTube ID
          name: v.name,
          type: v.type,
          site: v.site
        })) || [],
      
      // Keywords
      keywords: data.keywords?.results?.map((k: any) => k.name) || [],
      
      // Full data for backup
      tmdbData: data
    };
  } catch (error) {
    console.error('Failed to fetch complete TV details:', error);
    return null;
  }
}
