/**
 * Re-score all discover_score_dashboards entries whose headlineMetrics.performance.score
 * is stale (was computed against the pre-rewrite headline while the article got published
 * with the rewritten title).
 *
 * Runs the current `discoverGate()` against the actual `article.title` + `article.contentHtml`
 * and writes back the full dashboard row. Idempotent — you can re-run it any time.
 *
 * Usage:
 *   npx tsx scripts/backfill-discover-scores.ts               # dry-run, newest 14 days
 *   npx tsx scripts/backfill-discover-scores.ts --apply       # actually write
 *   npx tsx scripts/backfill-discover-scores.ts --apply --days=30
 */
import { config } from 'dotenv';
config();
import prisma from '../lib/prisma';
import { discoverGate } from '../lib/discover-gate';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const daysArg = args.find((a) => a.startsWith('--days='));
  const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 14;
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10000;

  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  console.log(`Backfill window: ${days} days (since ${since.toISOString()})`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Limit: ${limit}`);
  console.log();

  const rows = await prisma.discover_score_dashboards.findMany({
    where: { timestamp: { gte: since } },
    select: {
      id: true,
      headlineMetrics: true,
      articles: { select: { title: true, contentHtml: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  console.log(`Loaded ${rows.length} dashboard rows`);

  let scored = 0;
  let drift = 0;
  let skipped = 0;
  let failed = 0;
  let totalStored = 0;
  let totalNew = 0;
  const start = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.articles?.title) {
      skipped++;
      continue;
    }
    const m: any = r.headlineMetrics || {};
    const storedPerf = m.performance?.score ?? 0;

    try {
      const gate = await discoverGate({
        final_headline: r.articles.title,
        article_html: r.articles.contentHtml || '<p/>',
        hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
        publishedAt: new Date(),
        primary_series: r.articles.title.split(' ')[0] || '',
      });
      const newPerf = gate.dashboard.headline_performance.score;
      totalStored += storedPerf;
      totalNew += newPerf;
      scored++;
      if (Math.abs(newPerf - storedPerf) >= 3) drift++;

      if (apply) {
        await prisma.discover_score_dashboards.update({
          where: { id: r.id },
          data: {
            headlineMetrics: {
              ...(gate.dashboard.headline as any),
              performance: gate.dashboard.headline_performance,
            } as any,
            contentMetrics: gate.dashboard.content_opening as any,
            freshnessMetrics: gate.dashboard.freshness as any,
            imageMetrics: gate.dashboard.image_visual as any,
            trustMetrics: gate.dashboard.trust_clarity as any,
            discoverScore: gate.scores.total,
            finalVerdict: gate.discover_eligible ? 'DISCOVER_OK' : 'SEARCH_ONLY',
            primaryBlockers: gate.dashboard.aggregation.primary_blockers ?? [],
            improvementHints: gate.dashboard.aggregation.improvement_hints ?? [],
          },
        });
      }
    } catch (err: any) {
      failed++;
      console.log(`  ⚠️ ${r.id} failed: ${err?.message ?? err}`);
    }

    if ((i + 1) % 25 === 0) {
      process.stdout.write(
        `\rProgress: ${i + 1}/${rows.length} (${Math.round(((i + 1) / rows.length) * 100)}%)  `,
      );
    }
  }
  console.log();
  console.log();
  console.log(`=== Summary (${((Date.now() - start) / 1000).toFixed(1)}s) ===`);
  console.log(`Scored: ${scored}, Skipped: ${skipped}, Failed: ${failed}`);
  if (scored > 0) {
    console.log(`Ø stored perf: ${(totalStored / scored).toFixed(1)}`);
    console.log(`Ø new perf:    ${(totalNew / scored).toFixed(1)}`);
    console.log(`Rows with drift ≥3: ${drift} (${Math.round((drift / scored) * 100)}%)`);
  }
  if (!apply) {
    console.log(`\nDry run — re-run with --apply to persist the new scores.`);
  } else {
    console.log(`\n✅ Applied to ${scored} rows.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
