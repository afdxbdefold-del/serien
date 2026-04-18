/**
 * Repair script: Remove first <p> from contentHtml if it duplicates the excerpt.
 *
 * Run:
 *   npx tsx scripts/repair-duplicate-intros.ts          # dry-run (default)
 *   npx tsx scripts/repair-duplicate-intros.ts --apply  # persists changes
 */

import prisma from '../lib/prisma';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

function overlapsEnough(excerpt: string, firstP: string): boolean {
  const e = excerpt.toLowerCase().trim().substring(0, 100);
  const f = firstP.toLowerCase().trim().substring(0, 100);
  if (e === f) return true;
  if (e.length > 40 && f.includes(e.substring(0, 40))) return true;
  return false;
}

function stripFirstParagraph(html: string): string {
  return html.replace(/^\s*<p[^>]*>[\s\S]*?<\/p>/, '').trimStart();
}

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DB)' : 'DRY-RUN (no changes)'}`);

  const articles = await prisma.articles.findMany({
    where: { OR: [{ status: 'published' }, { status: 'PUBLISHED' }] },
    select: { id: true, slug: true, excerpt: true, contentHtml: true },
  });

  const preview: Array<{
    slug: string;
    removedFirst40: string;
    beforeWords: number;
    afterWords: number;
    excerptFirst40: string;
  }> = [];

  let skippedNoMatch = 0;
  let skippedTooShort = 0;
  let skippedEmpty = 0;

  for (const a of articles) {
    const excerpt = (a.excerpt || '').trim();
    const html = a.contentHtml || '';
    if (!excerpt || excerpt.length <= 20) { skippedTooShort++; continue; }
    if (!html) { skippedEmpty++; continue; }

    const firstP = html.match(/^\s*<p[^>]*>([\s\S]*?)<\/p>/);
    if (!firstP) { skippedNoMatch++; continue; }

    const firstPPlain = firstP[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!overlapsEnough(excerpt, firstPPlain)) continue;

    // Safety: first paragraph shouldn't contain a heading/list/etc.
    if (firstP[0].includes('<h2') || firstP[0].includes('<h3')) continue;

    const updated = stripFirstParagraph(html);
    const beforeWords = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;
    const afterWords = updated.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(/\s+/).length;

    preview.push({
      slug: a.slug,
      removedFirst40: firstPPlain.substring(0, 60) + '…',
      beforeWords,
      afterWords,
      excerptFirst40: excerpt.substring(0, 60) + '…',
    });

    if (APPLY) {
      await prisma.articles.update({
        where: { id: a.id },
        data: { contentHtml: updated },
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total articles scanned: ${articles.length}`);
  console.log(`Would repair / Repaired: ${preview.length}`);
  console.log(`Skipped (excerpt too short): ${skippedTooShort}`);
  console.log(`Skipped (empty content): ${skippedEmpty}`);
  console.log(`Skipped (no first <p>): ${skippedNoMatch}`);

  console.log(`\nFirst 15 previews:`);
  preview.slice(0, 15).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.slug}`);
    console.log(`     words ${p.beforeWords} → ${p.afterWords}`);
    console.log(`     removed: "${p.removedFirst40}"`);
    console.log(`     excerpt: "${p.excerptFirst40}"`);
  });

  // Save full preview
  fs.writeFileSync('/tmp/intro-repair-preview.json', JSON.stringify(preview, null, 2));
  console.log(`\nFull preview written to /tmp/intro-repair-preview.json`);

  if (!APPLY) {
    console.log(`\n➡️  To apply, re-run with: npx tsx scripts/repair-duplicate-intros.ts --apply`);
  }

  await prisma.$disconnect();
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1); });
