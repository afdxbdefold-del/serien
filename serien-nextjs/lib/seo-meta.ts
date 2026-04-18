/**
 * SEO Meta Utilities
 * Ensures title + description stay within Google's visible snippet limits
 * - Title: ~60 characters (Google desktop cutoff ~70, mobile ~60)
 * - Description: ~155 characters (Google cutoff ~160)
 */

const TITLE_MAX = 60;
const DESC_MAX = 155;

function truncateAtBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.substring(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.substring(0, lastSpace) : cut) + '…';
}

/**
 * Cap title at 60 chars. Appends " | serien.de" only if result still fits.
 */
export function seoTitle(raw: string, suffix = ' | serien.de'): string {
  const clean = raw.trim();
  if (clean.length + suffix.length <= TITLE_MAX) {
    return clean + suffix;
  }
  if (clean.length <= TITLE_MAX) {
    return clean;
  }
  return truncateAtBoundary(clean, TITLE_MAX);
}

/**
 * Cap description at 155 chars at word boundary.
 */
export function seoDescription(raw: string, fallback = 'Aktuelle Serien-News auf serien.de'): string {
  const clean = (raw || fallback).trim();
  return truncateAtBoundary(clean, DESC_MAX);
}
