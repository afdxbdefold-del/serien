import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Shared bot-filter SQL fragment. MUST stay in lock-step with the Prisma
 * `notBot` object below — every pattern here is also there, and vice versa.
 * Raw SQL ILIKE is case-insensitive so we don't need separate casings.
 *
 * Why this exists: we had a drift bug where raw-SQL counters (pageViews,
 * uniqueVisitors, topPages, trafficSources) filtered a subset of what
 * Prisma queries filtered. Result: ~15 % of bot traffic (Applebot, GPTBot,
 * ClaudeBot, CCBot, Twitterbot, facebookexternalhit, Amazonbot, Bytespider,
 * PetalBot, DataForSeoBot, Puppeteer, axios, python-requests, node-fetch,
 * null/empty UAs) was counted as real DACH users.
 */
const BOT_FILTER_SQL = Prisma.sql`
  AND s."userAgent" IS NOT NULL
  AND s."userAgent" <> ''
  AND s."userAgent" NOT ILIKE '%bot%'
  AND s."userAgent" NOT ILIKE '%crawl%'
  AND s."userAgent" NOT ILIKE '%spider%'
  AND s."userAgent" NOT ILIKE '%Cookiebot%'
  AND s."userAgent" NOT ILIKE '%Mediapartners%'
  AND s."userAgent" NOT ILIKE '%Lighthouse%'
  AND s."userAgent" NOT ILIKE '%HeadlessChrome%'
  AND s."userAgent" NOT ILIKE '%Puppeteer%'
  AND s."userAgent" NOT ILIKE '%Go-http-client%'
  AND s."userAgent" NOT ILIKE '%python-requests%'
  AND s."userAgent" NOT ILIKE '%axios/%'
  AND s."userAgent" NOT ILIKE '%node-fetch%'
  AND s."userAgent" NOT ILIKE '%Applebot%'
  AND s."userAgent" NOT ILIKE '%Bytespider%'
  AND s."userAgent" NOT ILIKE '%PetalBot%'
  AND s."userAgent" NOT ILIKE '%Amazonbot%'
  AND s."userAgent" NOT ILIKE '%facebookexternalhit%'
  AND s."userAgent" NOT ILIKE '%Twitterbot%'
  AND s."userAgent" NOT ILIKE '%WhatsApp%'
  AND s."userAgent" NOT ILIKE '%Discordbot%'
  AND s."userAgent" NOT ILIKE '%TelegramBot%'
  AND s."userAgent" NOT ILIKE '%DataForSeoBot%'
  AND s."userAgent" NOT ILIKE '%ClaudeBot%'
  AND s."userAgent" NOT ILIKE '%GPTBot%'
  AND s."userAgent" NOT ILIKE '%CCBot%'
`;

const DACH_SQL = Prisma.sql`AND s.country IN ('DE', 'AT', 'CH')`;

/**
 * Compute the Date object that corresponds to midnight in Europe/Berlin
 * for the given reference instant. Returns a UTC Date such that
 * result <= now and reflects the current Berlin calendar day boundary.
 */
function berlinMidnight(ref: Date): Date {
  // Format the instant in Berlin time, pick out Y/M/D, then parse back as a Berlin-local midnight.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ref);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  // Berlin offset from UTC for *this specific instant* — handles DST flip.
  const tzStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'shortOffset',
  })
    .formatToParts(ref)
    .find((p) => p.type === 'timeZoneName')!.value; // "GMT+2" or "GMT+1"
  const match = tzStr.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  const offsetH = match ? parseInt(match[1], 10) : 1;
  const offsetM = match && match[2] ? parseInt(match[2], 10) : 0;
  const offsetMs = (offsetH * 60 + Math.sign(offsetH) * offsetM) * 60 * 1000;
  // Midnight in Berlin = (YMD at 00:00 as if it were UTC) - offset
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)) - offsetMs);
}

