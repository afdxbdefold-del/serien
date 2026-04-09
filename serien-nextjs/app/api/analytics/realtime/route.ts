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

    // Mark old sessions as inactive
    await prisma.analytics_sessions.updateMany({
      where: {
        lastSeenAt: { lt: fiveMinutesAgo },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Active users right now (last 5 minutes)
    const activeUsers = await prisma.analytics_sessions.count({
      where: { isActive: true },
    });

    // Get active sessions with details
    const activeSessions = await prisma.analytics_sessions.findMany({
      where: { isActive: true },
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

    // Page views last hour
    const pageViewsLastHour = await prisma.analytics_events.count({
      where: {
        event: 'page_view',
        createdAt: { gte: oneHourAgo },
      },
    });

    // Page views today
    const pageViewsToday = await prisma.analytics_events.count({
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
      },
    });

    // Unique visitors today
    const uniqueVisitorsToday = await prisma.analytics_events.groupBy({
      by: ['visitorId'],
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
      },
    });

    // Page views yesterday (for comparison)
    const pageViewsYesterday = await prisma.analytics_events.count({
      where: {
        event: 'page_view',
        createdAt: {
          gte: yesterdayStart,
          lt: todayStart,
        },
      },
    });

    // Top pages right now
    const topPagesNow = await prisma.analytics_events.groupBy({
      by: ['path'],
      where: {
        event: 'page_view',
        createdAt: { gte: fiveMinutesAgo },
      },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    // Top pages today
    const topPagesToday = await prisma.analytics_events.groupBy({
      by: ['path'],
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
      },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    // Traffic sources
    const trafficSources = await prisma.analytics_events.groupBy({
      by: ['referrer'],
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
        referrer: { not: null },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: 10,
    });

    // Device breakdown
    const devices = await prisma.analytics_events.groupBy({
      by: ['device'],
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
      },
      _count: { device: true },
    });

    // Countries
    const countries = await prisma.analytics_events.groupBy({
      by: ['country'],
      where: {
        event: 'page_view',
        createdAt: { gte: todayStart },
        country: { not: null },
      },
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
      take: 10,
    });

    // Page views per hour (last 24h)
    const hourlyData = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('hour', "createdAt") as hour,
        COUNT(*) as views
      FROM analytics_events
      WHERE event = 'page_view' 
        AND "createdAt" >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', "createdAt")
      ORDER BY hour ASC
    ` as { hour: Date; views: bigint }[];

    // ========== NEW METRICS ==========

    // Traffic sources by CATEGORY (from sessions)
    const sourceCategoriesToday = await prisma.analytics_sessions.groupBy({
      by: ['sourceCategory', 'sourceName'],
      where: {
        startedAt: { gte: todayStart },
        sourceCategory: { not: null },
      },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
    });

    const sourceCategoriesYesterday = await prisma.analytics_sessions.groupBy({
      by: ['sourceCategory', 'sourceName'],
      where: {
        startedAt: { gte: yesterdayStart, lt: todayStart },
        sourceCategory: { not: null },
      },
      _count: { sessionId: true },
      orderBy: { _count: { sessionId: 'desc' } },
    });

    // Bounce rate today
    const totalSessionsToday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: todayStart } },
    });
    const bouncedSessionsToday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: todayStart }, isBounce: true },
    });

    // Bounce rate yesterday
    const totalSessionsYesterday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart } },
    });
    const bouncedSessionsYesterday = await prisma.analytics_sessions.count({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, isBounce: true },
    });

    // Engagement score distribution today
    const engagementToday = await prisma.analytics_sessions.groupBy({
      by: ['engagementScore'],
      where: {
        startedAt: { gte: todayStart },
        engagementScore: { not: null },
      },
      _count: { sessionId: true },
    });

    const engagementYesterday = await prisma.analytics_sessions.groupBy({
      by: ['engagementScore'],
      where: {
        startedAt: { gte: yesterdayStart, lt: todayStart },
        engagementScore: { not: null },
      },
      _count: { sessionId: true },
    });

    // Average session duration today
    const avgDurationToday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: todayStart }, totalDuration: { not: null } },
      _avg: { totalDuration: true },
    });
    const avgDurationYesterday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, totalDuration: { not: null } },
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
    
    // Unique visitors yesterday
    const uniqueVisitorsYesterday = await prisma.analytics_events.groupBy({
      by: ['visitorId'],
      where: {
        event: 'page_view',
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    });

    // Top pages yesterday
    const topPagesYesterday = await prisma.analytics_events.groupBy({
      by: ['path'],
      where: {
        event: 'page_view',
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      _count: { path: true },
      orderBy: { _count: { path: 'desc' } },
      take: 10,
    });

    // Traffic sources yesterday
    const trafficSourcesYesterday = await prisma.analytics_events.groupBy({
      by: ['referrer'],
      where: {
        event: 'page_view',
        createdAt: { gte: yesterdayStart, lt: todayStart },
        referrer: { not: null },
      },
      _count: { referrer: true },
      orderBy: { _count: { referrer: 'desc' } },
      take: 10,
    });

    // Devices yesterday
    const devicesYesterday = await prisma.analytics_events.groupBy({
      by: ['device'],
      where: {
        event: 'page_view',
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
      _count: { device: true },
    });

    // Countries yesterday
    const countriesYesterday = await prisma.analytics_events.groupBy({
      by: ['country'],
      where: {
        event: 'page_view',
        createdAt: { gte: yesterdayStart, lt: todayStart },
        country: { not: null },
      },
      _count: { country: true },
      orderBy: { _count: { country: 'desc' } },
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
        uniqueVisitors: uniqueVisitorsToday.length,
        yesterdayPageViews: pageViewsYesterday,
      },
      yesterday: {
        pageViews: pageViewsYesterday,
        uniqueVisitors: uniqueVisitorsYesterday.length,
      },
      topPages: {
        now: topPagesNow.map(p => ({ path: p.path, views: p._count.path })),
        today: topPagesToday.map(p => ({ path: p.path, views: p._count.path })),
        yesterday: topPagesYesterday.map(p => ({ path: p.path, views: p._count.path })),
      },
      trafficSources: trafficSources.map(s => ({
        source: s.referrer || 'Direct',
        count: s._count.referrer,
      })),
      trafficSourcesYesterday: trafficSourcesYesterday.map(s => ({
        source: s.referrer || 'Direct',
        count: s._count.referrer,
      })),
      devices: devices.map(d => ({
        device: d.device || 'Unknown',
        count: d._count.device,
      })),
      devicesYesterday: devicesYesterday.map(d => ({
        device: d.device || 'Unknown',
        count: d._count.device,
      })),
      countries: countries.map(c => ({
        country: c.country || 'Unknown',
        count: c._count.country,
      })),
      countriesYesterday: countriesYesterday.map(c => ({
        country: c.country || 'Unknown',
        count: c._count.country,
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
