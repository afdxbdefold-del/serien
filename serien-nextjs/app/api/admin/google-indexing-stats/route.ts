/**
 * Admin "Google Indexing API" Observability widget data.
 *
 * GET  /api/admin/google-indexing-stats?days=7
 *   → success-rate / last-N calls / health-check
 * POST /api/admin/google-indexing-stats { url, slug }
 *   → ein Manual-Push (eventType='manual'), inkl. DB-Logging
 *
 * ⚠️ Indexing API garantiert KEIN Indexing — Google's Best-Effort-Crawler
 * verarbeitet die Notifications nur wenn das Quote-Budget reicht. News
 * Sitemap bleibt der primäre Discovery-Mechanismus.
 */
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { checkIndexingApiHealth, notifyGoogleIndexing } from '@/lib/google-indexing';

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

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const days = Math.max(1, Math.min(30, parseInt(req.nextUrl.searchParams.get('days') || '7', 10)));
  const since = new Date(Date.now() - days * 86400_000);
  const since24 = new Date(Date.now() - 24 * 3600_000);

  const [recent, total24, success24, lastSuccess, totalAll, totalSuccessAll, health] = await Promise.all([
    prisma.google_indexing_api_logs.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, articleId: true, url: true, eventType: true,
        responseStatus: true, success: true, errorMessage: true, createdAt: true,
      },
    }),
    prisma.google_indexing_api_logs.count({ where: { createdAt: { gte: since24 } } }),
    prisma.google_indexing_api_logs.count({ where: { createdAt: { gte: since24 }, success: true } }),
    prisma.google_indexing_api_logs.findFirst({
      where: { success: true },
      orderBy: { createdAt: 'desc' },
      select: { url: true, createdAt: true, responseStatus: true },
    }),
    prisma.google_indexing_api_logs.count({ where: { createdAt: { gte: since } } }),
    prisma.google_indexing_api_logs.count({ where: { createdAt: { gte: since }, success: true } }),
    checkIndexingApiHealth(),
  ]);

  // Top error reasons (last N days)
  const failed = await prisma.google_indexing_api_logs.findMany({
    where: { createdAt: { gte: since }, success: false },
    select: { errorMessage: true, responseStatus: true },
    take: 500,
  });
  const errorBuckets = new Map<string, number>();
  for (const f of failed) {
    const key = `${f.responseStatus ?? '-'}: ${(f.errorMessage || 'unknown').slice(0, 80)}`;
    errorBuckets.set(key, (errorBuckets.get(key) || 0) + 1);
  }
  const topErrors = Array.from(errorBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  return NextResponse.json({
    windowDays: days,
    health,
    successRate24h: total24 > 0 ? success24 / total24 : null,
    successRateWindow: totalAll > 0 ? totalSuccessAll / totalAll : null,
    totalCalls24h: total24,
    successCalls24h: success24,
    failedCalls24h: total24 - success24,
    totalCallsWindow: totalAll,
    lastSuccessfulCall: lastSuccess
      ? { url: lastSuccess.url, at: lastSuccess.createdAt.toISOString(), status: lastSuccess.responseStatus }
      : null,
    topErrors,
    recentCalls: recent.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
    })),
    warnings: [
      'Indexing API garantiert KEIN Indexing — Google entscheidet selbst.',
      'News Sitemap bleibt der primäre Discovery-Mechanismus für Googlebot.',
      'Diese Tools sind nur für Observability + optionalen Push-Versuch.',
    ],
  });
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { url?: string; slug?: string };
  try { body = await req.json(); } catch { body = {}; }

  let { url, slug } = body;
  let articleId: string | null = null;

  if (slug && !url) {
    const a = await prisma.articles.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!a) return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    articleId = a.id;
    const baseUrl = process.env.GOOGLE_INDEXING_BASE_URL || 'https://serien.de';
    url = `${baseUrl}/${a.slug}`;
  } else if (url) {
    const a = await prisma.articles.findFirst({
      where: { OR: [{ slug: url.replace(/^https?:\/\/[^/]+\//, '') }] },
      select: { id: true },
    });
    articleId = a?.id ?? null;
  }

  if (!url || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'Missing or invalid `url`/`slug`' }, { status: 400 });
  }

  const result = await notifyGoogleIndexing(url, 'URL_UPDATED', { articleId, eventType: 'manual' });
  return NextResponse.json({
    url,
    articleId,
    ...result,
  });
}
