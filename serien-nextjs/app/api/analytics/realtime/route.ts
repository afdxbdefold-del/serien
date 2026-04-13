import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Real-time analytics data
export async function GET() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // Bot filter for all session queries (UA-based + behavior-based)
    // DACH-only: Nur Deutschland, Österreich, Schweiz anzeigen
    const DACH_COUNTRIES = ['DE', 'AT', 'CH'];
    const notBot = {
      AND: [
        {
          country: { in: DACH_COUNTRIES },
        },
        {
          NOT: {
            OR: [
              { userAgent: { contains: 'bot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'crawl', mode: 'insensitive' as const } },
              { userAgent: { contains: 'spider', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Cookiebot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Mediapartners', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Lighthouse', mode: 'insensitive' as const } },
              { userAgent: { contains: 'HeadlessChrome', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Puppeteer', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Go-http-client', mode: 'insensitive' as const } },
              { userAgent: { contains: 'python-requests', mode: 'insensitive' as const } },
              { userAgent: { contains: 'axios/', mode: 'insensitive' as const } },
              { userAgent: { contains: 'node-fetch', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Applebot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Bytespider', mode: 'insensitive' as const } },
              { userAgent: { contains: 'PetalBot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Amazonbot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'facebookexternalhit', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Twitterbot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'WhatsApp', mode: 'insensitive' as const } },
              { userAgent: { contains: 'Discordbot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'TelegramBot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'DataForSeoBot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'ClaudeBot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'GPTBot', mode: 'insensitive' as const } },
              { userAgent: { contains: 'CCBot', mode: 'insensitive' as const } },
              { userAgent: null },
              { userAgent: '' },
            ],
          },
        },
      ],
    };

    // DACH SQL filter for raw queries
    const DACH_SQL = `AND s.country IN ('DE', 'AT', 'CH')`;

    // Mark old sessions as inactive
    await prisma.analytics_sessions.updateMany({
      where: {
        lastSeenAt: { lt: fiveMinutesAgo },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Active users right now (last 5 minutes) — exclude bots + suspicious behavior
    const activeUsers = await prisma.analytics_sessions.count({
      where: { 
        isActive: true, 
        ...notBot,
        // Exclude sessions with no heartbeat (bots don't send heartbeats)
        OR: [
          { totalDuration: { gt: 0 } },
          { startedAt: { gte: new Date(now.getTime() - 10 * 1000) } }, // Allow brand new sessions
        ],
      },
    });

    // Get active sessions with details — exclude bots + suspicious
    const activeSessions = await prisma.analytics_sessions.findMany({
      where: { 
        isActive: true, 
        ...notBot,
        OR: [
          { totalDuration: { gt: 0 } },
          { startedAt: { gte: new Date(now.getTime() - 10 * 1000) } },
        ],
      },
      orderBy: { lastSeenAt: 'desc' },
      take: 50,
      select: {
        sessionId: true,
        entryPage: true,
        exitPage: true,
        pageViews: true,
        country: true,
        device: true,
        browser: true,
        startedAt: true,
        lastSeenAt: true,
        referrer: true,
      },
    });

    // Page views last hour (DACH only + exclude bots)
    const [pvLastHour] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${oneHourAgo}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
    ` as { count: bigint }[];
    const pageViewsLastHour = Number(pvLastHour?.count || 0);

    // Page views today (exclude bot sessions via JOIN + DACH only)
    const [pvToday] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%'
        AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%'
        AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%'
        AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
    ` as { count: bigint }[];
    const pageViewsToday = Number(pvToday?.count || 0);

    // Unique visitors today (exclude bots + DACH only)
    const uvToday = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT e."visitorId") as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%'
        AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%'
        AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%'
        AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
    ` as { count: bigint }[];
    const uniqueVisitorsTodayCount = Number(uvToday[0]?.count || 0);

    // Page views yesterday (exclude bots + DACH only)
    const [pvYesterday] = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%'
        AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%'
        AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%'
        AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
    ` as { count: bigint }[];
    const pageViewsYesterday = Number(pvYesterday?.count || 0);

    // Bot filter SQL clause (reusable)
    const BOT_FILTER = `
        AND s."userAgent" NOT ILIKE '%bot%'
        AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%'
        AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%'
        AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'`;

    // Top pages right now (exclude bots + DACH only)
    const topPagesNow = await prisma.$queryRaw`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${fiveMinutesAgo}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    ` as { path: string; count: bigint }[];

    // Top pages today (exclude bots + DACH only)
    const topPagesToday = await prisma.$queryRaw`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    ` as { path: string; count: bigint }[];

    // Traffic sources (exclude bots + DACH only)
    const trafficSources = await prisma.$queryRaw`
      SELECT e.referrer as source, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart} AND e.referrer IS NOT NULL
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY e.referrer ORDER BY count DESC LIMIT 10
    ` as { source: string; count: bigint }[];

    // Device breakdown (from sessions, not events — more accurate)
    const devices = await prisma.analytics_sessions.groupBy({
      by: ['device'],
      where: { startedAt: { gte: todayStart }, ...notBot },
      _count: { sessionId: true },
    });

    // Countries (from sessions)
    const countries = await prisma.analytics_sessions.groupBy({
      by: ['country'],
      where: { startedAt: { gte: todayStart }, country: { not: null }, ...notBot },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
      take: 10,
    });

    // Page views per hour (last 24h, exclude bots + DACH only)
    const hourlyData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', e."createdAt") as hour,
        COUNT(*) as views
      FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' 
        AND e."createdAt" >= NOW() - INTERVAL '24 hours'
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY DATE_TRUNC('hour', e."createdAt")
      ORDER BY hour ASC
    ` as { hour: Date; views: bigint }[];

    // ========== NEW METRICS ==========

    // Traffic sources by CATEGORY (from sessions — exclude bots)
    const sourceCategoriesToday = await prisma.analytics_sessions.groupBy({
      by: ['sourceCategory', 'sourceName'],
      where: {
        startedAt: { gte: todayStart },
        sourceCategory: { not: null },
        ...notBot,
      },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
    });

    const sourceCategoriesYesterday = await prisma.analytics_sessions.groupBy({
      by: ['sourceCategory', 'sourceName'],
      where: {
        startedAt: { gte: yesterdayStart, lt: todayStart },
        sourceCategory: { not: null },
        ...notBot,
      },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
    });

    // Bounce rate today (exclude bots)
    const totalSessionsToday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: todayStart }, ...notBot },
    });
    const bouncedSessionsToday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: todayStart }, isBounce: true, ...notBot },
    });

    // Bounce rate yesterday (exclude bots)
    const totalSessionsYesterday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, ...notBot },
    });
    const bouncedSessionsYesterday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, isBounce: true, ...notBot },
    });

    // Engagement score distribution today (exclude bots)
    const engagementToday = await prisma.analytics_sessions.groupBy({
      by: ['engagementScore'],
      where: {
        startedAt: { gte: todayStart },
        engagementScore: { not: null },
        ...notBot,
      },
      _count: { sessionId: true },
    });

    const engagementYesterday = await prisma.analytics_sessions.groupBy({
      by: ['engagementScore'],
      where: {
        startedAt: { gte: yesterdayStart, lt: todayStart },
        engagementScore: { not: null },
        ...notBot,
      },
      _count: { sessionId: true },
    });

    // Average session duration today (exclude bots)
    const avgDurationToday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: todayStart }, totalDuration: { not: null }, ...notBot },
      _avg: { totalDuration: true },
    });
    const avgDurationYesterday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, totalDuration: { not: null }, ...notBot },
      _avg: { totalDuration: true },
    });

    // Internal link clicks today
    const internalClicksToday = await prisma.$queryRaw`
      SELECT 
        metadata->>'linkType' as "linkType",
        COUNT(*) as count
      FROM analytics_events
      WHERE event = 'internal_click'
        AND "createdAt" >= ${todayStart}
        AND metadata->>'linkType' IS NOT NULL
      GROUP BY metadata->>'linkType'
      ORDER BY count DESC
    ` as { linkType: string; count: bigint }[];

    const internalClicksYesterday = await prisma.$queryRaw`
      SELECT 
        metadata->>'linkType' as "linkType",
        COUNT(*) as count
      FROM analytics_events
      WHERE event = 'internal_click'
        AND "createdAt" >= ${yesterdayStart}
        AND "createdAt" < ${todayStart}
        AND metadata->>'linkType' IS NOT NULL
      GROUP BY metadata->>'linkType'
      ORDER BY count DESC
    ` as { linkType: string; count: bigint }[];

    // ========== YESTERDAY DATA ==========
    
    // Unique visitors yesterday (exclude bots + DACH only)
    const uvYesterday = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT e."visitorId") as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
    ` as { count: bigint }[];
    const uniqueVisitorsYesterdayCount = Number(uvYesterday[0]?.count || 0);

    // Top pages yesterday (exclude bots + DACH only)
    const topPagesYesterday = await prisma.$queryRaw`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    ` as { path: string; count: bigint }[];

    // Traffic sources yesterday (exclude bots + DACH only)
    const trafficSourcesYesterday = await prisma.$queryRaw`
      SELECT e.referrer as source, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        AND e.referrer IS NOT NULL
        AND s.country IN ('DE', 'AT', 'CH')
        AND s."userAgent" NOT ILIKE '%bot%' AND s."userAgent" NOT ILIKE '%crawl%'
        AND s."userAgent" NOT ILIKE '%spider%' AND s."userAgent" NOT ILIKE '%Cookiebot%'
        AND s."userAgent" NOT ILIKE '%Mediapartners%' AND s."userAgent" NOT ILIKE '%Lighthouse%'
        AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
      GROUP BY e.referrer ORDER BY count DESC LIMIT 10
    ` as { source: string; count: bigint }[];

    // Devices yesterday (from sessions — exclude bots)
    const devicesYesterday = await prisma.analytics_sessions.groupBy({
      by: ['device'],
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, ...notBot },
      _count: { sessionId: true },
    });

    // Countries yesterday (from sessions — exclude bots)
    const countriesYesterday = await prisma.analytics_sessions.groupBy({
      by: ['country'],
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, country: { not: null }, ...notBot },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
      take: 10,
    });

    return NextResponse.json({
      realtime: {
        activeUsers,
        activeSessions,
        pageViewsLastHour,
      },
      today: {
        pageViews: pageViewsToday,
        uniqueVisitors: uniqueVisitorsTodayCount,
        yesterdayPageViews: pageViewsYesterday,
      },
      yesterday: {
        pageViews: pageViewsYesterday,
        uniqueVisitors: uniqueVisitorsYesterdayCount,
      },
      topPages: {
        now: topPagesNow.map(p => ({ path: p.path, views: Number(p.count) })),
        today: topPagesToday.map(p => ({ path: p.path, views: Number(p.count) })),
        yesterday: topPagesYesterday.map(p => ({ path: p.path, views: Number(p.count) })),
      },
      trafficSources: trafficSources.map(s => ({
        source: s.source || 'Direct',
        count: Number(s.count),
      })),
      trafficSourcesYesterday: trafficSourcesYesterday.map(s => ({
        source: s.source || 'Direct',
        count: Number(s.count),
      })),
      devices: devices.map(d => ({
        device: d.device || 'Unknown',
        count: d._count.sessionId,
      })),
      devicesYesterday: devicesYesterday.map(d => ({
        device: d.device || 'Unknown',
        count: d._count.sessionId,
      })),
      countries: countries.map(c => ({
        country: c.country || 'Unknown',
        count: c._count.sessionId,
      })),
      countriesYesterday: countriesYesterday.map(c => ({
        country: c.country || 'Unknown',
        count: c._count.sessionId,
      })),
      hourlyViews: hourlyData.map(h => ({
        hour: h.hour,
        views: Number(h.views),
      })),
      // New metrics
      sourceCategories: {
        today: sourceCategoriesToday.map(s => ({
          category: s.sourceCategory || 'unknown',
          name: s.sourceName || 'Unbekannt',
          count: s._count.sessionId,
        })),
        yesterday: sourceCategoriesYesterday.map(s => ({
          category: s.sourceCategory || 'unknown',
          name: s.sourceName || 'Unbekannt',
          count: s._count.sessionId,
        })),
      },
      bounceRate: {
        today: totalSessionsToday > 0 ? Math.round((bouncedSessionsToday / totalSessionsToday) * 100) : 0,
        yesterday: totalSessionsYesterday > 0 ? Math.round((bouncedSessionsYesterday / totalSessionsYesterday) * 100) : 0,
        todaySessions: totalSessionsToday,
        yesterdaySessions: totalSessionsYesterday,
      },
      engagement: {
        today: engagementToday.map(e => ({
          score: e.engagementScore || 'unknown',
          count: e._count.sessionId,
        })),
        yesterday: engagementYesterday.map(e => ({
          score: e.engagementScore || 'unknown',
          count: e._count.sessionId,
        })),
      },
      avgDuration: {
        today: Math.round(avgDurationToday._avg.totalDuration || 0),
        yesterday: Math.round(avgDurationYesterday._avg.totalDuration || 0),
      },
      internalClicks: {
        today: internalClicksToday.map(c => ({
          linkType: c.linkType,
          count: Number(c.count),
        })),
        yesterday: internalClicksYesterday.map(c => ({
          linkType: c.linkType,
          count: Number(c.count),
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Analytics realtime error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
