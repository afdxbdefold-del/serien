/* eslint-disable */
/**
 * Bulk-migrate streamer hub pages to use the new resolveStreamerHubTmdbIds()
 * resolver. Adds tmdbIds resolution at the start of each unstable_cache fn,
 * then rewrites both `networks: { has: 'X' }` and `networks: { hasSome: [...] }`
 * patterns to `tmdbId: { in: tmdbIds }`. Idempotent: skips files already
 * importing the resolver.
 *
 * Usage:
 *   npx tsx scripts/migrate-streamer-hubs.ts           # dry-run
 *   npx tsx scripts/migrate-streamer-hubs.ts --apply   # writes
 */
import fs from 'fs';
import path from 'path';

const HUBS: Array<{ dir: string; networks: string[]; providers: string[] }> = [
  // Already migrated batch — kept for idempotency / re-runs.
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

  // Remaining 7 — Netflix/Disney/Prime/Chili/Maxdome/Freenet/Rakuten.
  { dir: 'netflix-serien',       networks: ['Netflix'], providers: ['Netflix'] },
  { dir: 'disney-plus-serien',   networks: ['Disney+','Disney Plus'], providers: ['Disney+','Disney Plus'] },
  { dir: 'prime-video-serien',   networks: ['Prime Video','Amazon','Amazon Prime Video'], providers: ['Amazon Prime Video','Prime Video'] },
  { dir: 'chili-serien',         networks: ['CHILI','Chili'], providers: ['CHILI','Chili'] },
  { dir: 'maxdome-serien',       networks: ['Maxdome','maxdome'], providers: ['Maxdome','maxdome'] },
  { dir: 'freenet-video-serien', networks: ['freenet Video','freenet','Freenet','Freenet Video'], providers: ['freenet Video','Freenet Video','freenet'] },
  { dir: 'rakuten-tv-serien',    networks: ['Rakuten TV','Rakuten','Rakuten Viki'], providers: ['Rakuten TV','Rakuten'] },
];

const APPLY = process.argv.includes('--apply');
const ROOT = '/app/serien-nextjs';

function migrate(filePath: string, networks: string[], providers: string[]): { changed: boolean; before: string; after: string; replacements: number } {
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;
  let replacements = 0;

  // Idempotency
  if (src.includes('resolveStreamerHubTmdbIds')) {
    return { changed: false, before, after: src, replacements: 0 };
  }

  // 1) Inject resolver call right after `async () => {` of unstable_cache callback.
  const inject =
    `\n    // Combo: TMDB origin networks ∪ streaming_releases.provider (DE).\n` +
    `    // See lib/streamer-hub-resolver.ts.\n` +
    `    const { resolveStreamerHubTmdbIds } = await import('@/lib/streamer-hub-resolver');\n` +
    `    const tmdbIds = await resolveStreamerHubTmdbIds({\n` +
    `      networks: ${JSON.stringify(networks)},\n` +
    `      providers: ${JSON.stringify(providers)},\n` +
    `    });\n`;
  const injectPos = src.search(/unstable_cache\s*\(\s*\n?\s*async\s*\(\s*\)\s*=>\s*\{/);
  if (injectPos === -1) return { changed: false, before, after: src, replacements: 0 };
  const braceIdx = src.indexOf('{', injectPos) + 1;
  src = src.slice(0, braceIdx) + inject + src.slice(braceIdx);

  // 2) Replace nested `series: { networks: { ... } }` blocks (articles queries)
  //    so we use the direct `primarySeriesId` column instead of a JOIN.
  src = src.replace(
    /series:\s*\{\s*\n\s*networks:\s*\{\s*(?:has|hasSome):\s*[^}]+\}\s*\n\s*\}/g,
    () => {
      replacements++;
      return 'primarySeriesId: { in: tmdbIds }';
    }
  );

  // 3) Replace any remaining `networks: { has: 'X' }` or `networks: { hasSome: [...] }`
  //    (top-level series.findMany queries).
  src = src.replace(/networks:\s*\{\s*has:\s*'[^']+'\s*\}/g, () => {
    replacements++;
    return 'tmdbId: { in: tmdbIds }';
  });
  src = src.replace(/networks:\s*\{\s*has:\s*"[^"]+"\s*\}/g, () => {
    replacements++;
    return 'tmdbId: { in: tmdbIds }';
  });
  src = src.replace(/networks:\s*\{\s*hasSome:\s*\[[^\]]*\]\s*\}/g, () => {
    replacements++;
    return 'tmdbId: { in: tmdbIds }';
  });

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
