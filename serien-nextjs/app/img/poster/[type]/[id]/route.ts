/**
 * Poster Image Proxy API
 * Fetches poster images from TMDB and caches them
 * Falls back to placeholder for missing posters
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;
  const tmdbId = parseInt(id, 10);

  if (isNaN(tmdbId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  try {
    // Try to get poster path from database
    let posterPath: string | null = null;

    if (type === 'tv') {
      const series = await prisma.series.findUnique({
        where: { tmdbId },
        select: { posterPath: true, posterLocalUrl: true },
      });
      
      // Use local URL if available
      if (series?.posterLocalUrl) {
        return NextResponse.redirect(new URL(series.posterLocalUrl, request.url));
      }
      
      posterPath = series?.posterPath || null;
    }

    // If we have a TMDB poster path, proxy it
    if (posterPath) {
      const tmdbUrl = `https://image.tmdb.org/t/p/w500${posterPath}`;
      
      const response = await fetch(tmdbUrl, {
        headers: {
          'User-Agent': 'serien.de/1.0',
        },
      });

      if (response.ok) {
        const imageBuffer = await response.arrayBuffer();
        
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
          },
        });
      }
    }

    // Fallback: Try to fetch directly from TMDB API
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (tmdbApiKey) {
      const apiUrl = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${tmdbApiKey}`;
      const apiResponse = await fetch(apiUrl);
      
      if (apiResponse.ok) {
        const data = await apiResponse.json();
        const fetchedPosterPath = data.poster_path;
        
        if (fetchedPosterPath) {
          // Update database with the poster path
          if (type === 'tv') {
            await prisma.series.update({
              where: { tmdbId },
              data: { posterPath: fetchedPosterPath },
            }).catch(() => {}); // Ignore update errors
          }
          
          // Fetch and return the image
          const tmdbUrl = `https://image.tmdb.org/t/p/w500${fetchedPosterPath}`;
          const imageResponse = await fetch(tmdbUrl);
          
          if (imageResponse.ok) {
            const imageBuffer = await imageResponse.arrayBuffer();
            
            return new NextResponse(imageBuffer, {
              headers: {
                'Content-Type': imageResponse.headers.get('Content-Type') || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
              },
            });
          }
        }
      }
    }

    // No poster found - return 404
    return new NextResponse('Poster not found', { status: 404 });

  } catch (error) {
    console.error('Poster proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
