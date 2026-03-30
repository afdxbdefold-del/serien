/**
 * Image URL Helper - Returns Vercel Blob URLs with TMDB fallback
 */

const BLOB_BASE = process.env.NEXT_PUBLIC_BLOB_URL || process.env.BLOB_PUBLIC_URL || 'https://bufkykmwsu16ncp5.public.blob.vercel-storage.com';

export function getPersonImageUrl(
  localProfilePath: string | null | undefined,
  tmdbId: number | null | undefined,
  profilePath: string | null | undefined
): string {
  // Priority: blob URL > generated blob path > TMDB fallback
  if (localProfilePath?.startsWith('https://')) return localProfilePath;
  if (tmdbId) return `${BLOB_BASE}/persons/${tmdbId}.jpg`;
  if (profilePath) return `https://image.tmdb.org/t/p/w185${profilePath}`;
  return '/images/placeholder-person.svg';
}

export function getSeriesPosterUrl(
  posterLocalUrl: string | null | undefined,
  tmdbId: number | null | undefined,
  posterPath: string | null | undefined
): string {
  if (posterLocalUrl?.startsWith('https://')) return posterLocalUrl;
  if (tmdbId) return `${BLOB_BASE}/series/${tmdbId}/poster.jpg`;
  if (posterPath) return `https://image.tmdb.org/t/p/w500${posterPath}`;
  return '/images/placeholder-poster.svg';
}

export function getSeriesBackdropUrl(
  backdropLocalUrl: string | null | undefined,
  tmdbId: number | null | undefined,
  backdropPath: string | null | undefined
): string {
  if (backdropLocalUrl?.startsWith('https://')) return backdropLocalUrl;
  if (tmdbId) return `${BLOB_BASE}/series/${tmdbId}/backdrop.jpg`;
  if (backdropPath) return `https://image.tmdb.org/t/p/w1280${backdropPath}`;
  return '/images/placeholder-backdrop.svg';
}
