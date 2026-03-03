import { importSeriesCast } from '../lib/cast-importer';

async function test() {
  console.log('🎬 Testing Cast Import Fix...\n');
  
  await importSeriesCast(201289);
  
  console.log('\n✅ Done!');
}

test().then(() => process.exit(0)).catch(console.error);
