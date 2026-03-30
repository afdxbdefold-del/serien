/**
 * Image URL Helper - Returns local images with TMDB fallback
 */

export function getPersonImageUrl(
  localProfilePath: string | null | undefined,
  tmdbId: number | null | undefined,
  profilePath: string | null | undefined
): string {
  // Priority: local path > generated local path > TMDB
  if (localProfilePath) return localProfilePath;
  if (tmdbId) return `/images/persons/${tmdbId}.jpg`;
  if (profilePath) return `https://image.tmdb.org/t/p/w185${profilePath}`;
  return '/images/placeholder-person.jpg';
}

export function getSeriesPosterUrl(
  posterLocalUrl: string | null | undefined,
  tmdbId: number | null | undefined,
  posterPath: string | null | undefined
): string {
  if (posterLocalUrl) return posterLocalUrl;
  if (tmdbId) return `/images/series/${tmdbId}/poster.jpg`;
  if (posterPath) return `https://image.tmdb.org/t/p/w500${posterPath}`;
  return '/images/placeholder-poster.jpg';
}

export function getSeriesBackdropUrl(
  backdropLocalUrl: string | null | undefined,
  tmdbId: number | null | undefined,
  backdropPath: string | null | undefined
): string {
  if (backdropLocalUrl) return backdropLocalUrl;
  if (tmdbId) return `/images/series/${tmdbId}/backdrop.jpg`;
  if (backdropPath) return `https://image.tmdb.org/t/p/w1280${backdropPath}`;
  return '/images/placeholder-backdrop.jpg';
}
