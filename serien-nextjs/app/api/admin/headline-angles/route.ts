/**
 * HEADLINE ANGLES ANALYTICS API
 *
 * Classifies the last N published headlines into one of the 9 Discover
 * angles and joins with analytics_events to aggregate impressions /
 * clicks per angle. Powers /admin/headline-angles.
 *
 * GET /api/admin/headline-angles?days=14&minArticles=3
 *   Authorization: Bearer <admin-token>
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { detectAngleFromHeadline } from '@/lib/angle-detector';
import { ANGLE_META, type HeadlineAngle } from '@/lib/headline-patterns';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const { payload } = await jwtVerify(auth.substring(7), JWT_SECRET);
    return payload.role === 'admin';
  } catch { return false; }
}

type AngleBucket =
  | HeadlineAngle
  | 'unknown';

interface AggregateRow {
  angle: AngleBucket;
  label: string;
  articles: number;
  totalViews: number;
  avgViewsPerArticle: number;
  avgScrollDepth: number | null;
  avgDurationSec: number | null;
  shareOfArticles: number;       // % of total articles this angle represents
  shareOfTraffic: number;        // % of total views this angle represents
  efficiency: number;            // shareOfTraffic / shareOfArticles — >1 = over-performing
  topArticles: Array<{ id: string; slug: string; title: string; views: number; publishedAt: string }>;
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const days        = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || '14')));
  const minArticles = Math.max(1, Number(url.searchParams.get('minArticles') || '1'));
  const since       = new Date(Date.now() - days * 24 * 3600 * 1000);

  // 1) Load articles in window — title + id + slug + publishedAt
  const articles = await prisma.articles.findMany({
    where: { publishedAt: { gte: since }, status: 'published' },
    select: { id: true, slug: true, title: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  if (articles.length === 0) {
    return NextResponse.json({
      days, minArticles, windowStart: since.toISOString(),
      totalArticles: 0, totalViews: 0,
      buckets: [], samples: [],
    });
  }

  // 2) Classify each article by angle
  const classified = articles.map(a => {
    const det = detectAngleFromHeadline(a.title || '');
    return { ...a, angle: det.angle as AngleBucket, confidence: det.confidence };
  });

  // 3) Aggregate pageviews per article — join analytics_events
  const articleIds = classified.map(a => a.id);
  const views = await prisma.analytics_events.groupBy({
    by: ['articleId'],
    where: {
      articleId: { in: articleIds },
      event: 'pageview',
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });
  const viewMap = new Map<string, number>();
  for (const v of views) if (v.articleId) viewMap.set(v.articleId, v._count._all);

  // 3b) Average scrollDepth + duration per article (from events where those fields exist)
  const engagement = await prisma.analytics_events.groupBy({
    by: ['articleId'],
    where: {
      articleId: { in: articleIds },
      createdAt: { gte: since },
      scrollDepth: { not: null },
    },
    _avg: { scrollDepth: true, duration: true },
  });
  const engMap = new Map<string, { scroll: number | null; dur: number | null }>();
  for (const e of engagement) if (e.articleId) engMap.set(e.articleId, { scroll: e._avg.scrollDepth, dur: e._avg.duration });

  // 4) Group by angle
  const byAngle = new Map<AngleBucket, {
    articles: typeof classified;
    totalViews: number;
    scrollSum: number; scrollCount: number;
    durSum: number; durCount: number;
  }>();
  for (const a of classified) {
    if (!byAngle.has(a.angle)) {
      byAngle.set(a.angle, { articles: [], totalViews: 0, scrollSum: 0, scrollCount: 0, durSum: 0, durCount: 0 });
    }
    const bucket = byAngle.get(a.angle)!;
    bucket.articles.push(a);
    const v = viewMap.get(a.id) || 0;
    bucket.totalViews += v;
    const eng = engMap.get(a.id);
    if (eng?.scroll != null) { bucket.scrollSum += eng.scroll; bucket.scrollCount++; }
    if (eng?.dur != null)    { bucket.durSum    += eng.dur;    bucket.durCount++;    }
  }

  const totalArticles = classified.length;
  const totalViews = Array.from(viewMap.values()).reduce((s, v) => s + v, 0);

  const ANGLE_LABEL: Record<AngleBucket, string> = {
    success:         ANGLE_META.success.label,
    comeback:        ANGLE_META.comeback.label,
    season_update:   ANGLE_META.season_update.label,
    quality_praise:  ANGLE_META.quality_praise.label,
    star_power:      ANGLE_META.star_power.label,
    underrated:      ANGLE_META.underrated.label,
    controversy:     ANGLE_META.controversy.label,
    trend_momentum:  ANGLE_META.trend_momentum.label,
    nostalgia:       ANGLE_META.nostalgia.label,
    unknown:         'Unbekannt / Kein Match',
  };

  const buckets: AggregateRow[] = [];
  for (const [angle, b] of byAngle.entries()) {
    if (b.articles.length < minArticles) continue;
    const shareOfArticles = totalArticles > 0 ? (b.articles.length / totalArticles) * 100 : 0;
    const shareOfTraffic  = totalViews    > 0 ? (b.totalViews    / totalViews)    * 100 : 0;
    const top = [...b.articles]
      .sort((x, y) => (viewMap.get(y.id) || 0) - (viewMap.get(x.id) || 0))
      .slice(0, 5)
      .map(a => ({
        id: a.id, slug: a.slug, title: a.title || '',
        views: viewMap.get(a.id) || 0,
        publishedAt: a.publishedAt?.toISOString() || '',
      }));

    buckets.push({
      angle, label: ANGLE_LABEL[angle],
      articles: b.articles.length,
      totalViews: b.totalViews,
      avgViewsPerArticle: b.articles.length > 0 ? Number((b.totalViews / b.articles.length).toFixed(1)) : 0,
      avgScrollDepth: b.scrollCount > 0 ? Math.round(b.scrollSum / b.scrollCount) : null,
      avgDurationSec: b.durCount   > 0 ? Math.round(b.durSum    / b.durCount)    : null,
      shareOfArticles: Number(shareOfArticles.toFixed(1)),
      shareOfTraffic:  Number(shareOfTraffic.toFixed(1)),
      efficiency:      shareOfArticles > 0 ? Number((shareOfTraffic / shareOfArticles).toFixed(2)) : 0,
      topArticles: top,
    });
  }

  buckets.sort((a, b) => b.totalViews - a.totalViews);

  // 5) Recent sample (latest 15 headlines with their detected angle)
  const samples = classified.slice(0, 15).map(a => ({
    id: a.id, slug: a.slug, title: a.title || '',
    angle: a.angle, confidence: a.confidence,
    views: viewMap.get(a.id) || 0,
    publishedAt: a.publishedAt?.toISOString() || '',
  }));

  return NextResponse.json({
    days,
    minArticles,
    windowStart: since.toISOString(),
    totalArticles,
    totalViews,
    buckets,
    samples,
  });
}
