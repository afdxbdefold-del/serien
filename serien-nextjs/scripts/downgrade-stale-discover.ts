/**
 * Stale Discover Downgrade
 *
 * Google News expects sitemap entries to be ≤48h fresh. Articles older than
 * that should be moved out of `publishMode=DISCOVER` to `SEARCH_ONLY` so
 * the News-Sitemap stays compact and the Discover quota isn't diluted.
 *
 * Runs idempotently. Safe to schedule daily.
 *
 * Usage:
 *   npx tsx scripts/downgrade-stale-discover.ts           # dry-run
 *   npx tsx scripts/downgrade-stale-discover.ts --apply   # writes DB
 *   npx tsx scripts/downgrade-stale-discover.ts --apply --hours=72
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');
const HOURS_ARG = process.argv.find(a => a.startsWith('--hours='));
const HOURS = HOURS_ARG ? parseInt(HOURS_ARG.split('=')[1], 10) : 48;

(async () => {
  const cutoff = new Date(Date.now() - HOURS * 3600 * 1000);
  const candidates = await prisma.articles.findMany({
    where: { publishMode: 'DISCOVER', publishedAt: { lt: cutoff } },
    select: { id: true, slug: true, publishedAt: true, isRankingArticle: true },
  });

  console.log(`📊 ${candidates.length} DISCOVER articles older than ${HOURS}h`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  if (!APPLY) {
    console.log('First 10:');
    candidates.slice(0, 10).forEach(c =>
      console.log(`  - ${c.slug} (${c.publishedAt.toISOString().slice(0, 10)})`),
    );
    await prisma.$disconnect();
    return;
  }

  const res = await prisma.articles.updateMany({
    where: { publishMode: 'DISCOVER', publishedAt: { lt: cutoff } },
    data: { publishMode: 'SEARCH_ONLY' },
  });
  console.log(`✅ Downgraded ${res.count} articles → SEARCH_ONLY`);

  // Best-effort: revalidate the news sitemap so Googlebot sees the new ETag.
  try {
    const revalidateSecret = process.env.REVALIDATE_SECRET;
    if (revalidateSecret) {
      await fetch('http://localhost:3000/api/internal/revalidate-sitemap', {
        method: 'POST',
        headers: { Authorization: `Bearer ${revalidateSecret}` },
      });
      console.log('✅ News-Sitemap revalidate triggered');
    }
  } catch (e: any) {
    console.log('   ⚠️  Revalidate-Trigger fehlgeschlagen:', e.message);
  }

  await prisma.$disconnect();
})();
