/**
 * SERIES STATUS TRACKER
 * 
 * Automatische Berechnung des aktuellen Series-Status
 * Basierend auf TMDB + eigenen Artikeln
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeriesStatus = 'RUNNING' | 'RENEWED' | 'ENDED' | 'ON_HOLD' | 'UNCLEAR';

interface SeriesStatusResult {
  status: SeriesStatus;
  description: string;
  lastSeasonNumber: number | null;
  lastNewsDate: Date | null;
}

interface TmdbStatusData {
  status: string; // "Returning Series", "Ended", "Cancelled", etc.
  last_air_date: string | null;
  seasons: Array<{ season_number: number; air_date: string | null }>;
}

export async function calculateSeriesStatus(
  seriesId: string
): Promise<SeriesStatusResult> {
  // 1. Get Series from DB with TMDB data
  const series = await prisma.series.findUnique({
    where: { tmdbId: seriesId },
    select: {
      tmdbData: true,
      name: true,
    },
  });

  if (!series || !series.tmdbData) {
    return {
      status: 'UNCLEAR',
      description: 'Keine Daten verfügbar',
      lastSeasonNumber: null,
      lastNewsDate: null,
    };
  }

  const tmdbData = series.tmdbData as any;
  const tmdbStatus: TmdbStatusData = {
    status: tmdbData.status || 'Unknown',
    last_air_date: tmdbData.last_air_date || null,
    seasons: tmdbData.seasons || [],
  };

  // 2. Get recent articles (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const recentArticles = await prisma.articles.findMany({
    where: {
      primarySeriesId: seriesId,
      publishedAt: {
        gte: ninetyDaysAgo,
      },
      status: 'published',
    },
    orderBy: { publishedAt: 'desc' },
    select: {
      title: true,
      contentHtml: true,
      publishedAt: true,
    },
  });

  // 3. Calculate last season number
  const lastSeasonNumber = tmdbStatus.seasons.length > 0
    ? Math.max(...tmdbStatus.seasons.map(s => s.season_number))
    : null;

  // 4. Determine status
  const result = determineStatus(
    tmdbStatus,
    recentArticles,
    series.name,
    lastSeasonNumber
  );

  return result;
}

function determineStatus(
  tmdbData: TmdbStatusData,
  recentArticles: Array<{ title: string; contentHtml: string; publishedAt: Date | null }>,
  seriesName: string,
  lastSeasonNumber: number | null
): SeriesStatusResult {
  // Check for renewal article
  const renewalArticle = recentArticles.find(a =>
    a.title.toLowerCase().includes('staffel') &&
    (a.title.toLowerCase().includes('bestätigt') ||
     a.title.toLowerCase().includes('verlängert') ||
     a.title.toLowerCase().includes('erhält') ||
     a.contentHtml.toLowerCase().includes('verlänger'))
  );

  // Check for finale/end article
  const finaleArticle = recentArticles.find(a =>
    a.title.toLowerCase().includes('finale') ||
    a.title.toLowerCase().includes('endet') ||
    a.contentHtml.toLowerCase().includes('letzte staffel')
  );

  const lastNewsDate = recentArticles.length > 0 && recentArticles[0].publishedAt
    ? recentArticles[0].publishedAt
    : null;

  // Priority 1: ENDED
  if (tmdbData.status === 'Ended' || tmdbData.status === 'Cancelled' || finaleArticle) {
    return {
      status: 'ENDED',
      description: 'Serie wurde beendet',
      lastSeasonNumber,
      lastNewsDate,
    };
  }

  // Priority 2: RENEWED
  if (renewalArticle) {
    const staffelMatch = renewalArticle.title.match(/Staffel (\d+)/i);
    const nextSeason = staffelMatch ? parseInt(staffelMatch[1]) : null;
    
    return {
      status: 'RENEWED',
      description: nextSeason
        ? `Staffel ${nextSeason} wurde bestätigt`
        : 'Verlängerung wurde bestätigt',
      lastSeasonNumber,
      lastNewsDate: renewalArticle.publishedAt,
    };
  }

  // Priority 3: RUNNING
  if (tmdbData.status === 'Returning Series') {
    return {
      status: 'RUNNING',
      description: 'Serie läuft',
      lastSeasonNumber,
      lastNewsDate,
    };
  }

  // Priority 4: ON_HOLD
  if (tmdbData.last_air_date) {
    const lastAirDate = new Date(tmdbData.last_air_date);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    if (lastAirDate < twelveMonthsAgo) {
      return {
        status: 'ON_HOLD',
        description: 'Keine neuen Episoden seit über 12 Monaten',
        lastSeasonNumber,
        lastNewsDate,
      };
    }
  }

  // Default: UNCLEAR
  return {
    status: 'UNCLEAR',
    description: 'Status unklar',
    lastSeasonNumber,
    lastNewsDate,
  };
}

export async function updateSeriesStatus(seriesId: string): Promise<void> {
  const result = await calculateSeriesStatus(seriesId);

  await prisma.series.update({
    where: { tmdbId: seriesId },
    data: {
      currentStatus: result.status,
      statusDescription: result.description,
      statusLastUpdate: new Date(),
      lastSeasonNumber: result.lastSeasonNumber,
      lastNewsDate: result.lastNewsDate,
    },
  });

  console.log(`✅ Updated status for series ${seriesId}: ${result.status}`);
}

export async function updateAllSeriesStatuses(): Promise<void> {
  const allSeries = await prisma.series.findMany({
    select: { tmdbId: true, name: true },
  });

  console.log(`Updating status for ${allSeries.length} series...`);

  for (const series of allSeries) {
    try {
      await updateSeriesStatus(series.tmdbId);
    } catch (error) {
      console.error(`Failed to update ${series.name}:`, error);
    }
  }

  console.log('✅ All series statuses updated');
}
