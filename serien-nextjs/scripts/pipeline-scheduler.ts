/**
 * Content Pipeline Scheduler
 * Runs TVLine and CinemaHolic auto-pipelines on a schedule
 * 
 * Schedule:
 * - TVLine: Every 2 hours at :00 (00:00, 02:00, 04:00, ...)
 * - CinemaHolic: Every 2 hours at :00, offset by 1 hour (01:00, 03:00, 05:00, ...)
 */

import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const LOG_DIR = '/var/log';

/**
 * Run a pipeline script
 */
async function runPipeline(name: string, scriptPath: string, logFile: string) {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${timestamp}] 🚀 Starting ${name} Pipeline`);
  console.log('='.repeat(70));

  try {
    const { stdout, stderr } = await execAsync(
      `cd /app/serien-nextjs && npx tsx ${scriptPath}`,
      { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    );

    // Log output
    const logEntry = `
${'='.repeat(70)}
Timestamp: ${timestamp}
Status: SUCCESS
${'-'.repeat(70)}
${stdout}
${stderr ? `\nErrors:\n${stderr}` : ''}
${'='.repeat(70)}
`;

    await execAsync(`echo "${logEntry.replace(/"/g, '\\"')}" >> ${logFile}`);
    
    console.log(`✅ ${name} Pipeline completed successfully`);
    console.log(`📄 Log: ${logFile}`);

  } catch (error: any) {
    console.error(`❌ ${name} Pipeline failed:`, error.message);
    
    // Log error
    const errorLog = `
${'='.repeat(70)}
Timestamp: ${timestamp}
Status: FAILED
Error: ${error.message}
${'-'.repeat(70)}
${error.stdout || ''}
${error.stderr || ''}
${'='.repeat(70)}
`;

    await execAsync(`echo "${errorLog.replace(/"/g, '\\"')}" >> ${logFile}`);
  }
}

/**
 * Initialize scheduler
 */
function initScheduler() {
  console.log('🕐 Content Pipeline Scheduler Starting...\n');
  console.log('📅 Schedule:');
  console.log('   TVLine:      Every 2 hours at :00 (00:00, 02:00, 04:00, ...)');
  console.log('   CinemaHolic: Every 2 hours at :00, offset +1h (01:00, 03:00, 05:00, ...)');
  console.log('');

  // TVLine: Every 2 hours at :00
  cron.schedule('0 */2 * * *', () => {
    runPipeline(
      'TVLine',
      'scripts/tvline-auto-pipeline.ts',
      `${LOG_DIR}/tvline-pipeline.log`
    );
  }, {
    timezone: 'Europe/Berlin'
  });

  // CinemaHolic: Every 2 hours at :00, offset by 1 hour
  cron.schedule('0 1-23/2 * * *', () => {
    runPipeline(
      'CinemaHolic',
      'scripts/cinemaholic-auto-pipeline.ts',
      `${LOG_DIR}/cinemaholic-pipeline.log`
    );
  }, {
    timezone: 'Europe/Berlin'
  });

  console.log('✅ Scheduler initialized and running');
  console.log('📊 Waiting for scheduled tasks...\n');

  // Log next run times
  const now = new Date();
  const nextTVLineHour = Math.ceil(now.getHours() / 2) * 2;
  const nextCinemaHolicHour = Math.floor((now.getHours() - 1) / 2) * 2 + 1;
  
  console.log('⏰ Next scheduled runs:');
  console.log(`   TVLine:      ${nextTVLineHour}:00`);
  console.log(`   CinemaHolic: ${nextCinemaHolicHour}:00`);
  console.log('');
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n⚠️  Scheduler stopping...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Scheduler stopping...');
  process.exit(0);
});

// Start scheduler
initScheduler();

// Keep the process alive
process.stdin.resume();
