/**
 * Admin "Sitemap Health" widget data.
 * GET /api/admin/sitemap-health
 *
 * Returns:
 *  - newestArticle: timestamp of most recent DISCOVER-published article
 *  - lastGooglebotHit: most recent Googlebot hit on /news-sitemap.xml
 *  - staleDeltaMinutes: minutes between newestArticle and lastGooglebotHit
 *      (negative/0 = Googlebot already saw the latest article)
 *  - hitsLast24h / hitsLast7d: Googlebot hit counts on the sitemap
 *  - avgIntervalMinutes: average gap between consecutive Googlebot hits
 *  - recentHits: last 50 Googlebot hits (bot, at)
 *  - recentPrewarms: last 20 sitemap_prewarm_log rows with success/status/duration
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const dynamic = 'force-dynamic';

const SITEMAP_PATH = '/news-sitemap.xml';
const GOOGLEBOTS = ['Googlebot', 'Googlebot-Smartphone', 'Googlebot-News'];

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

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [newestArticleRow, lastHitRow, hits24hCount, hits7dCount, recentHits, recentPrewarms, intervalHits] =
    await Promise.all([
      prisma.articles.findFirst({
        where: {
          status: 'published',
          publishMode: 'DISCOVER',
          isRankingArticle: { not: true },
          OR: [{ category: { not: 'neue-videos' } }, { category: null }],
        },
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true, publishedAt: true },
      }),
      prisma.crawler_hits.findFirst({
        where: { path: SITEMAP_PATH, bot: { in: GOOGLEBOTS } },
        orderBy: { createdAt: 'desc' },
        select: { bot: true, createdAt: true },
      }),
      prisma.crawler_hits.count({
        where: {
          path: SITEMAP_PATH,
          bot: { in: GOOGLEBOTS },
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.crawler_hits.count({
        where: {
          path: SITEMAP_PATH,
          bot: { in: GOOGLEBOTS },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.crawler_hits.findMany({
        where: { path: SITEMAP_PATH, bot: { in: GOOGLEBOTS } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { bot: true, createdAt: true, ip: true },
      }),
      prisma.sitemap_prewarm_log.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          articleSlug: true,
          success: true,
          statusCode: true,
          errorMessage: true,
          durationMs: true,
          createdAt: true,
        },
      }),
      prisma.crawler_hits.findMany({
        where: {
          path: SITEMAP_PATH,
          bot: { in: GOOGLEBOTS },
          createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

  // Compute average interval between consecutive hits (last 7 days).
  let avgIntervalMinutes: number | null = null;
  if (intervalHits.length >= 2) {
    const times = intervalHits.map((h) => h.createdAt.getTime());
    const diffs: number[] = [];
    for (let i = 0; i < times.length - 1; i++) diffs.push(times[i] - times[i + 1]);
    avgIntervalMinutes = Math.round(
      diffs.reduce((a, b) => a + b, 0) / diffs.length / 60_000,
    );
  }

  // Staleness: if Googlebot's latest hit is older than the newest article,
  // the sitemap it fetched did NOT contain that article yet.
  let staleDeltaMinutes: number | null = null;
  if (newestArticleRow?.publishedAt && lastHitRow?.createdAt) {
    staleDeltaMinutes = Math.round(
      (newestArticleRow.publishedAt.getTime() - lastHitRow.createdAt.getTime()) / 60_000,
    );
  }

  // Prewarm health summary over last 24h.
  const prewarms24h = await prisma.sitemap_prewarm_log.findMany({
    where: { createdAt: { gte: twentyFourHoursAgo } },
    select: { success: true },
  });
  const prewarmSuccess24h = prewarms24h.filter((p) => p.success).length;
  const prewarmFail24h = prewarms24h.length - prewarmSuccess24h;

  return NextResponse.json({
    generatedAt: now.toISOString(),
    newestArticle: newestArticleRow
      ? {
          slug: newestArticleRow.slug,
          title: newestArticleRow.title,
          publishedAt: newestArticleRow.publishedAt?.toISOString() ?? null,
        }
      : null,
    lastGooglebotHit: lastHitRow
      ? { bot: lastHitRow.bot, at: lastHitRow.createdAt.toISOString() }
      : null,
    staleDeltaMinutes,
    hitsLast24h: hits24hCount,
    hitsLast7d: hits7dCount,
    avgIntervalMinutes,
    prewarm24h: {
      total: prewarms24h.length,
      success: prewarmSuccess24h,
      failed: prewarmFail24h,
    },
    recentHits: recentHits.map((h) => ({
      bot: h.bot,
      at: h.createdAt.toISOString(),
      ip: h.ip,
    })),
    recentPrewarms: recentPrewarms.map((p) => ({
      articleSlug: p.articleSlug,
      success: p.success,
      statusCode: p.statusCode,
      errorMessage: p.errorMessage,
      durationMs: p.durationMs,
      at: p.createdAt.toISOString(),
    })),
  });
}
