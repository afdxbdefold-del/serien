/**
 * Article Hero Image API - Serves hero images for articles from Emergent Object Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

interface RouteParams {
  params: Promise<{
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
  const { id } = await context.params;
  
  try {
    // Fetch article from database to get heroImagePath
    const article = await prisma.article.findUnique({
      where: { id },
      select: { heroImagePath: true },
    });

    if (!article || !article.heroImagePath) {
      console.warn(`Article ${id} not found or has no heroImagePath`);
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    const storagePath = article.heroImagePath;
    const key = await initStorage();
    
    // Fetch from Emergent Object Storage
    const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (!response.ok) {
      console.error(`Failed to fetch image from storage: ${storagePath}`);
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    // Return the image with proper caching headers
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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
