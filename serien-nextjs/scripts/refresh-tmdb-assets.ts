/**
 * TMDB Asset Refresh — fills in missing assets for series whose original
 * sync missed: trailers, posterPath, backdropPath, networks, genres,
 * tagline, lastEpisodeToAir, nextEpisodeToAir.
 *
 * Usage:
 *   npx tsx scripts/refresh-tmdb-assets.ts             # dry-run
 *   npx tsx scripts/refresh-tmdb-assets.ts --apply
 *   npx tsx scripts/refresh-tmdb-assets.ts --apply --limit=200
 */
import prisma from '../lib/prisma';

const TMDB = process.env.TMDB_API_KEY!;
const APPLY = process.argv.includes('--apply');
const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 800;

async function fetchTmdb(tmdbId: number) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB}&language=de-DE&append_to_response=videos`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}
async function fetchTmdbEn(tmdbId: number) {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB}&language=en-US&append_to_response=videos`;
  const r = await fetch(url);
  if (!r.ok) return null;
  return r.json();
}

(async () => {
  const targets = await prisma.series.findMany({
    where: {
      OR: [
        { posterPath: null }, { posterPath: '' },
        { backdropPath: null }, { backdropPath: '' },
        { networks: { equals: [] } },
        { genres: { equals: [] } },
        { trailers: { equals: [] } },
      ],
    },
    select: {
      tmdbId: true, name: true, slug: true,
      posterPath: true, backdropPath: true, networks: true, genres: true, trailers: true,
    },
    orderBy: [{ popularity: 'desc' }],
    take: LIMIT,
  });
  console.log(`📊 ${targets.length} series with missing TMDB assets`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  let touched = 0;
  for (let i = 0; i < targets.length; i++) {
    const s = targets[i];
    try {
      const de = await fetchTmdb(s.tmdbId);
      const en = (!de || !de.overview || de.networks?.length === 0 || de.genres?.length === 0) ? await fetchTmdbEn(s.tmdbId) : null;
      if (!de && !en) { console.log(`  ❌ ${s.name} — TMDB 404`); continue; }
      const src = de || en;

      const data: any = {};
      if (!s.posterPath && src.poster_path) data.posterPath = src.poster_path;
      if (!s.backdropPath && src.backdrop_path) data.backdropPath = src.backdrop_path;
      const networks = (src.networks || []).map((n: any) => n.name).filter(Boolean);
      if ((s.networks as any[]).length === 0 && networks.length > 0) data.networks = networks;
      const genres = (src.genres || []).map((g: any) => g.name).filter(Boolean);
      if ((s.genres as any[]).length === 0 && genres.length > 0) data.genres = genres;

      const trailers = (src.videos?.results || []).filter((v: any) =>
        v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
      );
      if ((s.trailers as any[] | null)?.length === 0 && trailers.length > 0) data.trailers = trailers;

      if (Object.keys(data).length === 0) continue;

      console.log(`  ✅ ${s.name} (#${s.tmdbId}) — fields: ${Object.keys(data).join(', ')}`);
      if (APPLY) {
        await prisma.series.update({ where: { tmdbId: s.tmdbId }, data });
        touched++;
      }
    } catch (e: any) {
      console.log(`  ⚠️  ${s.name} — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 150));
  }
  console.log(`\nDone. ${APPLY ? 'updated' : 'would-update'}: ${touched}`);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
