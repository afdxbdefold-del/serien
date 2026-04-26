/**
 * Backfill missing `metaDescription` for published articles.
 *
 * Strategy:
 *   1. If `metaDescription` already set → skip (no overwrite).
 *   2. Else, compose from existing fields without an extra LLM call:
 *      – Prefer `excerpt` (human-reviewed lead).
 *      – Fall back to `wasBedeutetDasText` (analytical summary).
 *      – Last resort: clean the article HTML and take the first 2 sentences.
 *   3. Smart-truncate to 155 chars on sentence/word boundary.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/backfill-meta-descriptions.ts [--limit=N] [--dry]
 */

import prisma from '../lib/prisma';
import { smartTruncate } from '../lib/smart-truncate';

const args = process.argv.slice(2);
const limit = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || Infinity;
const dryRun = args.includes('--dry');

const TARGET_LEN = 155;

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function compose(article: { excerpt: string | null; wasBedeutetDasText: string | null; contentHtml: string | null }): string | null {
  const candidates: string[] = [];
  if (article.excerpt) candidates.push(article.excerpt.trim());
  if (article.wasBedeutetDasText) candidates.push(article.wasBedeutetDasText.trim());
  if (article.contentHtml) {
    const text = htmlToText(article.contentHtml);
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 30);
    if (sentences.length > 0) candidates.push(sentences.slice(0, 2).join(' '));
  }

  for (const c of candidates) {
    if (!c) continue;
    const trimmed = c.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 60) continue; // too short to be a useful meta description
    return smartTruncate(trimmed, TARGET_LEN);
  }
  return null;
}

async function main() {
  const candidates = await prisma.articles.findMany({
    where: { status: 'published', metaDescription: null },
    select: { id: true, slug: true, excerpt: true, wasBedeutetDasText: true, contentHtml: true },
    take: Number.isFinite(limit) ? limit : undefined,
  });

  console.log(`Backfill: ${candidates.length} articles need metaDescription` + (dryRun ? ' [DRY RUN]' : ''));

  let written = 0;
  let skipped = 0;
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    const composed = compose(a);
    if (!composed) {
      skipped++;
      continue;
    }
    if (!dryRun) {
      await prisma.articles.update({
        where: { id: a.id },
        data: { metaDescription: composed },
      });
    }
    written++;
    if (i < 5 || (i + 1) % 100 === 0) {
      console.log(`[${i + 1}/${candidates.length}] /${a.slug}: ${composed.slice(0, 80)}…`);
    }
  }

  console.log(`\nDone. written=${written}, skipped=${skipped}, total=${candidates.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
