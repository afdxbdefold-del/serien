/**
 * OG Image API - Serves from Emergent Object Storage
 * Supports: tv, movie, article types
 */

import { NextRequest, NextResponse } from 'next/server';
import { storeAllImagesForItem } from '@/lib/image-storage';
import prisma from '@/lib/prisma';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

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
  
  // Validate type
  if (!['tv', 'movie', 'article'].includes(type)) {
    return new NextResponse('Invalid type', { status: 400 });
  }

  // Handle article type separately
  if (type === 'article') {
    try {
      const article = await prisma.articles.findUnique({
        where: { id },
        select: { ogImagePath: true },
      });

      if (!article || !article.ogImagePath) {
        console.warn(`Article ${id} not found or has no ogImagePath`);
        return NextResponse.redirect(new URL('/placeholders/og.webp', request.url));
      }

      const storagePath = article.ogImagePath;
      const key = await initStorage();
      
      const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
        method: 'GET',
        headers: { 'X-Storage-Key': key },
      });

      if (!response.ok) {
        console.error(`Failed to fetch article OG image from storage: ${storagePath}`);
        return NextResponse.redirect(new URL('/placeholders/og.webp', request.url));
      }

      const imageBuffer = await response.arrayBuffer();
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      console.error('Article OG image error:', error);
      return NextResponse.redirect(new URL('/placeholders/og.webp', request.url));
    }
  }
  
  // Handle tv/movie types (TMDB-based)
  const tmdbId = parseInt(id);
  if (isNaN(tmdbId)) {
    return new NextResponse('Invalid ID', { status: 400 });
  }

  try {
    const storagePath = `serien-nextjs/images/og/${type}/${id}.webp`;
    const key = await initStorage();
    
    // Try to fetch from storage
    const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (response.ok) {
      const imageBuffer = await response.arrayBuffer();
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
        },
      });
    }

    // Image doesn't exist - download and store it
    console.log(`📸 OG image not found, downloading: ${type}/${id}`);
    
    const results = await storeAllImagesForItem(type as 'tv' | 'movie', tmdbId);
    
    if (!results.og) {
      return NextResponse.redirect(new URL('/placeholders/og.webp', request.url));
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
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=86400, immutable',
      },
    });

  } catch (error) {
    console.error('OG image error:', error);
    return NextResponse.redirect(new URL('/placeholders/og.webp', request.url));
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
