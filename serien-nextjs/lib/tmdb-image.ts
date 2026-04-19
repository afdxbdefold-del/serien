/**
 * Helper for proxied TMDB image URLs.
 *
 * All cast, person profile and poster images go through `/img/tmdb/...`
 * instead of hitting image.tmdb.org directly. The proxy route caches them
 * at the Vercel edge.
 *
 * Accepts either a raw TMDB path ("/abc.jpg") or null/undefined.
 */

export type TmdbImageSize =
  | 'w45'
  | 'w92'
  | 'w154'
  | 'w185'
  | 'w300'
  | 'w342'
  | 'w500'
  | 'w780'
  | 'w1280'
  | 'h632'
  | 'original';

export function tmdbImage(size: TmdbImageSize, path: string | null | undefined): string | null {
  if (!path) return null;
  // TMDB paths are returned with a leading slash, strip it to keep the URL tidy.
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return `/img/tmdb/${size}/${clean}`;
}
