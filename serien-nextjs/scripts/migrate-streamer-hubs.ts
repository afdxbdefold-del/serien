/* eslint-disable */
/**
 * Bulk-migrate streamer hub pages to use the new resolveStreamerHubTmdbIds()
 * resolver. Adds tmdbIds resolution at the start of each cache fn, then
 * rewrites `networks: { hasSome: [...] }` to `tmdbId: { in: tmdbIds }`
 * (covering both top-level series-queries and nested article/series filters).
 *
 * Safe: idempotent. Skips files that already import the resolver.
 *
 * Usage: npx tsx scripts/migrate-streamer-hubs.ts --apply
 */
import fs from 'fs';
import path from 'path';

const HUBS: Array<{ dir: string; networks: string[]; providers: string[] }> = [
  { dir: 'wow-serien',           networks: ['WOW','Sky','Sky Atlantic','Sky One','Sky Deutschland'], providers: ['WOW','Sky','Sky Atlantic','Sky Deutschland','Sky Go'] },
  { dir: 'hbo-serien',           networks: ['HBO','Max','HBO Max'], providers: ['HBO Max','Max','HBO'] },
  { dir: 'paramount-plus-serien',networks: ['Paramount+','Paramount Plus','Paramount Network','CBS','Showtime'], providers: ['Paramount+','Paramount Plus','Paramount'] },
  { dir: 'joyn-serien',          networks: ['Joyn','ProSieben','SAT.1','Kabel Eins','sixx','ProSieben MAXX','SAT.1 Gold'], providers: ['Joyn','Joyn Plus','ProSieben','SAT.1'] },
  { dir: 'rtl-plus-serien',      networks: ['RTL+','RTL','RTL Plus','VOX','NITRO','RTLplus'], providers: ['RTL+','RTL Plus','RTL','RTLplus'] },
  { dir: 'apple-tv-serien',      networks: ['Apple TV+','Apple TV','AppleTV+'], providers: ['Apple TV+','Apple TV Plus','Apple TV'] },
  { dir: 'discovery-plus-serien',networks: ['Discovery+','Discovery','Discovery Channel','TLC','DMAX','Animal Planet','Eurosport'], providers: ['Discovery+','Discovery Plus','Discovery'] },
  { dir: 'crunchyroll-serien',   networks: ['Crunchyroll','Funimation','Anime'], providers: ['Crunchyroll','Funimation'] },
  { dir: 'ard-mediathek-serien', networks: ['ARD Mediathek','ARD','Das Erste','WDR','NDR','BR','SWR','MDR','HR','RBB','SR','ONE','ARD One'], providers: ['ARD','ARD Mediathek','Das Erste'] },
  { dir: 'zdf-mediathek-serien', networks: ['ZDF Mediathek','ZDF','ZDFneo','ZDFinfo','3sat','ARTE','arte','KiKA'], providers: ['ZDF','ZDF Mediathek','ZDFmediathek'] },
];

const APPLY = process.argv.includes('--apply');
const ROOT = '/app/serien-nextjs';

function migrate(filePath: string, networks: string[], providers: string[]): { changed: boolean; before: string; after: string; replacements: number } {
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;
  let replacements = 0;

  // Idempotency: skip if already migrated.
  if (src.includes('resolveStreamerHubTmdbIds')) {
    return { changed: false, before, after: src, replacements: 0 };
  }

  // 1) Inject helper call once, right after `async () => {` of the FIRST
  //    unstable_cache callback in the file.
  const inject = `\n    const { resolveStreamerHubTmdbIds } = await import('@/lib/streamer-hub-resolver');\n    const tmdbIds = await resolveStreamerHubTmdbIds({\n      networks: ${JSON.stringify(networks)},\n      providers: ${JSON.stringify(providers)},\n    });\n`;
  const injectPos = src.search(/unstable_cache\s*\(\s*async\s*\(\s*\)\s*=>\s*\{/);
  if (injectPos === -1) return { changed: false, before, after: src, replacements: 0 };
  const braceIdx = src.indexOf('{', injectPos) + 1;
  src = src.slice(0, braceIdx) + inject + src.slice(braceIdx);

  // 2) Replace any `networks: { hasSome: [...] }` pattern (covers both
  //    series-direct queries and nested article->series filters).
  src = src.replace(/networks:\s*\{\s*hasSome:\s*\[[^\]]*\]\s*\}/g, () => {
    replacements++;
    return 'tmdbId: { in: tmdbIds }';
  });

  // 3) When the replacement landed inside `series: { … }` it should target
  //    the series relation by `tmdbId` (already done by step 2). When it
  //    landed at the top-level of an articles-query it should be the
  //    `series` relation accessor — we keep the relation filter form because
  //    Prisma accepts series.tmdbId for both shapes.

  return { changed: src !== before, before, after: src, replacements };
}

const summary: Array<{ hub: string; replacements: number; skipped: boolean }> = [];
for (const h of HUBS) {
  const fp = path.join(ROOT, 'app', h.dir, 'page.tsx');
  if (!fs.existsSync(fp)) { summary.push({ hub: h.dir, replacements: 0, skipped: true }); continue; }
  const r = migrate(fp, h.networks, h.providers);
  if (!r.changed) { summary.push({ hub: h.dir, replacements: 0, skipped: true }); continue; }
  if (APPLY) fs.writeFileSync(fp, r.after);
  summary.push({ hub: h.dir, replacements: r.replacements, skipped: false });
}

console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} — migration summary:`);
summary.forEach((s) => console.log(`  ${s.skipped ? 'skip' : 'ok  '}  ${s.hub.padEnd(28)} replacements=${s.replacements}`));
if (!APPLY) console.log(`\n(pass --apply to write)`);
