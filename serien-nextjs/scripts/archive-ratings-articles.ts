/* eslint-disable */
/**
 * One-shot: archive existing published articles whose source/title matches
 * the Ratings/Einschaltquoten patterns added to scripts/pipeline-v2.ts.
 *
 *   DRY:     npx tsx scripts/archive-ratings-articles.ts
 *   APPLY:   npx tsx scripts/archive-ratings-articles.ts --apply
 *
 * Articles are flipped from 'published' → 'archived' (not deleted). Reversible
 * with: UPDATE articles SET status='published' WHERE ...
 */
import prisma from '../lib/prisma';

const RATINGS_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(?:tv|television|cable|broadcast|streaming|primetime|weekly|nightly|sunday|monday|tuesday|wednesday|thursday|friday|saturday)[\s-]*ratings\b/i, label: 'tv-ratings' },
  { re: /\bratings[\s-]*(?:report|recap|roundup|winner|loser|drop|jump|surge|slide|breakdown|wrap|race|war|battle|king|queen|crown|champion|hit|dud|disaster|flop|update|day|news|tracker)/i, label: 'tv-ratings' },
  { re: /\b(?:live[\s-]*\+[\s-]*[37]|l\+sd|l\+3|l\+7|live[\s-]*plus[\s-]*(?:three|seven)|nielsen|household[\s-]*ratings?|key[\s-]*demo|adults?[\s-]*18[\s-]*-[\s-]*49|18[\s-]*-[\s-]*49[\s-]*demo|demo[\s-]*ratings?|total[\s-]*viewers?)\b/i, label: 'nielsen' },
  { re: /\b(?:einschaltquot|tv-quote|tv[\s-]*bilanz|quotensieger|quotenrekord|quoten[\s-]*(?:hit|flop|sieg|bombe|krone|krise|könig|king|queen|erfolg)|marktanteil)/i, label: 'de-quoten' },
  { re: /\b(?:tops?[\s-]+and[\s-]+flops?|top[\s-]+rated|rating[\s-]*report)/i, label: 'tv-ratings' },
];

const APPLY = process.argv.includes('--apply');

async function main() {
  const arts = await prisma.articles.findMany({
    where: { status: 'published' },
    select: { id: true, slug: true, title: true, sourceUrl: true, publishedAt: true },
    orderBy: { publishedAt: 'desc' },
  });

  const hits: Array<{ id: string; slug: string; title: string; label: string; date?: string }> = [];
  for (const a of arts) {
    const combined = `${a.sourceUrl || ''} ${a.title}`;
    for (const { re, label } of RATINGS_PATTERNS) {
      if (re.test(combined)) {
        hits.push({ id: a.id, slug: a.slug, title: a.title, label, date: a.publishedAt?.toISOString().slice(0, 10) });
        break;
      }
    }
  }

  console.log(`\nScanned ${arts.length} published. Ratings-articles: ${hits.length}\n`);
  for (const h of hits) console.log(`  [${h.label}]  ${h.date}  ${h.title}\n    → /${h.slug}`);

  if (!APPLY) {
    console.log(`\n(pass --apply to flip these ${hits.length} from published → archived)`);
    process.exit(0);
  }

  if (hits.length === 0) {
    console.log('Nothing to archive.');
    process.exit(0);
  }

  const ids = hits.map((h) => h.id);
  const r = await prisma.articles.updateMany({
    where: { id: { in: ids } },
    data: { status: 'archived' },
  });
  console.log(`\nArchived ${r.count} articles.`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
