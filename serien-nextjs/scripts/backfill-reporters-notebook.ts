/**
 * Backfill Reporter's Notebook for all existing published articles.
 *
 * Idempotent: replaces any pre-existing notebook block. Throttled to stay
 * under TMDB's 40 req/s rate limit. Articles without `primarySeriesId` are
 * skipped (the notebook needs a TMDB show to fetch live data for).
 *
 * Usage:
 *   npx tsx scripts/backfill-reporters-notebook.ts            # full run
 *   npx tsx scripts/backfill-reporters-notebook.ts --limit 20 # dry test
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildReportersNotebook, applyNotebookToContent } from '../lib/reporters-notebook';

const prisma = new PrismaClient();
const BATCH_SIZE = 8;          // parallel TMDB calls
const BATCH_DELAY_MS = 250;     // ≈ 32 req/s, safe under TMDB limit

function parseLimit(): number | null {
  const arg = process.argv.find((a) => a.startsWith('--limit'));
  if (!arg) return null;
  const m = arg.match(/--limit[= ](\d+)/) || process.argv[process.argv.indexOf(arg) + 1]?.match(/^(\d+)$/);
  if (!m) return null;
  return parseInt(m[1], 10);
}

async function processOne(article: { id: string; slug: string; primarySeriesId: number | null; contentHtml: string }) {
  if (!article.primarySeriesId) return { status: 'skip', reason: 'no series' };
  try {
    const built = await buildReportersNotebook(article.primarySeriesId);
    if (!built.html) return { status: 'skip', reason: built.skipped || 'no html' };

    const updated = applyNotebookToContent(article.contentHtml, built.html);
    if (updated === article.contentHtml) return { status: 'unchanged' };

    await prisma.articles.update({
      where: { id: article.id },
      data: { contentHtml: updated },
    });
    return { status: 'ok', sentences: built.sentenceCount };
  } catch (e: any) {
    return { status: 'err', reason: e.message };
  }
}

async function main() {
  const limit = parseLimit();
  console.log(`📓 Reporter's Notebook backfill — limit: ${limit ?? 'ALL'}\n`);

  const articles = await prisma.articles.findMany({
    where: { status: 'published', primarySeriesId: { not: null } },
    select: { id: true, slug: true, primarySeriesId: true, contentHtml: true },
    orderBy: { publishedAt: 'desc' },
    take: limit ?? undefined,
  });

  console.log(`Found ${articles.length} eligible articles\n`);

  const stats = { ok: 0, skip: 0, err: 0, unchanged: 0 };
  const startedAt = Date.now();

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(processOne));

    results.forEach((r, idx) => {
      const a = batch[idx];
      const status = r.status as keyof typeof stats;
      stats[status]++;
      const tag =
        r.status === 'ok' ? `✅ (${r.sentences})` :
        r.status === 'unchanged' ? '⊘ unchanged' :
        r.status === 'skip' ? `⏭️  ${r.reason}` :
        `❌ ${r.reason}`;
      console.log(`${i + idx + 1}/${articles.length}  ${a.slug.substring(0, 60).padEnd(60)} ${tag}`);
    });

    if (i + BATCH_SIZE < articles.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n🏁 Done in ${secs}s — OK ${stats.ok} · unchanged ${stats.unchanged} · skipped ${stats.skip} · errors ${stats.err}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
