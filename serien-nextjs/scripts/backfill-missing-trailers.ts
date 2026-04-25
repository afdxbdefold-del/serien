/**
 * Trailer Backfill Script
 * 
 * Picks top-N series WITHOUT a usable localTrailerPath (NULL) ranked by
 * the number of published articles referencing that series. Tries to
 * download a German or English official trailer to R2 via the existing
 * yt-dlp pipeline (lib/trailer-downloader.ts) and updates
 * series.localTrailerPath. The frontend already falls back to that field
 * when the article itself has no heroVideoUrl.
 *
 * Usage: npx tsx scripts/backfill-missing-trailers.ts [--limit=150] [--reset-skip]
 */

import prisma from '../lib/prisma';
import { downloadYouTubeTrailer, searchYouTubeTrailerViaAPI } from '../lib/trailer-downloader';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 150);
const resetSkip = args.includes('--reset-skip');

interface TrailerInfo {
  key: string;
  site: string;
  type: string;
  name?: string;
  iso_639_1?: string;
}

async function fetchTrailersFromTMDB(tmdbId: number): Promise<TrailerInfo[]> {
  if (!TMDB_API_KEY) return [];
  try {
    for (const lang of ['de-DE', 'en-US'] as const) {
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/videos?api_key=${TMDB_API_KEY}&language=${lang}`,
      );
      if (!res.ok) continue;
      const data = await res.json();
      const list = (data.results || []).filter(
        (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      if (list.length > 0) return list;
    }
    return [];
  } catch {
    return [];
  }
}

function pickBestTrailerKey(trailers: TrailerInfo[]): string | null {
  if (!trailers || trailers.length === 0) return null;
  const isKino = (t: TrailerInfo) => /kinocheck|kino check|kinotrailer/i.test(t.name || '');
  const candidates = trailers.filter((t) => !isKino(t));
  const pool = candidates.length > 0 ? candidates : trailers;
  const ranked =
    pool.find((t) => t.type === 'Trailer' && /official/i.test(t.name || '') && t.iso_639_1 === 'de') ||
    pool.find((t) => t.type === 'Trailer' && t.iso_639_1 === 'de') ||
    pool.find((t) => t.type === 'Trailer' && /official/i.test(t.name || '')) ||
    pool.find((t) => t.type === 'Trailer') ||
    pool[0];
  return ranked?.key || null;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('TRAILER BACKFILL');
  console.log('═'.repeat(70));
  console.log(`Options: limit=${limit}, reset-skip=${resetSkip}`);
  console.log('');

  if (resetSkip) {
    const r = await prisma.series.updateMany({
      where: { localTrailerPath: { in: ['SKIP', 'unavailable'] } },
      data: { localTrailerPath: null },
    });
    console.log(`🧹 Reset ${r.count} series with localTrailerPath = SKIP/unavailable → NULL`);
  }

  // Pick top series by published-article count where localTrailerPath is NULL
  const rows = await prisma.$queryRawUnsafe<Array<{ tmdbId: number; name: string | null; title: string | null; trailers: any; article_count: number }>>(`
    SELECT s."tmdbId", s.name, s.title, s.trailers,
           COUNT(a.id)::int AS article_count
    FROM series s
    JOIN articles a ON a."primarySeriesId" = s."tmdbId" AND a.status = 'published'
    WHERE s."localTrailerPath" IS NULL
    GROUP BY s."tmdbId", s.name, s.title, s.trailers
    ORDER BY article_count DESC
    LIMIT ${Math.max(1, Math.min(limit, 1000))}
  `);

  console.log(`\nFound ${rows.length} candidate series (ordered by article count)\n`);

  let success = 0;
  let failed = 0;
  let none = 0;

  for (let i = 0; i < rows.length; i++) {
    const s = rows[i];
    const name = s.title || s.name || `series-${s.tmdbId}`;
    const tag = `[${i + 1}/${rows.length}] ${name} (tmdbId=${s.tmdbId}, ${s.article_count} Artikel)`;
    console.log(tag);

    // 1. Try existing JSON trailers in DB
    let trailerId: string | null = null;
    const dbTrailers: TrailerInfo[] = Array.isArray(s.trailers) ? s.trailers : [];
    if (dbTrailers.length > 0) {
      trailerId = pickBestTrailerKey(dbTrailers);
      if (trailerId) console.log(`   📦 DB-Trailer: ${trailerId}`);
    }

    // 2. TMDB fresh fetch
    if (!trailerId) {
      const tmdb = await fetchTrailersFromTMDB(s.tmdbId);
      if (tmdb.length > 0) {
        trailerId = pickBestTrailerKey(tmdb);
        if (trailerId) {
          console.log(`   🌐 TMDB-Trailer: ${trailerId}`);
          // Persist for next time
          await prisma.series.update({
            where: { tmdbId: s.tmdbId },
            data: { trailers: tmdb as any },
          });
        }
      }
    }

    // 3. YouTube search (DE → EN)
    if (!trailerId) {
      console.log(`   🔍 YouTube-Suche...`);
      trailerId = await searchYouTubeTrailerViaAPI(name, 'de');
      if (!trailerId) trailerId = await searchYouTubeTrailerViaAPI(name, 'en');
      if (trailerId) console.log(`   🎬 YouTube-Treffer: ${trailerId}`);
    }

    if (!trailerId) {
      console.log(`   ⚠️  Kein Trailer auffindbar`);
      none++;
      continue;
    }

    // 4. Download via yt-dlp + upload to R2
    try {
      const result = await downloadYouTubeTrailer(trailerId, name);
      if (result.success && result.localPath) {
        await prisma.series.update({
          where: { tmdbId: s.tmdbId },
          data: { localTrailerPath: result.localPath },
        });
        console.log(`   ✅ ${result.localPath}`);
        success++;
      } else {
        console.log(`   ❌ Download fehlgeschlagen: ${result.error}`);
        failed++;
      }
    } catch (e: any) {
      console.log(`   ❌ Fehler: ${e.message}`);
      failed++;
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`Ergebnis: ✅ ${success}  ❌ ${failed}  ⚠️  ${none}  (von ${rows.length})`);
  console.log('═'.repeat(70));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
