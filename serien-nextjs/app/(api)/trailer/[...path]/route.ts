/**
 * Trailer Video Proxy API
 * 
 * Serves videos from Emergent Object Storage
 * Path: /trailer/{storagePath}
 */

import { NextRequest, NextResponse } from 'next/server';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;

async function initStorage(): Promise<string> {
  if (storageKey) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    throw new Error('EMERGENT_LLM_KEY not found');
  }

  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    throw new Error(`Storage init failed: ${response.statusText}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  return storageKey;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Reconstruct the full storage path
    const storagePath = params.path.join('/');
    
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Storage path required' },
        { status: 400 }
      );
    }

    // Initialize storage and fetch video
    const key = await initStorage();
    
    const response = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: {
        'X-Storage-Key': key,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get video buffer
    const videoBuffer = await response.arrayBuffer();
    
    // Return video with appropriate headers
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error: any) {
    console.error('Trailer proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video' },
      { status: 500 }
    );
  }
}
