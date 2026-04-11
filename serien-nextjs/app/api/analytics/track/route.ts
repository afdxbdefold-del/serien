import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { headers } from 'next/headers';
import { UAParser } from 'ua-parser-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, visitorId, event, path, referrer, duration, scrollDepth, articleId, seriesId, sourceCategory, sourceName, metadata } = body;

    if (!sessionId || !visitorId || !event || !path) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';

    // Bot filter — ignore crawlers, bots, and automated tools
    const ua = userAgent.toLowerCase();
    if (
      ua.includes('bot') || ua.includes('crawl') || ua.includes('spider') ||
      ua.includes('cookiebot') || ua.includes('mediapartners') ||
      ua.includes('slurp') || ua.includes('semrush') || ua.includes('ahrefs') ||
      ua.includes('mj12bot') || ua.includes('dotbot') || ua.includes('petalbot') ||
      ua.includes('bytespider') || ua.includes('gptbot') || ua.includes('chatgpt') ||
      ua.includes('headlesschrome') || ua.includes('phantomjs') || ua.includes('puppeteer') ||
      ua.includes('lighthouse') || ua.includes('pagespeed') || ua.includes('go-http-client') ||
      ua.includes('python-requests') || ua.includes('axios/') || ua.includes('node-fetch') ||
      !ua || ua.length < 20
    ) {
      return NextResponse.json({ ok: true, filtered: true });
    }

    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    let deviceType = 'desktop';
    if (device.type === 'mobile') deviceType = 'mobile';
    else if (device.type === 'tablet') deviceType = 'tablet';

    const country = headersList.get('x-vercel-ip-country') || headersList.get('cf-ipcountry') || null;
    const city = headersList.get('x-vercel-ip-city') || null;

    // Create event
    await prisma.analytics_events.create({
      data: {
        id: crypto.randomUUID(),
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

    // Update session
    if (event === 'page_view') {
      await prisma.analytics_sessions.upsert({
        where: { sessionId },
        update: {
          lastSeenAt: new Date(),
          pageViews: { increment: 1 },
          exitPage: path,
          isActive: true,
          isBounce: false, // 2+ page views = not a bounce
          sourceCategory: sourceCategory || undefined,
          sourceName: sourceName || undefined,
        },
        create: {
          id: crypto.randomUUID(),
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
          isBounce: true, // First page view = assume bounce until proven otherwise
          sourceCategory: sourceCategory || 'direct',
          sourceName: sourceName || 'Direkt',
        },
      });
    }

    // On page_exit, update engagement data
    if (event === 'page_exit' && duration !== undefined) {
      const engagement = metadata?.engagement || 'low';
      // If user stayed > 10s and scrolled > 25%, not a bounce even with 1 pageview
      const notBounce = duration >= 10 && (scrollDepth || 0) >= 25;

      await prisma.analytics_sessions.update({
        where: { sessionId },
        data: {
          totalDuration: duration,
          avgScrollDepth: scrollDepth || 0,
          engagementScore: engagement,
          ...(notBounce ? { isBounce: false } : {}),
        },
      }).catch(() => {}); // Session might not exist yet
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Analytics tracking error:', error);
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 });
  }
}

// Mark inactive sessions
export async function PUT() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.analytics_sessions.updateMany({
      where: { lastSeenAt: { lt: fiveMinutesAgo }, isActive: true },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}
