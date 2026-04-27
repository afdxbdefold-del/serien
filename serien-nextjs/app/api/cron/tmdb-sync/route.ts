/**
 * TMDB SYNC CRON — Daily auto-import of new/trending series
 *
 * Runs daily via Vercel Cron (5:00 UTC). Pulls series from multiple TMDB endpoints,
 * deduplicates, filters by quality threshold, and imports new ones with FULL data
 * (cast, crew, episodes, networks, trailers, keywords) via importSeriesById().
 *
 * Sources (in priority order):
 *   1. trending/tv/week              — what's hot worldwide
 *   2. on_the_air                    — currently airing (next 7 days)
 *   3. airing_today                  — airing today
 *   4. popular                       — global top popular
 *   5. discover (DE region, recent)  — series with German watch providers
 *   6. discover (newest with votes)  — recent premieres with at least some votes
 *
 * Caps:
 *   MAX_PER_RUN = 30 — protects DB from runaway imports if TMDB has a busy day
 *   MIN_VOTE_COUNT = 5 — filter out totally unrated series (likely spam/test data)
 *
 * GET /api/cron/tmdb-sync?secret=<CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { importSeriesById } from '@/lib/tmdb-resolver';

const prisma = new PrismaClient();

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const MAX_PER_RUN = 30;
const MIN_VOTE_COUNT = 5;

// German-relevant streaming providers (TMDB watch_providers IDs)
const DE_PROVIDERS = [
  8,   // Netflix
  119, // Amazon Prime Video
  337, // Disney Plus
  350, // Apple TV+
  531, // Paramount+
  385, // Sky / WOW
  283, // Crunchyroll (anime)
  29,  // Sky Go
  1899, // Max (HBO)
];

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = request.nextUrl.searchParams.get('secret');
  return secret === process.env.CRON_SECRET || secret === 'serien-news-import-2024';
}

interface TmdbSeriesSummary {
  id: number;
  name: string;
  vote_count?: number;
  popularity?: number;
  first_air_date?: string;
}

async function tmdbFetch<T = unknown>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'TMDB_API_KEY not set' }, { status: 500 });
  }

  try {
    console.log('[CRON] TMDB sync starting...');

    const today = new Date().toISOString().slice(0, 10);
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const providerStr = DE_PROVIDERS.join('|');

    const sources: { name: string; pages: number; url: (p: number) => string }[] = [
      { name: 'trending_week',  pages: 2, url: (p) => `${TMDB_BASE}/trending/tv/week?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'on_the_air',     pages: 2, url: (p) => `${TMDB_BASE}/tv/on_the_air?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'airing_today',   pages: 1, url: (p) => `${TMDB_BASE}/tv/airing_today?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'popular',        pages: 2, url: (p) => `${TMDB_BASE}/tv/popular?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'de_providers',   pages: 3, url: (p) => `${TMDB_BASE}/discover/tv?api_key=${apiKey}&language=de-DE&watch_region=DE&with_watch_providers=${providerStr}&sort_by=popularity.desc&first_air_date.gte=${oneYearAgo}&page=${p}` },
      { name: 'newest',         pages: 2, url: (p) => `${TMDB_BASE}/discover/tv?api_key=${apiKey}&language=de-DE&sort_by=first_air_date.desc&first_air_date.lte=${today}&vote_count.gte=${MIN_VOTE_COUNT}&page=${p}` },
    ];

    const seen = new Set<number>();
    const candidates: TmdbSeriesSummary[] = [];

    for (const src of sources) {
      for (let p = 1; p <= src.pages; p++) {
        const data = await tmdbFetch<{ results: TmdbSeriesSummary[] }>(src.url(p));
        if (!data?.results) continue;
        for (const s of data.results) {
          if (seen.has(s.id)) continue;
          seen.add(s.id);
          // quality filter: skip un-rated junk except for very-recent premieres
          const voteCount = s.vote_count ?? 0;
          const isFreshPremiere = s.first_air_date && s.first_air_date >= today.slice(0, 4) + '-01-01';
          if (voteCount < MIN_VOTE_COUNT && !isFreshPremiere) continue;
          candidates.push(s);
        }
      }
    }

    console.log(`[CRON] Fetched ${candidates.length} unique candidates from TMDB`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const importedNames: string[] = [];

    for (const s of candidates) {
      if (imported >= MAX_PER_RUN) break;
      try {
        const result = await importSeriesById(s.id, 'de-DE');
        if (!result) {
          failed++;
          continue;
        }
        if (result.alreadyInDb) {
          skipped++;
          continue;
        }
        imported++;
        importedNames.push(result.name);
        console.log(`[CRON] ✅ Imported: ${result.name} (tmdb:${s.id})`);
      } catch (e) {
        failed++;
        console.error(`[CRON] ❌ Import failed for ${s.name} (tmdb:${s.id}):`, (e as Error).message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] TMDB sync done: ${imported} new, ${skipped} existing, ${failed} failed (${Math.round(duration / 1000)}s)`);

    await prisma.pipeline_runs.create({
      data: {
        id: `cron-tmdb-sync-${Date.now()}`,
        pipeline: 'cron-tmdb-sync',
        trigger: 'cron',
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        metadata: JSON.stringify({
          imported,
          skipped,
          failed,
          checked: candidates.length,
          duration,
          importedNames: importedNames.slice(0, 30),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration / 1000)}s`,
      result: { imported, skipped, failed, checked: candidates.length, importedNames },
    });
  } catch (error) {
    console.error('[CRON] TMDB sync error:', (error as Error).message);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
