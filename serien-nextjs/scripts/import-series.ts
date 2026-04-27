/**
 * Import a single series from TMDB by name.
 * Usage: npx tsx scripts/import-series.ts "Crooks"
 */
import { resolveSingleSeries } from '../lib/tmdb-resolver';

const name = process.argv.slice(2).join(' ').trim();
if (!name) {
  console.error('Usage: npx tsx scripts/import-series.ts <series name>');
  process.exit(1);
}

(async () => {
  const result = await resolveSingleSeries(name);
  if (!result) {
    console.log('❌ Could not import.');
    process.exit(1);
  }
  console.log('\nResult:', JSON.stringify(result, null, 2));
})();
