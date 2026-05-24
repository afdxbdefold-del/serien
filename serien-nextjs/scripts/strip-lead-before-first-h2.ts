/* eslint-disable */
/**
 * Backfill: remove the duplicate lead-paragraph from articles whose
 * `contentHtml` starts with <p>…lead…</p> followed directly by an <h2>.
 *
 * Pattern detected by the Sha-Na-Na case: pipeline's assembleMarkdown()
 * wrote the lead BOTH into the excerpt AND as the first <p> in the body.
 * Now that we no longer write the lead into the body, the existing 3.000+
 * articles still carry the artefact. Strip them.
 *
 * Safety:
 *   - only act when the first <p> is between 50 and 800 chars (lead-like)
 *   - only act when the NEXT non-whitespace tag is <h2>
 *   - dry-run by default (`--apply` to write)
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, contentHtml: true, excerpt: true },
  });

  console.log(`Scanning ${articles.length} articles…`);

  let touched = 0;
  const samples: Array<{ slug: string; lead: string }> = [];

  for (const a of articles) {
    const html = (a.contentHtml || '').trim();
    if (!html) continue;

    // First <p>…</p> at the very start of the body
    const firstP = html.match(/^<p[^>]*>([\s\S]*?)<\/p>\s*/);
    if (!firstP) continue;
    const firstPText = stripHtml(firstP[1]);
    if (firstPText.length < 50 || firstPText.length > 800) continue;

    // Next non-whitespace tag after the first <p> must be <h2>
    const tail = html.slice(firstP[0].length).trimStart();
    if (!tail.startsWith('<h2')) continue;

    if (samples.length < 8) samples.push({ slug: a.slug, lead: firstPText.slice(0, 120) });
    touched++;
    if (APPLY) {
      const newHtml = tail;
      await prisma.articles.update({
        where: { id: a.id },
        data: { contentHtml: newHtml },
      });
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Articles matching duplicate-lead pattern: ${touched}`);
  console.log(`Applied: ${APPLY ? 'YES' : 'no (dry-run, pass --apply)'}`);
  if (samples.length) {
    console.log('\nSamples:');
    samples.forEach((s) => console.log(`  /${s.slug}\n    lead: ${s.lead}…`));
  }
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
