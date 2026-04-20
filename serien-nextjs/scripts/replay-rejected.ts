/**
 * Replay rejected articles through pipeline-v2 (now with claude-sonnet-4-6).
 * Reads URLs from /tmp/failed_urls.txt, one per line.
 * Runs sequentially, skipping any that already ended up published.
 * Logs progress to /tmp/replay_progress.log
 */
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { runPipelineV2 } from './pipeline-v2';

const prisma = new PrismaClient();
const LOG = '/tmp/replay_progress.log';

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG, line + '\n');
}

(async () => {
  const urls = fs
    .readFileSync('/tmp/failed_urls.txt', 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  log(`==== REPLAY START: ${urls.length} URLs ====`);

  let published = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const prefix = `[${i + 1}/${urls.length}]`;

    // Skip if already published (e.g. covered via a later successful run)
    const existing = await prisma.articles.findFirst({
      where: { sourceUrl: url, status: 'published' },
      select: { slug: true },
    });
    if (existing) {
      log(`${prefix} SKIP already-published: ${url} (slug: ${existing.slug})`);
      skipped++;
      continue;
    }

    log(`${prefix} START: ${url}`);
    try {
      await runPipelineV2({
        title: 'Replay',
        url,
        text: '',
        useFullTextMode: true,
        trigger: 'manual',
      } as any);
      // Verify via DB whether it ended up published
      const a = await prisma.articles.findFirst({
        where: { sourceUrl: url, status: 'published' },
        select: { slug: true },
      });
      if (a) {
        log(`${prefix} ✅ PUBLISHED: ${a.slug}`);
        published++;
      } else {
        log(`${prefix} ⚠️ NO PUBLISH (skipped by pipeline rules)`);
        failed++;
      }
    } catch (e: any) {
      log(`${prefix} ❌ ERROR: ${e.message?.slice(0, 160)}`);
      failed++;
    }

    // small pacing between runs to be gentle on Claude/TMDB
    await new Promise(r => setTimeout(r, 1500));
  }

  log(`==== REPLAY DONE ====`);
  log(`Published: ${published} | Skipped (already live): ${skipped} | Failed: ${failed}`);
  await prisma.$disconnect();
})();
