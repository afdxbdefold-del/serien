/**
 * Fallback Q&A Generator V2: DISABLED
 * 
 * Rule: No Q&A is better than bad Q&A.
 * Fallback now returns empty array to force omission.
 */

import { QAItem, ArticleQAInput } from './qa-generator';

export interface SeriesQAInput {
  seriesName: string;
  overview: string;
  status: string;
  numberOfSeasons: number;
  firstAirDate: string;
  lastSeasonDate?: string;
  latestNews?: string;
}

/**
 * DISABLED: No fallback Q&A
 * Returns empty array to omit Q&A section entirely
 */
export function generateFallbackArticleQA(_input: ArticleQAInput): QAItem[] {
  return [];
}

/**
 * DISABLED: No fallback Q&A for series pages
 * Returns empty array to omit Q&A section entirely
 */
export function generateFallbackSeriesQA(_input: SeriesQAInput): QAItem[] {
  return [];
}
