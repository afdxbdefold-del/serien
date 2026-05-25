/* eslint-disable */
import prisma from '../lib/prisma';
async function main() {
  // Series-Treffer für "The Boroughs"
  const rows = await prisma.series.findMany({
    where: { OR: [{ slug: { contains: 'boroughs' } }, { title: { contains: 'Boroughs' } }] },
    select: { slug: true, title: true, tmdbId: true },
  });
  console.log('Series matches:');
  rows.forEach((r) => console.log(`  slug=${r.slug}  title="${r.title}"  tmdbId=${r.tmdbId}`));

  // Simulate the override logic
  const url = 'https://thecinemaholic.com/the-boroughs-ending-explained/';
  const path = url.toLowerCase().replace('https://thecinemaholic.com/', '').split('?')[0];
  const slugPrefix = path
    .replace(/\/+$/, '')
    .replace(/-ending-explained.*$/, '')
    .replace(/-s\d+(-e\d+)?$/, '')
    .replace(/-season-\d+$/, '');
  console.log(`\nslugPrefix: "${slugPrefix}"`);

  const knownSeriesSlugs = new Set(
    rows.flatMap((r) => {
      const titleSlug = (r.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      return [r.slug.toLowerCase(), titleSlug];
    }).filter(Boolean)
  );
  console.log('Known slugs (candidates):', [...knownSeriesSlugs]);
  console.log(`\n→ Match? ${knownSeriesSlugs.has(slugPrefix) ? 'YES — URL is now allowed' : 'NO — still filtered'}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
