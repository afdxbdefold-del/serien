/**
 * Re-link orphan articles
 *
 * Some legacy articles ended up without `tmdbId` or `primarySeriesId`,
 * usually because TMDB search failed during their original pipeline run.
 * We try to recover the link by extracting a series name from the title
 * (heuristically) and matching against `series.name` / `series.title`.
 *
 * Conservative: only auto-link if there is a single, high-confidence match.
 *
 * Usage:
 *   npx tsx scripts/relink-orphan-articles.ts            # dry-run
 *   npx tsx scripts/relink-orphan-articles.ts --apply
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');

// Strip noise so "Stranger Things Staffel 5 startet" → "Stranger Things"
function extractCandidateSeriesName(title: string): string[] {
  const cleaned = title
    .replace(/[—–-]\s.*$/, '')
    .replace(/:.*$/, '')
    .replace(/[,.!?].*$/, '')
    .replace(/\b(staffel|season|episode|finale|trailer|release|start(?:et)?|kommt|kehrt|zurück|läuft|bekommt|verlängert|abgesetzt|enth[üu]llt|verr[äa]t)\b.*$/i, '')
    .replace(/\b(netflix|prime\s*video|disney\+?|apple\s*tv\+?|paramount\+?|hbo(?:\s*max)?|sky|peacock|hulu|rtl\+?|wow|joyn)\b/gi, '')
    .replace(/\bbei\s+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const variants = new Set<string>();
  if (cleaned.length > 2) variants.add(cleaned);
  // Drop trailing single-word tokens to also try 2-word and 3-word prefixes
  const words = cleaned.split(/\s+/);
  if (words.length > 3) variants.add(words.slice(0, 3).join(' '));
  if (words.length > 2) variants.add(words.slice(0, 2).join(' '));
  return Array.from(variants).filter(v => v.length >= 3);
}

(async () => {
  const orphans = await prisma.articles.findMany({
    where: {
      status: 'published',
      OR: [{ tmdbId: null }, { primarySeriesId: null }],
    },
    select: { id: true, slug: true, title: true },
  });
  console.log(`📊 ${orphans.length} orphan articles`);

  let linked = 0, ambiguous = 0, unmatched = 0;
  for (const a of orphans) {
    const candidates = extractCandidateSeriesName(a.title || '');
    let match: { tmdbId: number; name: string | null } | null = null;
    for (const c of candidates) {
      const hits = await prisma.series.findMany({
        where: { OR: [
          { name: { equals: c, mode: 'insensitive' } },
          { title: { equals: c, mode: 'insensitive' } },
          { originalName: { equals: c, mode: 'insensitive' } },
        ] },
        select: { tmdbId: true, name: true },
        take: 2,
      });
      if (hits.length === 1) { match = hits[0]; break; }
      if (hits.length > 1) { match = null; break; }
    }
    if (!match) {
      // also try the *first* candidate via contains (only if very long)
      const first = candidates[0];
      if (first && first.length >= 8) {
        const hits = await prisma.series.findMany({
          where: { name: { contains: first, mode: 'insensitive' } },
          select: { tmdbId: true, name: true },
          take: 2,
        });
        if (hits.length === 1) match = hits[0];
      }
    }
    if (!match) {
      unmatched++;
      continue;
    }
    linked++;
    if (APPLY) {
      await prisma.articles.update({
        where: { id: a.id },
        data: { tmdbId: match.tmdbId, primarySeriesId: match.tmdbId, tmdbType: 'tv' },
      });
    }
    if (linked <= 8) console.log(`  ✅ ${a.slug.slice(0, 60)} → "${match.name}" (#${match.tmdbId})`);
  }
  console.log(`\nResult: linked=${linked} ambiguous/skipped=${ambiguous} unmatched=${unmatched}`);
  if (!APPLY) console.log('DRY-RUN — pass --apply to write.');
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
