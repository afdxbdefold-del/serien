import { importSeriesCast } from '../lib/cast-importer';

async function main() {
  const seriesId = parseInt(process.argv[2] || '129552');
  console.log(`Importing cast for series ${seriesId}...`);
  
  const count = await importSeriesCast(seriesId);
  console.log(`\n✅ Done! Imported ${count} new cast members.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
