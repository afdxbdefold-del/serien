/**
 * BACKFILL STREAMING-RELEASES → SERIES CRON
 *
 * Problem this solves: `/api/cron/releases` writes raw TMDB-IDs into
 * `streaming_releases` *before* a `series` row exists for them. The
 * `/neue-serien` aggregator then silently drops them (otherwise it would
 * produce dead `/serie/[slug]` 404 links — see app/neue-serien/page.tsx).
 *
 * This cron walks every distinct orphan tmdbId in `streaming_releases`
 * and tries to materialise it via `importSeriesById()` (full TMDB pull
 * incl. networks, cast, posters, episodes). Successful imports get a
 * proper slug + Latin display title and reappear on /neue-serien on the
 * next ISR cycle.
 *
 * Caps:
 *   - MAX_PER_RUN = 25 — keep us comfortably under Vercel's 300s budget
 *     (each importSeriesById = 1 TMDB-complete + 1 backdrops + 1 insert).
 *
 * Schedule: every 30min via vercel.json (releases cron is 15min, so we
 * always have fresh data to consume).
 *
 * GET /api/cron/backfill-streaming-series?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { importSeriesById } from '@/lib/tmdb-resolver';

const prisma = new PrismaClient();

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_PER_RUN = 25;

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (request.headers.get('x-vercel-cron')) return true;
  const secret = request.nextUrl.searchParams.get('secret');
  return Boolean(secret && secret === process.env.CRON_SECRET);
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.TMDB_API_KEY) {
    return NextResponse.json({ error: 'TMDB_API_KEY not set' }, { status: 500 });
  }

  try {
    // 1. Find tmdbIds in streaming_releases that have NO series row at all
    //    OR have a series row but no usable slug. Limit to releases within
    //    the last 120 days so we don't keep retrying long-dead orphans
    //    forever.
    const cutoff = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);

    const orphanIds: Array<{ tmdbId: number }> = await prisma.$queryRaw`
      SELECT DISTINCT sr."tmdbId"
      FROM streaming_releases sr
      LEFT JOIN series s ON s."tmdbId" = sr."tmdbId"
      WHERE sr.date >= ${cutoff}
        AND (s."tmdbId" IS NULL OR s.slug IS NULL OR s.slug = '')
      ORDER BY sr."tmdbId" DESC
      LIMIT ${MAX_PER_RUN}
    `;

    console.log(`[CRON backfill-streaming-series] ${orphanIds.length} orphan tmdbIds to process`);

    let imported = 0;
    let failed = 0;
    const importedNames: string[] = [];
    const failures: Array<{ tmdbId: number; reason: string }> = [];

    for (const { tmdbId } of orphanIds) {
      try {
        const result = await importSeriesById(tmdbId, 'de-DE');
        if (!result) {
          failed++;
          failures.push({ tmdbId, reason: 'tmdb_fetch_returned_null' });
          continue;
        }
        if (!result.alreadyInDb) {
          imported++;
          importedNames.push(result.name);
          console.log(`[CRON backfill] ✅ Imported ${result.name} (tmdb:${tmdbId})`);
        }
      } catch (e) {
        failed++;
        const reason = (e as Error).message;
        failures.push({ tmdbId, reason });
        console.error(`[CRON backfill] ❌ tmdb:${tmdbId}:`, reason);
      }
    }

    const duration = Date.now() - startTime;

    // Best-effort: refresh the /neue-serien ISR so users see the
    // newly-imported releases immediately on the next request.
    if (imported > 0) {
      try { revalidatePath('/neue-serien'); } catch { /* ignore */ }
    }

    await prisma.pipeline_runs.create({
      data: {
        id: `cron-backfill-streaming-series-${Date.now()}`,
        pipeline: 'cron-backfill-streaming-series',
        trigger: 'cron',
        status: failed > imported ? 'partial' : 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        metadata: JSON.stringify({
          checked: orphanIds.length,
          imported,
          failed,
          duration,
          importedNames: importedNames.slice(0, 30),
          failures: failures.slice(0, 10),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      checked: orphanIds.length,
      imported,
      failed,
      duration_ms: duration,
      importedNames,
    });
  } catch (error) {
    console.error('[CRON backfill-streaming-series] fatal:', (error as Error).message);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
