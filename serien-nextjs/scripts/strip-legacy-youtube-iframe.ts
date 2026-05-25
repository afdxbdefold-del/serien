/* eslint-disable */
/**
 * Strip the legacy auto-loading <iframe> youtube embed from existing
 * articles. Keeps the new Lite-Facade (`youtube-lite`) untouched.
 *
 * Pattern: `<div class="video-embed-wrapper"><iframe src="https://www.youtube-nocookie.com/embed/...`
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

// Matches the *legacy* auto-iframe block, NOT the new lite facade.
// Lite has class="video-embed-wrapper youtube-lite" — that extra class
// makes the regex safe.
const LEGACY_IFRAME = /<div class="video-embed-wrapper"><iframe[^>]+youtube-nocookie[^>]+><\/iframe><\/div>\s*/g;

async function main() {
  const arts = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, contentHtml: true },
  });
  let touched = 0;
  const samples: string[] = [];
  for (const a of arts) {
    const html = a.contentHtml || '';
    if (!LEGACY_IFRAME.test(html)) continue;
    LEGACY_IFRAME.lastIndex = 0; // reset for global flag
    const newHtml = html.replace(LEGACY_IFRAME, '');
    if (newHtml === html) continue;
    touched++;
    if (samples.length < 5) samples.push(a.slug);
    if (APPLY) {
      await prisma.articles.update({ where: { id: a.id }, data: { contentHtml: newHtml } });
    }
  }
  console.log(`Scanned: ${arts.length}`);
  console.log(`Articles with legacy <iframe> embed: ${touched}`);
  console.log(`Mode: ${APPLY ? 'APPLIED' : 'dry-run (pass --apply to write)'}`);
  samples.forEach((s) => console.log(`  /${s}`));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
