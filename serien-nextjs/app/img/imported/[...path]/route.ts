/**
 * Imported Images API - Serves images from Emergent Object Storage
 * Path format: /img/imported/{slug}/hero.{ext}
 */

import { NextRequest, NextResponse } from 'next/server';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

interface RouteParams {
  params: Promise<{
    path: string[];
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
  const { path } = await context.params;
  
  // Reconstruct the storage path
  // Input: ['slug', 'hero.jpg'] -> serien-nextjs/imported/slug/hero.jpg
  const storagePath = `serien-nextjs/imported/${path.join('/')}`;
  
  try {
    const key = await initStorage();
    
    const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (!response.ok) {
      console.error(`Failed to fetch imported image: ${storagePath}`);
      return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
    }

    const imageBuffer = await response.arrayBuffer();
    
    // Determine content type from file extension
    const fileName = path[path.length - 1];
    let contentType = 'image/jpeg';
    if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.webp')) contentType = 'image/webp';
    else if (fileName.endsWith('.gif')) contentType = 'image/gif';
    
    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
    
  } catch (error) {
    console.error('Imported image error:', error);
    return NextResponse.redirect(new URL('/placeholders/hero.webp', request.url));
  }
}

export const runtime = 'nodejs';
