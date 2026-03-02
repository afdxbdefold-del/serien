/**
 * Quick Test: Verify new Fandom Scraper works
 */

import { searchFandomCharacter } from '../lib/fandom-scraper';

async function quickTest() {
  console.log('Testing new fandom-scraper.ts (V2)...\n');
  
  const result = await searchFandomCharacter('Jimmy Laird', 'Shrinking');
  
  if (result.found) {
    console.log('✅ SUCCESS - New scraper works!');
    console.log(`   Name: ${result.name}`);
    console.log(`   URL: ${result.source_url}`);
    console.log(`   Portrayed by: ${result.portrayed_by}`);
  } else {
    console.log('❌ FAILED - Character not found');
  }
}

quickTest().catch(console.error);
