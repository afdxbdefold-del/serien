/**
 * Referrer detail drill-down for the live analytics dashboard.
 * Given a referrer hostname/string, returns:
 *   - exact referrer URLs seen today
 *   - sessions from that referrer (visitor, country, device, timing)
 *   - which article pages were viewed from those sessions
 *
 * GET /api/admin/analytics/referrer-detail?source=google.com&day=today
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

async function authorize(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(auth.slice(7), secret);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get('source') || '';
  const day = req.nextUrl.searchParams.get('day') || 'today';

  if (!source) {
    return NextResponse.json({ error: 'Missing source parameter' }, { status: 400 });
  }

  const now = new Date();
  const dayStart = startOfDay(now);
  const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000);
  const from = day === 'yesterday' ? yesterdayStart : dayStart;
  const to = day === 'yesterday' ? dayStart : now;

  // Match sessions where sourceName OR referrer contains the source string
  // (source can be "google.com" / "https://t.co" / "Direct" / "Andere")
  const isDirect = source === 'Direct' || source === 'Direkt';
  const whereSession: any = {
    startedAt: { gte: from, lt: to },
  };
  if (isDirect) {
    whereSession.OR = [
      { referrer: null },
      { referrer: '' },
    ];
  } else {
    whereSession.referrer = { contains: source, mode: 'insensitive' };
  }

  const sessions = await prisma.analytics_sessions.findMany({
    where: whereSession,
    orderBy: { startedAt: 'desc' },
    take: 200,
    select: {
      sessionId: true,
      visitorId: true,
      startedAt: true,
      lastSeenAt: true,
      pageViews: true,
      entryPage: true,
      exitPage: true,
      referrer: true,
      country: true,
      device: true,
      browser: true,
      isBounce: true,
      totalDuration: true,
      avgScrollDepth: true,
    },
  });

  // Aggregate distinct referrers (+ count)
  const referrerCounts = new Map<string, number>();
  for (const s of sessions) {
    const r = s.referrer || '(Direct)';
    referrerCounts.set(r, (referrerCounts.get(r) || 0) + 1);
  }
  const distinctReferrers = [...referrerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([url, count]) => ({ url, count }));

  // Fetch page-view events from these sessions (shows which articles they visited)
  const sessionIds = sessions.map(s => s.sessionId);
  const events = sessionIds.length
    ? await prisma.analytics_events.findMany({
        where: {
          sessionId: { in: sessionIds },
          event: 'page_view',
        },
        orderBy: { createdAt: 'asc' },
        select: {
          sessionId: true,
          path: true,
          createdAt: true,
          articleId: true,
        },
      })
    : [];

  // Group pages by path with view counts
  const pageCounts = new Map<string, number>();
  for (const e of events) {
    pageCounts.set(e.path, (pageCounts.get(e.path) || 0) + 1);
  }
  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([path, count]) => ({ path, count }));

  // Build per-session page sequence (limited)
  const sessionPages = new Map<string, string[]>();
  for (const e of events) {
    const list = sessionPages.get(e.sessionId) || [];
    if (list.length < 10) list.push(e.path);
    sessionPages.set(e.sessionId, list);
  }

  // Fetch article titles for any paths in the topPages list that look like article slugs
  const articleSlugs = topPages
    .map(p => p.path.startsWith('/') ? p.path.slice(1) : p.path)
    .filter(s => s && !s.startsWith('admin') && !s.includes('/') && s.length > 0);
  const articles = articleSlugs.length
    ? await prisma.articles.findMany({
        where: { slug: { in: articleSlugs } },
        select: { slug: true, title: true, primarySeriesId: true },
      })
    : [];
  const articleBySlug = new Map(articles.map(a => [a.slug, a]));

  const topPagesWithTitle = topPages.map(p => {
    const slug = p.path.startsWith('/') ? p.path.slice(1) : p.path;
    const article = articleBySlug.get(slug);
    return {
      path: p.path,
      count: p.count,
      title: article?.title || null,
    };
  });

  return NextResponse.json({
    source,
    day,
    rangeFrom: from.toISOString(),
    rangeTo: to.toISOString(),
    totals: {
      sessions: sessions.length,
      distinctVisitors: new Set(sessions.map(s => s.visitorId)).size,
      pageViews: events.length,
      bounceRate: sessions.length
        ? Math.round((sessions.filter(s => s.isBounce).length / sessions.length) * 100)
        : 0,
    },
    distinctReferrers,
    topPages: topPagesWithTitle,
    sessions: sessions.slice(0, 50).map(s => ({
      sessionId: s.sessionId,
      visitorId: s.visitorId.slice(0, 8),
      startedAt: s.startedAt.toISOString(),
      duration: s.totalDuration ?? null,
      pageViews: s.pageViews,
      referrer: s.referrer || '(Direct)',
      entryPage: s.entryPage,
      exitPage: s.exitPage,
      country: s.country,
      device: s.device,
      browser: s.browser,
      isBounce: s.isBounce,
      pageSequence: sessionPages.get(s.sessionId) || [],
    })),
  });
}
