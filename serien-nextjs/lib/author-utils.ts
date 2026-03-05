/**
 * Author utilities for slug generation and URL handling
 */

/**
 * Generate slug from author name
 * "Sophie Hartmann" -> "sophie-hartmann"
 */
export function generateAuthorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Get author URL from name
 */
export function getAuthorUrl(name: string): string {
  return `/autor/${generateAuthorSlug(name)}`;
}

/**
 * Find user by slug (generated from name)
 */
export function matchAuthorBySlug(slug: string, name: string): boolean {
  return generateAuthorSlug(name) === slug;
}
