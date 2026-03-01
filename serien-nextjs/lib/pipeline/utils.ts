/**
 * Pipeline Utilities
 * Common helper functions used across the pipeline
 */

/**
 * Generate URL-safe slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[äöü]/g, (char) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return slug.length >= 5 && /^[a-z0-9-]+$/.test(slug);
}

/**
 * Calculate target word count based on source
 */
export function calculateTargetWordCount(sourceWordCount: number): number {
  return Math.max(350, Math.min(1200, Math.round(sourceWordCount * 0.6)));
}

/**
 * Format date for logging
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Print section header
 */
export function printSectionHeader(title: string): void {
  console.log('\n' + '━'.repeat(70));
  console.log(title);
  console.log('━'.repeat(70));
}

/**
 * Print step header
 */
export function printStepHeader(stepNumber: string, title: string): void {
  console.log('\n' + '━'.repeat(70));
  console.log(`${stepNumber}: ${title}`);
  console.log('━'.repeat(70));
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Safe JSON stringify with error handling
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}
