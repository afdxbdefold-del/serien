import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { downloadYouTubeTrailer, searchYouTubeTrailerViaAPI, findTrailerYouTubeId } from '@/lib/trailer-downloader';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Track import progress
let importStatus = {
  isRunning: false,
  startedAt: null as Date | null,
  currentIndex: 0,
  totalSeries: 0,
  processed: 0,
  success: 0,
  failed: 0,
  skipped: 0,
  noTrailer: 0,
  currentSeries: '',
  lastError: '',
  shouldStop: false,
};

// Fetch trailers from TMDB - PRIORITÄT: DEUTSCH
async function fetchTrailersFromTMDB(tmdbId: number): Promise<any[]> {
  try {
    // ERST Deutsch versuchen
    const deRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=de-DE`
    );
    const deData = await deRes.json();
    
    const deTrailers = (deData.results || []).filter((v: any) => 
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
    
    // Deutsche Trailer gefunden? → Direkt zurückgeben
    if (deTrailers.length > 0) {
      return deTrailers;
    }
    
    // NUR wenn KEINE deutschen Trailer → Englisch als Fallback
    const enRes = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=en-US`
    );
    const enData = await enRes.json();
    
    return (enData.results || []).filter((v: any) => 
      v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
    );
  } catch {
    return [];
  }
}

// GET: Get status and statistics
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  
  if (action === 'stats') {
    const total = await prisma.series.count();
    const withTrailer = await prisma.series.count({
      where: { localTrailerPath: { not: null } }
    });
    const withTmdbTrailers = await prisma.series.count({
      where: { 
        trailers: { not: null },
        NOT: { trailers: { equals: [] } }
      }
    });
    
    // Get recent imports
    const recentWithTrailers = await prisma.series.findMany({
      where: { localTrailerPath: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        tmdbId: true,
        name: true,
        title: true,
        localTrailerPath: true,
        updatedAt: true
      }
    });
    
    return NextResponse.json({
      stats: {
        total,
        withTrailer,
        withoutTrailer: total - withTrailer,
        withTmdbTrailers,
        percentComplete: total > 0 ? Math.round((withTrailer / total) * 100) : 0
      },
      recentImports: recentWithTrailers,
      importStatus
    });
  }
  
  if (action === 'list') {
    const filter = searchParams.get('filter') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    
    let where: any = {};
    
    if (filter === 'with-trailer') {
      where.localTrailerPath = { not: null };
    } else if (filter === 'without-trailer') {
      where.localTrailerPath = null;
    } else if (filter === 'has-tmdb') {
      where.trailers = { not: null };
      where.NOT = { trailers: { equals: [] } };
      where.localTrailerPath = null;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const [series, count] = await Promise.all([
      prisma.series.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          tmdbId: true,
          name: true,
          title: true,
          posterPath: true,
          localTrailerPath: true,
          trailers: true,
          updatedAt: true
        }
      }),
      prisma.series.count({ where })
    ]);
    
    return NextResponse.json({
      series,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  }
  
  return NextResponse.json({ importStatus });
}

