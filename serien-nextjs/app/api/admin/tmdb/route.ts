import { NextRequest, NextResponse } from 'next/server';
import { searchTv, getTvDetails, getTvDetailsComplete } from '@/lib/tmdb';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verify admin token
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  
  const token = authHeader.substring(7);
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// GET: Search TMDB for series
export async function GET(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const tmdbId = searchParams.get('tmdbId');

    // Get details for specific series
    if (tmdbId) {
      const details = await getTvDetails(parseInt(tmdbId), 'de-DE');
      if (!details) {
        return NextResponse.json({ error: 'Series not found' }, { status: 404 });
      }
      return NextResponse.json({ series: details });
    }

    // Search for series
    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
    }

    const result = await searchTv(query, 'de-DE');
    
    if (!result) {
      return NextResponse.json({ results: [] });
    }

    // Return search results
    return NextResponse.json({ 
      results: [{
        tmdbId: result.tmdbId,
        name: result.name,
        originalName: result.originalName,
        overview: result.overview,
        posterPath: result.posterPath,
        backdropPath: result.backdropPath,
        firstAirDate: result.firstAirDate,
        confidence: result.confidence
      }]
    });

  } catch (error) {
    console.error('TMDB search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

// POST: Import series from TMDB into local database
export async function POST(request: NextRequest) {
  if (!await verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tmdbId, slug } = body;

    if (!tmdbId) {
      return NextResponse.json({ error: 'tmdbId is required' }, { status: 400 });
    }

    // Check if series already exists
    const existing = await prisma.series.findUnique({
      where: { tmdbId: parseInt(tmdbId) }
    });

    if (existing) {
      return NextResponse.json({ 
        success: true,
        message: 'Serie existiert bereits',
        series: {
          name: existing.name,
          slug: existing.slug,
          tmdbId: existing.tmdbId
        }
      });
    }

    // Fetch complete details from TMDB
    const details = await getTvDetailsComplete(parseInt(tmdbId), 'de-DE');
    
    if (!details) {
      return NextResponse.json({ error: 'Serie nicht bei TMDB gefunden' }, { status: 404 });
    }

    // Generate slug
    const seriesSlug = slug || details.name
      .toLowerCase()
      .replace(/[äöü]/g, (char: string) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[char] || char))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Create series
    const series = await prisma.series.create({
      data: {
        tmdbId: parseInt(tmdbId),
        name: details.name,
        title: details.name,
        slug: seriesSlug,
        posterPath: details.posterPath,
        backdropPath: details.backdropPath,
        overview: details.overview || '',
        status: details.status,
        firstAirDate: details.firstAirDate ? new Date(details.firstAirDate) : null,
        trailers: details.trailers || [],
        updatedAt: new Date(),
      }
    });

    console.log(`✅ Serie importiert: ${series.name} (${series.slug})`);

    return NextResponse.json({
      success: true,
      message: 'Serie erfolgreich importiert',
      series: {
        name: series.name,
        slug: series.slug,
        tmdbId: series.tmdbId,
        url: `/serie/${series.slug}`
      }
    });

  } catch (error: any) {
    console.error('TMDB import error:', error);
    return NextResponse.json({ error: error.message || 'Import fehlgeschlagen' }, { status: 500 });
  }
}
