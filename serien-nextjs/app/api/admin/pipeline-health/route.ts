/**
 * Pipeline Health API
 * GET /api/admin/pipeline-health?window=60  (minutes)
 *
 * Returns aggregate stats for the admin pipeline-health dashboard:
 *   - run totals by status + by failure step
 *   - classifier metrics: UNKNOWN rate, 403 safety-block count, avg duration
 *   - recent failures (last 15, with step + reason)
 *   - publish rate (articles/h over window)
 */
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';

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

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const windowMin = Math.max(5, Math.min(1440, Number(new URL(req.url).searchParams.get('window') || '60')));
  const since = new Date(Date.now() - windowMin * 60 * 1000);

  const runs = await prisma.pipeline_runs.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id: true,
      status: true,
      errorStep: true,
      errorMessage: true,
      inputQuery: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });

  // Aggregate
  const byStatus: Record<string, number> = {};
  const byFailStep: Record<string, number> = {};
  let safetyBlocks = 0;
  let heuristicRescues = 0;
  let unknownClassification = 0;
  let classifierDurations: number[] = [];

  // Duplicate-prevention breakdown (by fail-step label)
  const duplicatesByStage: Record<string, number> = {
    'url-duplicate': 0,
    'url-duplicate-race': 0,
    'duplicate-jaccard-title': 0,
    'duplicate-core-event': 0,
    'duplicate-fingerprint': 0,
    'duplicate-llm': 0,
  };

  // Relevance / availability filters (skipped BEFORE LLM spend)
  const relevanceByStage: Record<string, number> = {
    'dach-availability': 0,
    'genre-out-of-scope': 0,
    'blocklist-source': 0,
    'blocklist-tmdb': 0,
    'topic-age-check': 0,
  };

  function parseMeta(raw: unknown): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
    }
    return {};
  }

  for (const r of runs) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.status === 'failed' && r.errorStep) {
      byFailStep[r.errorStep] = (byFailStep[r.errorStep] || 0) + 1;
      if (r.errorStep in duplicatesByStage) {
        duplicatesByStage[r.errorStep]++;
      }
      if (r.errorStep in relevanceByStage) {
        relevanceByStage[r.errorStep]++;
      }
    }
    const meta = parseMeta(r.metadata);
    const reason = String((meta as any).classifierReasoning || '');
    const errMsg = r.errorMessage || '';
    const combined = `${reason} ${errMsg}`;
    if (/403|access_denied|safety/i.test(combined)) safetyBlocks++;
    if (reason.includes('HEURISTIC_AFTER_SAFETY_BLOCK') || /heuristic/i.test(reason)) heuristicRescues++;
    if (errMsg.includes('nicht relevant') || reason.includes('UNKNOWN')) unknownClassification++;
    if (typeof (meta as any).classifierDurationMs === 'number') {
      classifierDurations.push((meta as any).classifierDurationMs);
    }
  }

  // Publish rate from `articles` table within the same window
  const published = await prisma.articles.count({
    where: { status: 'published', publishedAt: { gte: since } },
  });
  const publishPerHour = Math.round((published * 60) / Math.max(1, windowMin));

  // Recent failures
  const recentFailures = runs
    .filter(r => r.status === 'failed')
    .slice(0, 15)
    .map((r) => {
      const meta = parseMeta(r.metadata);
      const reason = (meta as any).classifierReasoning;
      return {
        id: r.id,
        at: r.createdAt.toISOString(),
        step: r.errorStep || '?',
        message: r.errorMessage || '',
        classifierReasoning: reason ? String(reason).slice(0, 240) : null,
        title: (r.inputQuery || '').slice(0, 120),
      };
    });

  // Last published
  const lastPublished = await prisma.articles.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 10,
    select: { slug: true, title: true, publishedAt: true },
  });

  const successRatePct = runs.length ? Math.round(((byStatus.success || 0) / runs.length) * 100) : 0;
  const safetyRatePct = runs.length ? Math.round((safetyBlocks / runs.length) * 100) : 0;

  // Health indicator
  let health: 'ok' | 'warn' | 'critical' = 'ok';
  if (runs.length > 0) {
    if (safetyRatePct > 50 || successRatePct < 5) health = 'critical';
    else if (safetyRatePct > 20 || successRatePct < 20) health = 'warn';
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowMinutes: windowMin,
    health,
    totals: {
      runs: runs.length,
      byStatus,
      byFailStep,
      published,
      publishPerHour,
      successRatePct,
    },
    classifier: {
      unknownClassification,
      safetyBlocks,
      safetyRatePct,
      heuristicRescues,
    },
    duplicates: {
      total: Object.values(duplicatesByStage).reduce((s, v) => s + v, 0),
      byStage: duplicatesByStage,
    },
    relevance: {
      total: Object.values(relevanceByStage).reduce((s, v) => s + v, 0),
      byStage: relevanceByStage,
    },
    recentFailures,
    lastPublished: lastPublished.map(a => ({
      slug: a.slug,
      title: a.title,
      publishedAt: (a.publishedAt ?? new Date()).toISOString(),
    })),
  });
}
