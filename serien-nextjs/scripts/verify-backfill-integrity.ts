/**
 * Verify that the 262 backfilled articles still contain a sensible first
 * paragraph after the on-read sanitizer (intelligent overlap version).
 *
 * For each article we render through sanitizeArticleContent and check:
 *   - has at least 1 <p> remaining
 *   - first <p> does NOT match excerpt (≥60 % word overlap)
 *   - has at least 1 <h2> remaining (structural sanity)
 */
import prisma from '../lib/prisma';
import { sanitizeArticleContent } from '../lib/content-sanitizer';

function strip(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let n = 0;
  for (const w of wa) if (wb.has(w)) n++;
  return n / Math.min(wa.size, wb.size);
}

async function main() {
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, excerpt: true, contentHtml: true, updatedAt: true },
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const recentlyBackfilled = articles.filter(
    (a) => a.updatedAt && new Date(a.updatedAt).getTime() >= today.getTime()
  );
  console.log(`Total: ${articles.length}, recently updated: ${recentlyBackfilled.length}`);

  let okCount = 0;
  let bodyLoss = 0;
  let stillDuplicate = 0;
  const issues: string[] = [];

  for (const a of recentlyBackfilled) {
    const sanitized = sanitizeArticleContent(a.contentHtml || '', a.excerpt || undefined);
    const firstP = sanitized.match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const hasH2 = /<h2/i.test(sanitized);
    if (!firstP) {
      bodyLoss++;
      issues.push(`/${a.slug}: no <p> remaining`);
      continue;
    }
    const overlap = wordOverlap(strip(firstP[1]), strip(a.excerpt || ''));
    if (overlap >= 0.6) {
      stillDuplicate++;
      issues.push(`/${a.slug}: still duplicate (overlap=${Math.round(overlap * 100)}%)`);
      continue;
    }
    if (!hasH2 && strip(sanitized).length < 200) {
      bodyLoss++;
      issues.push(`/${a.slug}: very short body (${strip(sanitized).length}c)`);
      continue;
    }
    okCount++;
  }

  console.log(`\n=== Validation ===`);
  console.log(`OK:                 ${okCount}`);
  console.log(`Body loss / empty:  ${bodyLoss}`);
  console.log(`Still duplicate:    ${stillDuplicate}`);
  if (issues.length) {
    console.log(`\n=== Issues (first 10) ===`);
    issues.slice(0, 10).forEach((i) => console.log('  ' + i));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
