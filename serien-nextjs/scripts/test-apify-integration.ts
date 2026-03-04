import { searchFandomCharacter } from '../lib/fandom-scraper-apify';

async function test() {
  console.log('🧪 Testing Apify Integration...\n');
  console.log('API Token:', process.env.APIFY_API_TOKEN ? '✅ Set' : '❌ Missing');
  
  console.log('\n🔍 Searching for character...');
  const result = await searchFandomCharacter('Maddie Nears', 'School Spirits');
  
  console.log('\n📊 Result:');
  console.log('   Found:', result.found);
  if (result.found) {
    console.log('   Name:', result.name);
    console.log('   Description:', result.description?.substring(0, 100) + '...');
    console.log('   Source:', result.source_url);
    console.log('\n✅ Apify is working!');
  } else {
    console.log('   ⚠️  Character not found');
  }
}

test().then(() => process.exit(0)).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