// GET - Real-time analytics data
export async function GET() {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    // Day boundaries anchored to Europe/Berlin (DST-aware). The server runs in
    // UTC, so naive setHours(0,0,0,0) would cut the day 1–2h too late and push
    // early-morning Berlin traffic into "yesterday".
    const todayStart = berlinMidnight(now);
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

    // DACH SQL filter for raw queries — see BOT_FILTER_SQL comment for the
    // rationale. Using Prisma.sql lets us compose these into $queryRaw.

    // Mark old sessions as inactive
    await prisma.analytics_sessions.updateMany({
      where: {
        lastSeenAt: { lt: fiveMinutesAgo },
        isActive: true,
      },
      data: { isActive: false },
    });

    // Active users right now — sessions with recent heartbeat (last 5 min).
    // Previously we also required `totalDuration > 0 OR startedAt < 10s ago`,
    // but `totalDuration` is only filled on `page_exit` (beacon). A user who
    // landed 30s ago and is still reading has totalDuration=0, so that filter
    // dropped 90% of real live users after 10 seconds. Use pageViews instead —
    // it gets incremented on every tracked page_view, so any real session has
    // pageViews ≥ 1 from its first heartbeat.
    const activeUsers = await prisma.analytics_sessions.count({
      where: {
        isActive: true,
        ...notBot,
        pageViews: { gt: 0 },
      },
    });

    // Get active sessions with details — same relaxed filter as above
    const activeSessions = await prisma.analytics_sessions.findMany({
      where: {
        isActive: true,
        ...notBot,
        pageViews: { gt: 0 },
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
    const [pvLastHour] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${oneHourAgo}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
    `;
    const pageViewsLastHour = Number(pvLastHour?.count || 0);

    // Page views today (exclude bot sessions via JOIN + DACH only)
    const [pvToday] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
    `;
    const pageViewsToday = Number(pvToday?.count || 0);

    // Unique visitors today (exclude bots + DACH only)
    const uvToday = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT e."visitorId") as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
    `;
    const uniqueVisitorsTodayCount = Number(uvToday[0]?.count || 0);

    // Page views yesterday (exclude bots + DACH only)
    const [pvYesterday] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
    `;
    const pageViewsYesterday = Number(pvYesterday?.count || 0);

    // Bot filter SQL clause — centralized in BOT_FILTER_SQL (see top of file).

    // Top pages right now (exclude bots + DACH only)
    const topPagesNow = await prisma.$queryRaw<{ path: string; count: bigint }[]>`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${fiveMinutesAgo}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    `;

    // Top pages today (exclude bots + DACH only)
    const topPagesToday = await prisma.$queryRaw<{ path: string; count: bigint }[]>`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    `;

    // Traffic sources (exclude bots + DACH only)
    const trafficSources = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
      SELECT e.referrer as source, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${todayStart} AND e.referrer IS NOT NULL
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY e.referrer HAVING COUNT(*) >= 1 ORDER BY count DESC LIMIT 500
    `;

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

    // Page views per hour — today only (Berlin midnight → now), exclude bots.
    // Fix: previously used `NOW() - INTERVAL '24 hours'` (rolling 24h), which
    // did not align with `todayStart` used elsewhere → the hourly chart and
    // the "today" total could disagree by whole hours. Locked to the same
    // Berlin-midnight anchor now.
    const hourlyData = await prisma.$queryRaw<{ hour: Date; views: bigint }[]>`
      SELECT 
        DATE_TRUNC('hour', e."createdAt") as hour,
        COUNT(*) as views
      FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' 
        AND e."createdAt" >= ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY DATE_TRUNC('hour', e."createdAt")
      ORDER BY hour ASC
    `;

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

    // Average session duration today (exclude bots).
    // Filter `totalDuration > 0` so sessions that never fired a page_exit
    // beacon (ad-blockers, browser crashes, tab-close mid-navigation) don't
    // drag the average to zero.
    const avgDurationToday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: todayStart }, totalDuration: { gt: 0 }, ...notBot },
      _avg: { totalDuration: true },
    });
    const avgDurationYesterday = await prisma.analytics_sessions.aggregate({
      where: { startedAt: { gte: yesterdayStart, lt: todayStart }, totalDuration: { gt: 0 }, ...notBot },
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
    const uvYesterday = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT e."visitorId") as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
    `;
    const uniqueVisitorsYesterdayCount = Number(uvYesterday[0]?.count || 0);

    // Top pages yesterday (exclude bots + DACH only)
    const topPagesYesterday = await prisma.$queryRaw<{ path: string; count: bigint }[]>`
      SELECT e.path, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY e.path ORDER BY count DESC LIMIT 10
    `;

    // Traffic sources yesterday (exclude bots + DACH only)
    const trafficSourcesYesterday = await prisma.$queryRaw<{ source: string; count: bigint }[]>`
      SELECT e.referrer as source, COUNT(*) as count FROM analytics_events e
      JOIN analytics_sessions s ON e."sessionId" = s."sessionId"
      WHERE e.event = 'page_view' AND e."createdAt" >= ${yesterdayStart} AND e."createdAt" < ${todayStart}
        AND e.referrer IS NOT NULL
        ${DACH_SQL}
        ${BOT_FILTER_SQL}
      GROUP BY e.referrer HAVING COUNT(*) >= 1 ORDER BY count DESC LIMIT 500
    `;

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
