/**
 * Generate a URL-friendly slug from a series title
 */
export function generateSeriesSlug(title: string, tmdbId?: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60); // Limit length
  
  return slug || (tmdbId ? `serie-${tmdbId}` : 'unknown');
}

/**
 * Extract TMDB ID from a series slug (legacy support)
 */
export function extractTmdbIdFromSlug(slug: string): number | null {
  const tmdbId = parseInt(slug.split('-')[0]);
  return isNaN(tmdbId) ? null : tmdbId;
}
