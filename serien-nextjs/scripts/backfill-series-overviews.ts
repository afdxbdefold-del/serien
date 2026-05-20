/**
 * Backfill: Re-fetch TMDB overview (DE → EN-Fallback) for series whose
 * `overview` column is empty or null.
 *
 * Root cause: getTvDetailsComplete() initially saved data.overview as-is
 * even when TMDB returned "" for newly-added shows that lacked a DE
 * translation. Once the community uploads a DE overview (often weeks
 * after release), our DB still holds the empty string.
 *
 * Usage:
 *   yarn tsx scripts/backfill-series-overviews.ts                # dry-run
 *   yarn tsx scripts/backfill-series-overviews.ts --apply        # writes DB
 *   yarn tsx scripts/backfill-series-overviews.ts --apply --slug=man-on-fire
 */
import prisma from '../lib/prisma';
import { getTvDetailsComplete } from '../lib/tmdb';

const APPLY = process.argv.includes('--apply');
const SLUG_ARG = process.argv.find(a => a.startsWith('--slug='));
const ONLY_SLUG = SLUG_ARG ? SLUG_ARG.split('=')[1] : null;

async function main() {
  const where: any = {
    OR: [
      { overview: '' },
      { overview: null },
    ],
  };
  if (ONLY_SLUG) where.slug = ONLY_SLUG;

  const targets = await prisma.series.findMany({
    where,
    select: { tmdbId: true, slug: true, name: true, title: true, overview: true },
    orderBy: [{ popularity: 'desc' }],
    take: ONLY_SLUG ? 1 : 500,
  });

  console.log(`📊 ${targets.length} Serien ohne overview gefunden${ONLY_SLUG ? ` (Slug-Filter: ${ONLY_SLUG})` : ''}`);
  console.log(`Mode: ${APPLY ? 'APPLY (DB-Writes)' : 'DRY-RUN'}\n`);

  let updated = 0, stillEmpty = 0, failed = 0;

  for (const s of targets) {
    if (!s.tmdbId) { console.log(`  ⏭️  ${s.slug || s.name} — keine tmdbId, skip`); continue; }
    try {
      const details = await getTvDetailsComplete(s.tmdbId, 'de-DE');
      const next = (details?.overview || '').trim();
      if (!next) {
        stillEmpty++;
        console.log(`  ❌ ${s.slug || s.name} (#${s.tmdbId}) — TMDB hat weder DE noch EN`);
        continue;
      }
      console.log(`  ✅ ${s.slug || s.name} (#${s.tmdbId})`);
      console.log(`     ${next.slice(0, 140)}${next.length > 140 ? '…' : ''}`);
      if (APPLY) {
        await prisma.series.update({
          where: { tmdbId: s.tmdbId },
          data: { overview: next },
        });
        updated++;
      }
    } catch (e: any) {
      failed++;
      console.log(`  ⚠️  ${s.slug || s.name} (#${s.tmdbId}) — ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 120)); // gentle rate-limit
  }

  console.log(`\nDone. updated=${updated} stillEmpty=${stillEmpty} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
