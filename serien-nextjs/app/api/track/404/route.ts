import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Store 404 in database
    await prisma.error_logs.create({
      data: {
        id: `404-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: '404',
        path: data.path || 'unknown',
        referrer: data.referrer || null,
        userAgent: data.userAgent?.substring(0, 500) || null,
        metadata: {
          timestamp: data.timestamp,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        },
        createdAt: new Date(),
      },
    });

    return NextResponse.json({ tracked: true });
  } catch (error) {
    console.error('[404 Track] Error:', error);
    return NextResponse.json({ tracked: false }, { status: 500 });
  }
}

// Also allow GET for simple tracking via image/pixel
export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path') || 'unknown';
  const referrer = request.nextUrl.searchParams.get('ref') || null;
  
  try {
    await prisma.error_logs.create({
      data: {
        id: `404-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: '404',
        path,
        referrer,
        userAgent: request.headers.get('user-agent')?.substring(0, 500) || null,
        metadata: {
          timestamp: new Date().toISOString(),
          ip: request.headers.get('x-forwarded-for') || null,
        },
        createdAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[404 Track] Error:', error);
  }
  
  // Return transparent 1x1 pixel (GIF)
  const pixel = Buffer.from([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
    0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00,
    0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x00, 0x02, 0x01, 0x44, 0x00, 0x3b,
  ]);
  return new NextResponse(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store',
    },
  });
}
