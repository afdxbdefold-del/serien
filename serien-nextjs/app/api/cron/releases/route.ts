import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Provider IDs for Germany (from TMDB)
const PROVIDER_MAP: Record<number, string> = {
  8: 'Netflix',
  9: 'Prime Video',
  337: 'Disney+',
  384: 'HBO Max',
  350: 'Apple TV+',
  178: 'MagentaTV',
  421: 'Joyn',
  531: 'Paramount+',
  283: 'Crunchyroll',
  30: 'WOW',
  298: 'RTL+',
  445: 'CHILI',
  559: 'freenet Video',
  provider_id: 'Provider Name'
};

async function fetchFromTMDB(endpoint: string) {
  const url = `${TMDB_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}api_key=${TMDB_API_KEY}&language=de-DE&watch_region=DE`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`TMDB Error: ${response.status}`);
  return response.json();
}

async function getWatchProviders(tvId: number): Promise<string[]> {
  try {
    const data = await fetchFromTMDB(`/tv/${tvId}/watch/providers`);
    const deProviders = data.results?.DE;
    if (!deProviders) return [];
    
    const providers: string[] = [];
    const allProviders = [
      ...(deProviders.flatrate || []),
      ...(deProviders.free || []),
    ];
    
    for (const p of allProviders) {
      const name = PROVIDER_MAP[p.provider_id];
      if (name && !providers.includes(name)) {
        providers.push(name);
      }
    }
    return providers;
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== 'serien-releases-update-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🚀 Starting daily releases fetch...');

  try {
    // Fetch on-the-air and airing-today series
    const [onAir, airingToday] = await Promise.all([
      fetchFromTMDB('/tv/on_the_air?page=1'),
      fetchFromTMDB('/tv/airing_today?page=1'),
    ]);

    // Combine and deduplicate
    const allSeries = [...onAir.results, ...airingToday.results];
    const uniqueSeries = Array.from(new Map(allSeries.map(s => [s.id, s])).values());

    console.log(`   Found ${uniqueSeries.length} unique series`);

    const releases: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Process each series
    for (const series of uniqueSeries.slice(0, 50)) { // Limit to 50
      const providers = await getWatchProviders(series.id);
      
      for (const provider of providers) {
        releases.push({
          tmdbId: series.id,
          provider,
          date: today,
          name: series.name,
          overview: series.overview || null,
          posterPath: series.poster_path || null,
          backdropPath: series.backdrop_path || null,
          firstAirDate: series.first_air_date ? new Date(series.first_air_date) : null,
          voteAverage: series.vote_average || null,
          releaseType: 'new_episode',
          fetchedAt: new Date(),
        });
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    console.log(`   Processed ${releases.length} releases`);

    // Delete old releases (older than 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    await prisma.streaming_releases.deleteMany({
      where: { date: { lt: fourteenDaysAgo } }
    });

    // Upsert releases
    for (const release of releases) {
      await prisma.streaming_releases.upsert({
        where: {
          tmdbId_provider_date: {
            tmdbId: release.tmdbId,
            provider: release.provider,
            date: release.date,
          }
        },
        update: {
          name: release.name,
          overview: release.overview,
          posterPath: release.posterPath,
          voteAverage: release.voteAverage,
          fetchedAt: release.fetchedAt,
        },
        create: release,
      });
    }

    console.log('✅ Daily releases fetch complete');

    return NextResponse.json({
      success: true,
      count: releases.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('❌ Cron error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
