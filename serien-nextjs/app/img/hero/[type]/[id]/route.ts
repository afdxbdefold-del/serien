import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

interface RouteParams {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

async function fetchTMDBImage(path: string, size: string = 'original'): Promise<Buffer | null> {
  try {
    const url = `${TMDB_IMAGE_BASE}/${size}${path}`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('TMDB fetch error:', error);
    return null;
  }
}

async function getImagePaths(type: string, id: string): Promise<{ backdrop: string | null; poster: string | null }> {
  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error('TMDB_API_KEY not configured');

    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}`;
    const response = await fetch(url, { next: { revalidate: 86400 } }); // Cache 24h
    
    if (!response.ok) return { backdrop: null, poster: null };
    
    const data = await response.json();
    return {
      backdrop: data.backdrop_path || null,
      poster: data.poster_path || null,
    };
  } catch (error) {
    console.error('TMDB API error:', error);
    return { backdrop: null, poster: null };
  }
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { type, id } = await context.params;
  
  // Validate type
  if (!['tv', 'movie'].includes(type)) {
    return new NextResponse('Invalid type', { status: 400 });
  }
  
  // Validate ID
  const tmdbId = parseInt(id);
  if (isNaN(tmdbId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  try {
    // Get TMDB paths
    const { backdrop, poster } = await getImagePaths(type, id);
    
    // Choose source (prefer backdrop for hero)
    const sourcePath = backdrop || poster;
    
    if (!sourcePath) {
      // Return placeholder
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    // Fetch image from TMDB
    const imageBuffer = await fetchTMDBImage(sourcePath, 'original');
    
    if (!imageBuffer) {
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    // Transform to Hero format (1280x720, 16:9)
    const processedImage = await sharp(imageBuffer)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 85 })
      .toBuffer();

    // Return image with cache headers
    return new Response(processedImage as any, {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    console.error('Image processing error:', error);
    return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
