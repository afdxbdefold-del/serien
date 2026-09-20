/** Optional standalone worker. Production normally uses Coolify /api/cron/news. */
import 'dotenv/config';
import { setTimeout as delay } from 'node:timers/promises';
import { processAllNews } from './news-scraper';
import { DEFAULT_NEWS_BUDGET_MS, DEFAULT_NEWS_LIMIT, positiveInteger, safeNewsError } from '../lib/news-import-reliability';

const intervalHours = positiveInteger(process.env.NEWS_INTERVAL_HOURS, 1, 24);
const articleLimit = positiveInteger(process.env.NEWS_LIMIT, DEFAULT_NEWS_LIMIT, 20);
const budgetMs = positiveInteger(process.env.NEWS_RUN_BUDGET_MS, DEFAULT_NEWS_BUDGET_MS, 600_000);
const shutdown = new AbortController();

function log(message: string) {
  // Container/stdout logging handles retention; avoid an unbounded local file.
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export async function main() {
  log(`News worker started: every ${intervalHours} hours, at most ${articleLimit} candidates`);
  while (!shutdown.signal.aborted) {
    try {
      // Same pause switch, distributed lease and real publication counters as
      // the HTTP cron. The next interval begins AFTER the previous run finishes.
      const result = await processAllNews({ limit: articleLimit, maxRunMs: budgetMs, onlyNew: true });
      if (result.skipReason) log(`News import skipped: ${result.skipReason}`);
      else log(`News import: ${result.published} published, ${result.drafted} drafts, ${result.failed} failed, ${result.sourceErrors} source failures, ${result.deferred} deferred`);
    } catch (error) {
      log(safeNewsError(error));
    }
    if (!shutdown.signal.aborted) {
      await delay(intervalHours * 60 * 60_000, undefined, { signal: shutdown.signal }).catch((error) => {
        if (error?.name !== 'AbortError') throw error;
      });
    }
  }
  log('News worker stopped after completing the active import');
}

if (require.main === module) {
  const stop = () => { log('Stopping after the active import'); shutdown.abort(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  main().then(() => process.exit(0)).catch((error) => {
    log(safeNewsError(error));
    process.exit(1);
  });
}
