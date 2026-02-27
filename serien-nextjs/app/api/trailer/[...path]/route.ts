/**
 * Trailer Video Proxy API
 * 
 * Serves videos from Emergent Object Storage
 * Path: /trailer/{storagePath}
 */

import { NextRequest, NextResponse } from 'next/server';

const STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage";
let storageKey: string | null = null;
let storageKeyExpiry: number = 0;

async function initStorage(): Promise<string> {
  // Re-initialize if key is expired (valid for 1 hour)
  const now = Date.now();
  if (storageKey && storageKeyExpiry > now) {
    return storageKey;
  }

  const emergentKey = process.env.EMERGENT_LLM_KEY;
  if (!emergentKey) {
    console.error('❌ EMERGENT_LLM_KEY not found in environment');
    throw new Error('EMERGENT_LLM_KEY not configured. Please set it in Vercel environment variables.');
  }

  console.log('🔑 Initializing storage with key...');
  
  const response = await fetch(`${STORAGE_URL}/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emergent_key: emergentKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Storage init failed:', response.status, errorText);
    throw new Error(`Storage init failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  storageKey = data.storage_key;
  // Cache for 50 minutes (10 min buffer before 1 hour expiry)
  storageKeyExpiry = now + (50 * 60 * 1000);
  
  console.log('✅ Storage key refreshed successfully');
  return storageKey;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  let storagePath = '';
  
  try {
    // Await params (Next.js 15 requirement)
    const params = await context.params;
    
    // Reconstruct the full storage path
    storagePath = params.path.join('/');
    
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
      // Try refreshing storage key once if request fails
      console.log('⚠️ Storage request failed, refreshing key...');
      storageKey = null; // Force re-init
      const newKey = await initStorage();
      
      const retryResponse = await fetch(`${STORAGE_URL}/objects/${storagePath}`, {
        method: 'GET',
        headers: {
          'X-Storage-Key': newKey,
        },
      });
      
      if (!retryResponse.ok) {
        console.error('❌ Video fetch failed even after key refresh:', retryResponse.status);
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }
      
      // Use retry response
      const videoBuffer = await retryResponse.arrayBuffer();
      const totalSize = videoBuffer.byteLength;
      
      // Parse Range header
      const rangeHeader = request.headers.get('range');
      
      if (rangeHeader) {
        const ranges = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(ranges[0], 10);
        const end = ranges[1] ? parseInt(ranges[1], 10) : totalSize - 1;
        
        if (start >= totalSize || end >= totalSize || start > end) {
          return new NextResponse('Range Not Satisfiable', {
            status: 416,
            headers: {
              'Content-Range': `bytes */${totalSize}`,
            },
          });
        }
        
        const chunkSize = end - start + 1;
        const chunk = videoBuffer.slice(start, end + 1);
        
        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': chunkSize.toString(),
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'Range',
          },
        });
      }
      
      return new NextResponse(videoBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    }

    // Get video buffer
    const videoBuffer = await response.arrayBuffer();
    const totalSize = videoBuffer.byteLength;
    
    // Parse Range header for video streaming support
    const rangeHeader = request.headers.get('range');
    
    if (rangeHeader) {
      // Parse range header (e.g., "bytes=0-1023")
      const ranges = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(ranges[0], 10);
      const end = ranges[1] ? parseInt(ranges[1], 10) : totalSize - 1;
      
      // Validate range
      if (start >= totalSize || end >= totalSize || start > end) {
        return new NextResponse('Range Not Satisfiable', {
          status: 416,
          headers: {
            'Content-Range': `bytes */${totalSize}`,
          },
        });
      }
      
      const chunkSize = end - start + 1;
      const chunk = videoBuffer.slice(start, end + 1);
      
      // Return partial content (206)
      return new NextResponse(chunk, {
        status: 206,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
        },
      });
    }
    
    // Return full video with appropriate headers (200)
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': totalSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      },
    });

  } catch (error: any) {
    console.error('❌ Trailer proxy error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      storagePath: storagePath || 'unknown',
    });
    
    // Return plain text error for debugging
    return new NextResponse(
      `Video Error: ${error.message}\nPlease check server logs for details.`,
      { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        }
      }
    );
  }
}
