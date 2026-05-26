/* eslint-disable */
/**
 * One-shot: strip the duplicated "Serien.de folgt strikten Autorenrichtlinien…"
 * boilerplate paragraph from every author's `fullBio` (it was identical or
 * near-identical across all 12 authors and added zero value).
 *
 *   DRY:    npx tsx scripts/strip-author-bio-boilerplate.ts
 *   APPLY:  npx tsx scripts/strip-author-bio-boilerplate.ts --apply
 */
import prisma from '../lib/prisma';

const APPLY = process.argv.includes('--apply');
const RE = /<p[^>]*>\s*Serien\.de folgt strikten Autorenrichtlinien[\s\S]*?<\/p>\s*/i;

async function main() {
  const users = await prisma.users.findMany({
    where: { fullBio: { not: null } },
    select: { id: true, name: true, fullBio: true },
  });

  const hits: Array<{ id: string; name: string; before: number; after: number }> = [];
  for (const u of users) {
    if (!u.fullBio) continue;
    if (!RE.test(u.fullBio)) continue;
    const cleaned = u.fullBio.replace(RE, '').trim();
    hits.push({ id: u.id, name: u.name || '(no name)', before: u.fullBio.length, after: cleaned.length });
    if (APPLY) await prisma.users.update({ where: { id: u.id }, data: { fullBio: cleaned } });
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} — ${hits.length} authors affected:`);
  for (const h of hits) console.log(`  ${h.name.padEnd(20)}  ${h.before} → ${h.after} chars  (-${h.before - h.after})`);
  if (!APPLY) console.log(`\n(pass --apply to write)`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
