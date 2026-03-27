import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const maxDuration = 300; // 5 minutes max
export const dynamic = 'force-dynamic';

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

function isAuthorized(request: NextRequest): boolean {
  // Method 1: Vercel Cron sends Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  
  // Method 2: URL parameter fallback for manual testing
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret === process.env.CRON_SECRET || secret === 'serien-releases-update-2024') {
    return true;
  }
  
  return false;
}

export async function GET(request: NextRequest) {
  // Verify authorization
  if (!isAuthorized(request)) {
    console.log('[CRON] Unauthorized request to /api/cron/releases');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('🚀 Starting daily releases fetch...');

  try {
    // Fetch multiple sources for better coverage
    const [onAir, airingToday, popular, trending] = await Promise.all([
      fetchFromTMDB('/tv/on_the_air?page=1'),
      fetchFromTMDB('/tv/airing_today?page=1'),
      fetchFromTMDB('/tv/popular?page=1'),
      fetchFromTMDB('/trending/tv/day'),
    ]);

    // Combine and deduplicate - prioritize airing_today and trending
    const allSeries = [
      ...airingToday.results, 
      ...trending.results,
      ...onAir.results, 
      ...popular.results
    ];
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
      const releaseId = `${release.tmdbId}-${release.provider}-${release.date.toISOString().split('T')[0]}`;
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
        create: {
          id: releaseId,
          ...release,
        },
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
