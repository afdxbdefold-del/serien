/**
 * AUTOMATIC NEWS SCHEDULER
 * 
 * Runs the multi-source RSS scraper (news-scraper.ts) automatically at
 * regular intervals to import new TV news articles via pipeline-v2.
 *
 * WICHTIG (Aug 2026 Bugfix): Vorher rief dieser Scheduler
 * processScreenrantNews() auf, aber pipeline-v2.ts blockt screenrant.com
 * in WEAK_HOSTS am Pre-LLM-Gate — jeder Lauf wurde also lautlos geblockt
 * (0 echte Publishes, trotz "processed: 1" im Log). Jetzt: processAllNews()
 * mit den Default-Quellen (cinemaholic/deadline/variety/hollywoodreporter/
 * netflixTudum/tvline/googleNewsStreaming), die NICHT in WEAK_HOSTS stehen.
 * 
 * Usage: npx tsx scripts/news-scheduler.ts
 * 
 * Environment:
 *   NEWS_INTERVAL_HOURS - Hours between checks (default: 4)
 *   NEWS_LIMIT - Max articles per run (default: 5)
 */

import 'dotenv/config';
import { processAllNews } from './news-scraper';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const INTERVAL_HOURS = parseInt(process.env.NEWS_INTERVAL_HOURS || '1');
const ARTICLES_PER_RUN = parseInt(process.env.NEWS_LIMIT || '5');
const LOG_FILE = path.join(process.cwd(), 'logs', 'news-scheduler.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  // Also write to log file
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

async function runNewsImport() {
  log('═══════════════════════════════════════════════════════════════');
  log('🗞️  AUTOMATIC NEWS IMPORT STARTING');
  log('═══════════════════════════════════════════════════════════════');
  
  try {
    const result = await processAllNews({
      limit: ARTICLES_PER_RUN,
      dryRun: false,
      onlyNew: true, // Only import articles not already in DB
    });
    
    log(`✅ Import complete: ${result.processed} processed, ${result.published} published, ${result.failed} failed, ${result.skipped} skipped`);
    return result;
  } catch (error: any) {
    log(`❌ Import failed: ${error.message}`);
    return { processed: 0, published: 0, failed: 0, skipped: 0, bySource: {} };
  }
}

async function main() {
  const intervalMs = INTERVAL_HOURS * 60 * 60 * 1000;
  
  log('');
  log('═══════════════════════════════════════════════════════════════');
  log('   📰 NEWS AUTO-SCHEDULER STARTED');
  log('═══════════════════════════════════════════════════════════════');
  log(`   Interval: Every ${INTERVAL_HOURS} hours`);
  log(`   Articles per run: ${ARTICLES_PER_RUN}`);
  log(`   Log file: ${LOG_FILE}`);
  log('═══════════════════════════════════════════════════════════════');
  log('');
  
  // Run immediately on start
  await runNewsImport();
  
  // Then run at intervals
  log(`\n⏰ Next run in ${INTERVAL_HOURS} hours...\n`);
  
  setInterval(async () => {
    await runNewsImport();
    log(`\n⏰ Next run in ${INTERVAL_HOURS} hours...\n`);
  }, intervalMs);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n👋 Scheduler shutting down...');
  process.exit(0);
});

main().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
