/**
 * Spot-check several of the 262 backfilled articles to verify the first
 * body paragraph is meaningful and not the lead.
 */
import prisma from '../lib/prisma';

const SLUGS = [
  'ueberflutetes-set-bremst-a-knight-of-the-seven-kingdoms',
  'new-amsterdam-staffel-4-arzte-charaktere',
  'eternauta-staffel-2-wird-deutlich-groe-er-als-staffel-1',
  'bill-nighy-kehrt-als-neuer-harry-potter-charakter-zurueck',
  'wo-wurde-the-unforgivable-gedreht',
  'nach-dem-staffel-2-finale-one-piece-staffel-3-nimmt-fahrt-auf',
];

async function main() {
  for (const slug of SLUGS) {
    const a = await prisma.articles.findUnique({
      where: { slug },
      select: { excerpt: true, contentHtml: true },
    });
    if (!a) {
      console.log(`/${slug}: NOT FOUND`);
      continue;
    }
    const firstP = (a.contentHtml || '').match(/<p[^>]*>([\s\S]*?)<\/p>/);
    const firstPText = firstP ? firstP[1].replace(/<[^>]+>/g, '').trim() : '(no <p>)';
    console.log(`/${slug}`);
    console.log(`  EXCERPT: ${(a.excerpt || '').slice(0, 100)}…`);
    console.log(`  P1     : ${firstPText.slice(0, 120)}…`);
    console.log('');
  }
  await prisma.$disconnect();
}
main();
