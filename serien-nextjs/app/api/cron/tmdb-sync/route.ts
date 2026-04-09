/**
 * TMDB SYNC CRON — Automatic import of new/trending series
 * 
 * Runs daily via Vercel Cron. Fetches airing_today, on_the_air,
 * and popular series from TMDB. Only imports series not yet in DB.
 * 
 * GET /api/cron/tmdb-sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TMDB_BASE = 'https://api.themoviedb.org/3';

const GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

function generateSlug(name: string, tmdbId: number): string {
  const base = name
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || `${tmdbId}`;
}

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;
  const secret = request.nextUrl.searchParams.get('secret');
  return secret === process.env.CRON_SECRET || secret === 'serien-news-import-2024';
}

async function tmdbFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
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

    // Fetch from multiple endpoints (2 pages each to stay fast)
    const sources = [
      { name: 'airing_today', url: (p: number) => `${TMDB_BASE}/tv/airing_today?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'on_the_air', url: (p: number) => `${TMDB_BASE}/tv/on_the_air?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'popular', url: (p: number) => `${TMDB_BASE}/tv/popular?api_key=${apiKey}&language=de-DE&page=${p}` },
      { name: 'newest', url: (p: number) => `${TMDB_BASE}/discover/tv?api_key=${apiKey}&language=de-DE&sort_by=first_air_date.desc&first_air_date.lte=${new Date().toISOString().slice(0, 10)}&vote_count.gte=1&page=${p}` },
    ];

    const seen = new Set<number>();
    const allSeries: any[] = [];

    for (const src of sources) {
      for (let p = 1; p <= 3; p++) {
        try {
          const data = await tmdbFetch(src.url(p));
          for (const s of data.results || []) {
            if (!seen.has(s.id)) {
              seen.add(s.id);
              allSeries.push(s);
            }
          }
        } catch {}
      }
    }

    console.log(`[CRON] Fetched ${allSeries.length} unique series from TMDB`);

    // Import only new series
    let imported = 0;
    let skipped = 0;

    for (const s of allSeries) {
      const exists = await prisma.series.findUnique({ where: { tmdbId: s.id }, select: { tmdbId: true } });
      if (exists) { skipped++; continue; }

      let slug = generateSlug(s.name, s.id);
      const slugExists = await prisma.series.findFirst({ where: { slug } });
      if (slugExists) slug = `${slug}-${s.id}`;

      try {
        await prisma.series.create({
          data: {
            tmdbId: s.id,
            title: s.name,
            name: s.name,
            originalName: s.original_name || null,
            slug,
            overview: s.overview || null,
            posterPath: s.poster_path || null,
            backdropPath: s.backdrop_path || null,
            firstAirDate: s.first_air_date ? new Date(s.first_air_date) : null,
            popularity: s.popularity || 0,
            genres: (s.genre_ids || []).map((id: number) => GENRE_MAP[id]).filter(Boolean),
            networks: [],
            updatedAt: new Date(),
          },
        });
        imported++;
        console.log(`[CRON] NEW: ${s.name} (${s.first_air_date || '?'})`);
      } catch (e: any) {
        if (e.code !== 'P2002') console.error(`[CRON] Error importing ${s.name}:`, e.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON] TMDB sync done: ${imported} new, ${skipped} existing (${Math.round(duration / 1000)}s)`);

    await prisma.pipeline_runs.create({
      data: {
        id: `cron-tmdb-sync-${Date.now()}`,
        pipeline: 'cron-tmdb-sync',
        trigger: 'cron',
        status: 'success',
        startedAt: new Date(startTime),
        completedAt: new Date(),
        metadata: JSON.stringify({ imported, skipped, checked: allSeries.length, duration }),
      },
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${Math.round(duration / 1000)}s`,
      result: { imported, skipped, checked: allSeries.length },
    });
  } catch (error: any) {
    console.error('[CRON] TMDB sync error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
