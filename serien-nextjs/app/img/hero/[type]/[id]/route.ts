/**
 * Hero Image API - Serves from Emergent Object Storage
 * Fallback: Download from TMDB and store if not exists
 * Supports: tv, movie, article types
 * Query params: ?w=800 for width-based responsive images
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeAllImagesForItem } from '@/lib/image-storage';
import { generateBrandedHero } from '@/lib/generate-branded-hero';
import prisma from '@/lib/prisma';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

// TMDB backdrop sizes available
const TMDB_BACKDROP_SIZES: Record<number, string> = {
  300: 'w300',
  780: 'w780',
  1280: 'w1280',
  1920: 'original',
};

interface RouteParams {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

async function initStorage(): Promise<string> {
  const now = Date.now();
  if (storageKey && storageKeyExpiry > now) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not configured');
  }

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    throw new Error(`Storage init failed: ${response.status}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  storageKeyExpiry = now + (50 * 60 * 1000);
  
  return storageKey;
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { type, id } = await context.params;
  
  // Get requested width from query params (for responsive images)
  const requestedWidth = parseInt(request.nextUrl.searchParams.get('w') || '1280');
  
  // Validate type
  if (!['tv', 'movie', 'article'].includes(type)) {
    return new NextResponse('Invalid type', { status: 400 });
  }

  // Common cache headers for all responses
  const cacheHeaders = {
    'Content-Type': 'image/webp',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Vary': 'Accept',
  };

  // Handle article type separately
  if (type === 'article') {
    try {
      const article = await prisma.articles.findUnique({
        where: { id },
        select: { heroImagePath: true },
      });

      if (!article || !article.heroImagePath) {
        console.warn(`Article ${id} not found or has no heroImagePath`);
        return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
      }

      const storagePath = article.heroImagePath;
      const key = await initStorage();
      
      const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
        method: 'GET',
        headers: { 'X-Storage-Key': key },
      });

      if (!response.ok) {
        console.error(`Failed to fetch article image from storage: ${storagePath}`);
        return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
      }

      const imageBuffer = await response.arrayBuffer();
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Article hero image error:', error);
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }
  }
  
  // Handle tv/movie types (TMDB-based)
  const tmdbId = parseInt(id);
  if (isNaN(tmdbId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  try {
    const storagePath = `serien-nextjs/images/hero/${type}/${id}.webp`;
    const key = await initStorage();
    
    // Try to fetch from storage
    const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (response.ok) {
      // Image exists in storage - serve with optimized headers
      const imageBuffer = await response.arrayBuffer();
      return new Response(imageBuffer, {
        headers: cacheHeaders,
      });
    }

    // Image doesn't exist - download and store it
    console.log(`📸 Hero image not found, downloading from TMDB: ${type}/${id}`);
    
    const results = await storeAllImagesForItem(type as 'tv' | 'movie', tmdbId);
    
    if (!results.hero) {
      // BRANDED FALLBACK: generate a branded hero image from series metadata
      // (happens when TMDB has no backdrops, e.g. upcoming series in production)
      try {
        const series = await prisma.series.findUnique({
          where: { tmdbId },
          select: { name: true, title: true, networks: true, status: true, posterPath: true },
        });
        if (series) {
          const networks = Array.isArray(series.networks) ? series.networks : [];
          const network = (networks[0] as any)?.name || null;
          const buf = await generateBrandedHero({
            title: series.title || series.name || 'Serie',
            network,
            status: series.status,
            posterPath: series.posterPath,
            tmdbId,
          });
          console.log(`🎨 Generated branded hero for ${type}/${id} (no TMDB backdrop)`);
          return new Response(buf, {
            headers: {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'public, max-age=86400',
              'X-Hero-Source': 'branded-fallback',
            },
          });
        }
      } catch (genErr) {
        console.error('Branded hero generation failed:', genErr);
      }
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    // Fetch the newly stored image
    const newResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (!newResponse.ok) {
      throw new Error('Failed to fetch newly stored image');
    }

    const imageBuffer = await newResponse.arrayBuffer();
    return new Response(imageBuffer, {
      headers: cacheHeaders,
    });

  } catch (error) {
    console.error('Hero image error:', error);
    return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
