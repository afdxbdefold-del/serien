import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

// POST - Track event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, visitorId, event, path, referrer, duration, scrollDepth, articleId, seriesId, metadata } = body;

    if (!sessionId || !visitorId || !event || !path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse user agent
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    // Determine device type
    let deviceType = 'desktop';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';

    // Get country from header (Vercel provides this)
    const country = headersList.get('x-vercel-ip-country') || headersList.get('cf-ipcountry') || null;
    const city = headersList.get('x-vercel-ip-city') || null;

    // Create event
    await prisma.analytics_events.create({
      data: {
        sessionId,
        visitorId,
        event,
        path,
        referrer: referrer || null,
        userAgent,
        country,
        city,
        device: deviceType,
        browser: browser.name || null,
        os: os.name || null,
        duration: duration || null,
        scrollDepth: scrollDepth || null,
        articleId: articleId || null,
        seriesId: seriesId || null,
        metadata: metadata || null,
      },
    });

    // Update or create session
    if (event === 'page_view') {
      await prisma.analytics_sessions.upsert({
        where: { sessionId },
        update: {
          lastSeenAt: new Date(),
          pageViews: { increment: 1 },
          exitPage: path,
          isActive: true,
        },
        create: {
          sessionId,
          visitorId,
          entryPage: path,
          exitPage: path,
          referrer: referrer || null,
          userAgent,
          country,
          device: deviceType,
          browser: browser.name || null,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

// Mark inactive sessions (called periodically)
export async function PUT() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    await prisma.analytics_sessions.updateMany({
      where: {
        lastSeenAt: { lt: fiveMinutesAgo },
        isActive: true,
      },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
