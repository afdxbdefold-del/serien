/**
 * Server Action: Generate Series Q&A on-the-fly
 */

import { generateSeriesQA, QAItem } from '@/lib/qa-generator';

export async function getSeriesQA(
  seriesName: string,
  overview: string,
  status: string,
  numberOfSeasons: number,
  firstAirDate: Date | null,
  lastSeasonDate?: Date | null
): Promise<QAItem[]> {
  try {
    const qa = await generateSeriesQA({
      seriesName,
      overview: overview || 'Keine Beschreibung verfügbar',
      status: status || 'UNKNOWN',
      numberOfSeasons,
      firstAirDate: firstAirDate?.toISOString() || new Date().toISOString(),
      lastSeasonDate: lastSeasonDate?.toISOString(),
    });

    return qa;
  } catch (error) {
    console.error('Series Q&A generation failed:', error);
    return [];
  }
}
