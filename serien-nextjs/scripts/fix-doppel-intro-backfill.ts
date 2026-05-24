/**
 * Detect (and optionally fix) the duplicate-intro pattern in `articles`.
 *
 * Pattern: contentHtml starts with a <p>…</p> whose plain text overlaps
 *          ≥ 75 % with the article's `excerpt`.
 *
 * Run with `--apply` to actually strip the first <p>. Without it, prints
 * a dry-run report only.
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

function stripHtml(s: string): string {
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
    where: {
      status: 'published',
    },
    select: { id: true, slug: true, excerpt: true, contentHtml: true },
  });

  console.log(`Scanning ${articles.length} published articles…`);

  let candidates = 0;
  let fixed = 0;
  let skipped = 0;
  const samples: Array<{ slug: string; overlap: number }> = [];

  for (const a of articles) {
    const html = a.contentHtml || '';
    const exc = a.excerpt || '';
    if (exc.length < 30) {
      skipped++;
      continue;
    }
    const firstP = html.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/);
    if (!firstP) {
      skipped++;
      continue;
    }
    const firstPText = stripHtml(firstP[1]);
    if (firstPText.length < 30 || firstPText.length > 800) {
      skipped++;
      continue;
    }
    const overlap = wordOverlap(stripHtml(exc), firstPText);
    if (overlap < 0.75) {
      skipped++;
      continue;
    }
    candidates++;
    if (samples.length < 5) {
      samples.push({ slug: a.slug, overlap: Math.round(overlap * 100) });
    }
    if (APPLY) {
      const newHtml = html.replace(/^\s*<p[^>]*>[\s\S]*?<\/p>\s*/, '').trim();
      await prisma.articles.update({
        where: { id: a.id },
        data: { contentHtml: newHtml },
      });
      fixed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total scanned:    ${articles.length}`);
  console.log(`Doppel-Intro hits: ${candidates}`);
  console.log(`Fixed:            ${fixed}`);
  console.log(`Skipped:          ${skipped}`);
  console.log(`\nSamples (slug, overlap %):`);
  samples.forEach((s) => console.log(`  /${s.slug}  → ${s.overlap}%`));
  if (!APPLY && candidates > 0) {
    console.log(`\n  Dry-run mode. Re-run with --apply to actually fix.`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
