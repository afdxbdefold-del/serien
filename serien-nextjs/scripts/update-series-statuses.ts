#!/usr/bin/env tsx
/**
 * SERIES STATUS UPDATER - Daily Cron Job
 * 
 * Updates all series statuses once per day
 * 
 * Usage:
 *   npx tsx scripts/update-series-statuses.ts
 * 
 * Cron:
 *   0 4 * * * cd /app/serien-nextjs && npx tsx scripts/update-series-statuses.ts
 */

import { updateAllSeriesStatuses } from '../lib/series-status-tracker';

async function main() {
  console.log('🚀 Starting series status update...\n');
  
  const startTime = Date.now();
  
  try {
    await updateAllSeriesStatuses();
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Completed in ${duration}s`);
    
  } catch (error: any) {
    console.error('\n❌ Failed:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
