/**
 * Trailer Video Proxy API
 * 
 * Serves videos from Emergent Object Storage with streaming support
 * Path: /api/trailer/{storagePath}
 */

import { NextRequest, NextResponse } from 'next/server';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

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
  
  return storageKey!;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const storagePath = params.path.join('/');
    
    if (!storagePath) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 });
    }

    const key = await initStorage();
    
    // Fetch the video from storage
    const storageResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (!storageResponse.ok) {
      // Try refreshing key once
      storageKey = null;
      const newKey = await initStorage();
      
      const retryResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
        method: 'GET',
        headers: { 'X-Storage-Key': newKey },
      });
      
      if (!retryResponse.ok) {
        return NextResponse.json({ error: 'Video not found' }, { status: 404 });
      }
      
      return streamVideo(request, retryResponse);
    }

    return streamVideo(request, storageResponse);

  } catch (error: any) {
    console.error('Trailer proxy error:', error.message);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

async function streamVideo(request: NextRequest, storageResponse: Response): Promise<NextResponse> {
  // Get the video buffer (Emergent Storage doesn't support Range requests)
  const videoBuffer = await storageResponse.arrayBuffer();
  const totalSize = videoBuffer.byteLength;
  
  // Parse Range header
  const rangeHeader = request.headers.get('range');
  
  // Common headers for all responses
  const commonHeaders = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  };
  
  if (rangeHeader) {
    // Parse range (e.g., "bytes=0-1023" or "bytes=0-")
    const ranges = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(ranges[0], 10);
    // If end is empty, serve a reasonable chunk (1MB) or rest of file
    const requestedEnd = ranges[1] ? parseInt(ranges[1], 10) : null;
    const end = requestedEnd !== null ? Math.min(requestedEnd, totalSize - 1) : Math.min(start + 1024 * 1024, totalSize - 1);
    
    // Validate range
    if (start >= totalSize || start > end) {
      return new NextResponse('Range Not Satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${totalSize}` },
      });
    }
    
    const chunk = videoBuffer.slice(start, end + 1);
    
    return new NextResponse(chunk, {
      status: 206,
      headers: {
        ...commonHeaders,
        'Content-Length': chunk.byteLength.toString(),
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      },
    });
  }
  
  // Return full video
  return new NextResponse(videoBuffer, {
    status: 200,
    headers: {
      ...commonHeaders,
      'Content-Length': totalSize.toString(),
    },
  });
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
    },
  });
}

// Handle HEAD requests for video metadata
export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const params = await context.params;
    const storagePath = params.path.join('/');
    
    if (!storagePath) {
      return new NextResponse(null, { status: 400 });
    }

    const key = await initStorage();
    
    // Fetch the video to get its size
    const storageResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
      method: 'GET',
      headers: { 'X-Storage-Key': key },
    });

    if (!storageResponse.ok) {
      return new NextResponse(null, { status: 404 });
    }

    const videoBuffer = await storageResponse.arrayBuffer();
    const totalSize = videoBuffer.byteLength;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': totalSize.toString(),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      },
    });

  } catch (error: any) {
    console.error('HEAD error:', error.message);
    return new NextResponse(null, { status: 500 });
  }
}
