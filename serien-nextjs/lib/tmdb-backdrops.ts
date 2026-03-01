/**
 * TMDB Backdrop Fetcher
 * Fetches top-rated backdrops for a series/movie
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

interface TMDBBackdrop {
  file_path: string;
  vote_average: number;
  vote_count: number;
  width: number;
  height: number;
}

interface BackdropData {
  path: string;
  voteAverage: number;
  voteCount: number;
}

/**
 * Fetch top N backdrops for a series/movie
 * @param type - 'tv' or 'movie'
 * @param id - TMDB ID
 * @param count - Number of backdrops to return (default: 10)
 * @returns Array of top-rated backdrops
 */
export async function fetchTopBackdrops(
  type: 'tv' | 'movie',
  id: number,
  count: number = 10
): Promise<BackdropData[]> {
  try {
    if (!TMDB_API_KEY) {
      throw new Error('TMDB_API_KEY not configured');
    }

    // Fetch images from TMDB
    const url = `${TMDB_BASE_URL}/${type}/${id}/images?api_key=${TMDB_API_KEY}&include_image_language=en,null`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`TMDB images API failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const backdrops = data.backdrops || [];

    if (backdrops.length === 0) {
      console.log('⚠️  No backdrops found on TMDB');
      return [];
    }

    console.log(`📸 Found ${backdrops.length} backdrops on TMDB`);

    // Sort by vote_average (highest first), then by vote_count as tiebreaker
    const sortedBackdrops = backdrops
      .filter((b: TMDBBackdrop) => b.vote_average > 0) // Only rated backdrops
      .sort((a: TMDBBackdrop, b: TMDBBackdrop) => {
        // Primary sort: vote_average
        if (b.vote_average !== a.vote_average) {
          return b.vote_average - a.vote_average;
        }
        // Secondary sort: vote_count (more votes = more reliable)
        return b.vote_count - a.vote_count;
      })
      .slice(0, count)
      .map((b: TMDBBackdrop) => ({
        path: b.file_path,
        voteAverage: b.vote_average,
        voteCount: b.vote_count,
      }));

    console.log(`✅ Selected top ${sortedBackdrops.length} backdrops:`);
    sortedBackdrops.forEach((b, i) => {
      console.log(`   ${i + 1}. ${b.path} (⭐ ${b.voteAverage.toFixed(1)}, 🗳️  ${b.voteCount} votes)`);
    });

    return sortedBackdrops;
  } catch (error: any) {
    console.error('Error fetching TMDB backdrops:', error.message);
    return [];
  }
}

/**
 * Get backdrop for article using rotation strategy
 * @param backdrops - Array of backdrop data
 * @param articleIndex - Index for rotation (e.g., article count for this series)
 * @returns Selected backdrop path
 */
export function selectBackdropForArticle(
  backdrops: BackdropData[],
  articleIndex: number
): string | null {
  if (!backdrops || backdrops.length === 0) {
    return null;
  }

  // Rotate through backdrops using modulo
  const index = articleIndex % backdrops.length;
  return backdrops[index].path;
}
