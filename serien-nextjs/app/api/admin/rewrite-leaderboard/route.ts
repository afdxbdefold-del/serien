/**
 * Admin API: Top Headline Rewrites
 *
 * GET /api/admin/rewrite-leaderboard?limit=20&window=30
 *
 * Returns the highest Performance-score gains achieved by the rewrite loop,
 * so we can harvest them as prompt-engineering examples.
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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

export async function GET(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const windowDays = Math.min(parseInt(searchParams.get('window') || '30', 10), 365);

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Grab recent runs with a rewrite applied. JSON filtering is limited on
    // Prisma PG, so we pull candidates and filter in JS — bounded by time window.
    const runs = await prisma.pipeline_runs.findMany({
      where: {
        startedAt: { gte: since },
        metadata: { not: null as any },
      },
      orderBy: { startedAt: 'desc' },
      select: { articleId: true, metadata: true, startedAt: true },
      take: 2000,
    });

    type Entry = {
      articleId: string | null;
      startedAt: string;
      before: number;
      after: number;
      gain: number;
      originalHeadline: string;
      finalHeadline: string;
      durationMs: number;
      article: { title: string; slug: string; publishMode: string } | null;
    };

    const entries: Entry[] = [];
    for (const r of runs) {
      const rw = (r.metadata as any)?.headlineRewrite;
      if (!rw?.applied) continue;
      entries.push({
        articleId: r.articleId,
        startedAt: r.startedAt.toISOString(),
        before: Number(rw.beforePerformance) || 0,
        after: Number(rw.afterPerformance) || 0,
        gain: Number(rw.gain) || 0,
        originalHeadline: String(rw.originalHeadline || ''),
        finalHeadline: String(rw.finalHeadline || ''),
        durationMs: Number(rw.durationMs) || 0,
        article: null,
      });
    }

    // Top N by gain
    entries.sort((a, b) => b.gain - a.gain);
    const top = entries.slice(0, limit);

    // Hydrate article info in one batch
    const articleIds = top.map((e) => e.articleId).filter((x): x is string => !!x);
    if (articleIds.length > 0) {
      const articles = await prisma.articles.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, slug: true, publishMode: true },
      });
      const aMap = new Map(articles.map((a) => [a.id, a]));
      for (const e of top) {
        if (e.articleId) {
          const a = aMap.get(e.articleId);
          if (a) e.article = { title: a.title, slug: a.slug, publishMode: a.publishMode || 'DRAFT' };
        }
      }
    }

    // Aggregate for header
    const totalApplied = entries.length;
    const avgGain = entries.length > 0 ? entries.reduce((s, e) => s + e.gain, 0) / entries.length : 0;
    const maxGain = entries.length > 0 ? Math.max(...entries.map((e) => e.gain)) : 0;

    return NextResponse.json({
      windowDays,
      totalApplied,
      avgGain: Number(avgGain.toFixed(1)),
      maxGain,
      top,
    });
  } catch (error: any) {
    console.error('Rewrite leaderboard error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
