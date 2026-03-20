import { NextRequest, NextResponse } from 'next/server';
import { searchTv, getTvDetails } from '@/lib/tmdb';

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
