/**
 * Backfill missing `networks` on series referenced by published articles.
 *
 * For each series with empty `networks` that has at least 1 published article:
 *   - Call TMDB API /tv/:id
 *   - Extract `networks[].name` and store as String[]
 *   - Store full objects in `networksJson`
 *
 * Run:
 *   npx tsx scripts/backfill-series-networks.ts          # dry-run
 *   npx tsx scripts/backfill-series-networks.ts --apply
 */

import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');
const TMDB_KEY = process.env.TMDB_API_KEY;

if (!TMDB_KEY) {
  console.error('TMDB_API_KEY missing');
  process.exit(1);
}

async function fetchTmdbNetworks(tmdbId: number): Promise<{ names: string[]; full: any[] } | null> {
  const url = `https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${TMDB_KEY}&language=de-DE`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json() as any;
    const networks = (data.networks || []) as any[];
    return {
      names: networks.map(n => n.name).filter(Boolean),
      full: networks.map(n => ({
        id: n.id,
        name: n.name,
        logo_path: n.logo_path,
        origin_country: n.origin_country || '',
      })),
    };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  // Distinct series IDs referenced by published articles
  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { primarySeriesId: true },
    distinct: ['primarySeriesId'],
  });
  const seriesIds = articles.map(a => a.primarySeriesId).filter(Boolean) as number[];

  const targets = await prisma.series.findMany({
    where: { tmdbId: { in: seriesIds }, networks: { isEmpty: true } },
    select: { tmdbId: true, slug: true, name: true, title: true },
  });
  console.log(`Target series: ${targets.length}`);

  let updated = 0;
  let skipped = 0;

  for (const s of targets) {
    const data = await fetchTmdbNetworks(s.tmdbId);
    if (!data || data.names.length === 0) {
      console.log(`  - ${s.slug} (${s.tmdbId}): no networks from TMDB`);
      skipped++;
      continue;
    }

    console.log(`  ✓ ${s.slug} (${s.tmdbId}): ${data.names.join(', ')}`);
    updated++;

    if (APPLY) {
      await prisma.series.update({
        where: { tmdbId: s.tmdbId },
        data: {
          networks: data.names,
          networksJson: data.full,
        },
      });
    }
    // small throttle to TMDB (40 req/10s limit)
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Would update / Updated:    ${updated}`);
  console.log(`Skipped (no network data): ${skipped}`);

  if (!APPLY) console.log(`\n➡️  To apply: npx tsx scripts/backfill-series-networks.ts --apply`);
  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
