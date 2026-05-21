/**
 * Admin "Hallucination Watch" widget data.
 * GET /api/admin/hallucination-watch
 *
 * Returns recent body-fact-verifier rejections so editors can see which
 * source URLs systematically hallucinate German streaming availability.
 *
 * Stats:
 *  - totals (24h / 7d) broken down by kind
 *  - top offending sourceHosts (which sites lie the most)
 *  - last 30 individual rejections (with excerpt + claimed/actual streamer)
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

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total24h, total7d, byKind24h, topHosts, recent] = await Promise.all([
    prisma.hallucination_log.count({ where: { createdAt: { gte: day } } }),
    prisma.hallucination_log.count({ where: { createdAt: { gte: week } } }),
    prisma.hallucination_log.groupBy({
      by: ['kind'],
      where: { createdAt: { gte: day } },
      _count: { kind: true },
    }),
    prisma.hallucination_log.groupBy({
      by: ['sourceHost'],
      where: { createdAt: { gte: week }, sourceHost: { not: null } },
      _count: { sourceHost: true },
      orderBy: { _count: { sourceHost: 'desc' } },
      take: 8,
    }),
    prisma.hallucination_log.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        articleId: true,
        articleTitle: true,
        sourceUrl: true,
        sourceHost: true,
        kind: true,
        claimedStreamer: true,
        actualDeProviders: true,
        excerpt: true,
        createdAt: true,
      },
    }),
  ]);

  const kindBreakdown = byKind24h.reduce<Record<string, number>>((acc, r) => {
    acc[r.kind] = r._count.kind;
    return acc;
  }, {});

  return NextResponse.json({
    generatedAt: now.toISOString(),
    totals: {
      last24h: total24h,
      last7d: total7d,
      byKind24h: kindBreakdown,
    },
    topHosts: topHosts.map(h => ({ host: h.sourceHost, count: h._count.sourceHost })),
    recent: recent.map(r => ({
      id: r.id,
      articleId: r.articleId,
      articleTitle: r.articleTitle,
      sourceUrl: r.sourceUrl,
      sourceHost: r.sourceHost,
      kind: r.kind,
      claimedStreamer: r.claimedStreamer,
      actualDeProviders: r.actualDeProviders,
      excerpt: r.excerpt,
      at: r.createdAt.toISOString(),
    })),
  });
}
