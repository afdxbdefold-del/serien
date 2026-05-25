/* eslint-disable */
/**
 * Convert any leftover **markdown** bold in `articles.contentHtml` to
 * proper <strong>...</strong> HTML and persist. This eliminates the
 * residue from the Faithful-Translator era where `**Foo**` survived the
 * markdown→HTML pass because cast/character/streamer linking injected
 * <a> tags inside the bold span.
 *
 * Dry-run by default. Pass `--apply` to write.
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

function convertMarkdownBold(html: string): string {
  // Same regex used in lib/content-sanitizer.ts STEP 0c. Limit to 200 chars
  // to avoid greedy multi-line matches. Skip captures that already contain
  // a <strong> tag (would produce nested double-strong garbage).
  return html.replace(/\*\*([^*\n]{1,200}?)\*\*/g, (m, inner) => {
    if (/<strong/i.test(inner)) return m; // leave alone, requires manual fix
    return `<strong>${inner}</strong>`;
  });
}

async function main() {
  const articles = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, contentHtml: true },
  });

  let candidates = 0;
  let fixed = 0;
  const samples: Array<{ slug: string; before: string; after: string }> = [];

  for (const a of articles) {
    const html = a.contentHtml || '';
    if (!/\*\*[^*\n]{1,200}?\*\*/.test(html)) continue;

    candidates++;
    const newHtml = convertMarkdownBold(html);
    if (newHtml === html) continue;

    if (samples.length < 5) {
      const m = html.match(/\*\*[^*\n]{1,200}?\*\*/);
      samples.push({
        slug: a.slug,
        before: m?.[0] || '',
        after: m ? m[0].replace(/\*\*([^*]+)\*\*/, '<strong>$1</strong>') : '',
      });
    }

    if (APPLY) {
      await prisma.articles.update({
        where: { id: a.id },
        data: { contentHtml: newHtml },
      });
    }
    fixed++;
  }

  console.log(`\nScanned: ${articles.length}`);
  console.log(`With **bold** in DB: ${candidates}`);
  console.log(`Converted: ${fixed}`);
  console.log(`Mode: ${APPLY ? 'APPLIED' : 'dry-run (pass --apply to write)'}`);
  if (samples.length) {
    console.log('\nSamples (first occurrence per article):');
    samples.forEach((s) => {
      console.log(`  /${s.slug}`);
      console.log(`    BEFORE: ${s.before}`);
      console.log(`    AFTER:  ${s.after}`);
    });
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