// POST: Control import process
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, tmdbId, options } = body;
  
  // Stop import
  if (action === 'stop') {
    importStatus.shouldStop = true;
    return NextResponse.json({ message: 'Stop signal sent' });
  }
  
  // Download single series trailer
  if (action === 'download-single' && tmdbId) {
    const series = await prisma.series.findUnique({
      where: { tmdbId: parseInt(tmdbId) },
      select: {
        tmdbId: true,
        name: true,
        title: true,
        trailers: true,
        localTrailerPath: true
      }
    });
    
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }
    
    const name = series.name || series.title || '';
    
    // Find trailer ID
    let trailerId = findTrailerYouTubeId(series.trailers);
    
    if (!trailerId) {
      const tmdbTrailers = await fetchTrailersFromTMDB(series.tmdbId);
      if (tmdbTrailers.length > 0) {
        trailerId = tmdbTrailers[0].key;
        await prisma.series.update({
          where: { tmdbId: series.tmdbId },
          data: { trailers: tmdbTrailers }
        });
      }
    }
    
    if (!trailerId) {
      trailerId = await searchYouTubeTrailerViaAPI(name, 'de');
      if (!trailerId) {
        trailerId = await searchYouTubeTrailerViaAPI(name, 'en');
      }
    }
    
    if (!trailerId) {
      return NextResponse.json({ error: 'No trailer found' }, { status: 404 });
    }
    
    const result = await downloadYouTubeTrailer(trailerId, name);
    
    if (result.success && result.localPath) {
      await prisma.series.update({
        where: { tmdbId: series.tmdbId },
        data: { localTrailerPath: result.localPath }
      });
      return NextResponse.json({ success: true, path: result.localPath });
    }
    
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  
  // Start bulk import
  if (action === 'start') {
    if (importStatus.isRunning) {
      return NextResponse.json({ error: 'Import already running' }, { status: 400 });
    }
    
    const skip = options?.skip || 0;
    const limit = options?.limit || 0;
    const filter = options?.filter || 'without-trailer';
    
    // Start async import
    startBulkImport(skip, limit, filter);
    
    return NextResponse.json({ message: 'Import started' });
  }
  
  // Refresh TMDB trailers for all series
  if (action === 'refresh-tmdb') {
    const series = await prisma.series.findMany({
      where: {
        OR: [
          { trailers: null },
          { trailers: { equals: [] } }
        ]
      },
      select: { tmdbId: true, name: true }
    });
    
    let updated = 0;
    for (const s of series) {
      const trailers = await fetchTrailersFromTMDB(s.tmdbId);
      if (trailers.length > 0) {
        await prisma.series.update({
          where: { tmdbId: s.tmdbId },
          data: { trailers }
        });
        updated++;
      }
      await new Promise(r => setTimeout(r, 250));
    }
    
    return NextResponse.json({ message: `Updated ${updated} series with TMDB trailers` });
  }
  
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// Bulk import function (runs async)
async function startBulkImport(skip: number, limit: number, filter: string) {
  importStatus = {
    isRunning: true,
    startedAt: new Date(),
    currentIndex: 0,
    totalSeries: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    noTrailer: 0,
    currentSeries: '',
    lastError: '',
    shouldStop: false,
  };
  
  try {
    let where: any = {};
    if (filter === 'without-trailer') {
      where.localTrailerPath = null;
    } else if (filter === 'has-tmdb') {
      where.trailers = { not: null };
      where.NOT = { trailers: { equals: [] } };
      where.localTrailerPath = null;
    }
    
    const series = await prisma.series.findMany({
      where,
      orderBy: { tmdbId: 'asc' },
      skip,
      take: limit || undefined,
      select: {
        tmdbId: true,
        name: true,
        title: true,
        trailers: true,
        localTrailerPath: true
      }
    });
    
    importStatus.totalSeries = series.length;
    
    for (let i = 0; i < series.length; i++) {
      if (importStatus.shouldStop) {
        importStatus.lastError = 'Stopped by user';
        break;
      }
      
      const s = series[i];
      const name = s.name || s.title || '';
      
      importStatus.currentIndex = i + 1;
      importStatus.currentSeries = name;
      
      // Skip if already has trailer
      if (s.localTrailerPath) {
        importStatus.skipped++;
        importStatus.processed++;
        continue;
      }
      
      try {
        // Find trailer ID
        let trailerId = findTrailerYouTubeId(s.trailers);
        
        if (!trailerId) {
          const tmdbTrailers = await fetchTrailersFromTMDB(s.tmdbId);
          if (tmdbTrailers.length > 0) {
            trailerId = tmdbTrailers[0].key;
            await prisma.series.update({
              where: { tmdbId: s.tmdbId },
              data: { trailers: tmdbTrailers }
            });
          }
        }
        
        if (!trailerId) {
          trailerId = await searchYouTubeTrailerViaAPI(name, 'de');
          if (!trailerId) {
            trailerId = await searchYouTubeTrailerViaAPI(name, 'en');
          }
        }
        
        if (!trailerId) {
          importStatus.noTrailer++;
          importStatus.processed++;
          continue;
        }
        
        const result = await downloadYouTubeTrailer(trailerId, name);
        
        if (result.success && result.localPath) {
          await prisma.series.update({
            where: { tmdbId: s.tmdbId },
            data: { localTrailerPath: result.localPath }
          });
          importStatus.success++;
        } else {
          importStatus.failed++;
          importStatus.lastError = result.error || 'Unknown error';
        }
      } catch (error: any) {
        importStatus.failed++;
        importStatus.lastError = error.message;
      }
      
      importStatus.processed++;
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (error: any) {
    importStatus.lastError = error.message;
  } finally {
    importStatus.isRunning = false;
  }
}
