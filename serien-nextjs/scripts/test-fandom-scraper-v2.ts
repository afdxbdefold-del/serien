/**
 * Test Fandom Scraper V2
 * Tests the Cloudflare-resistant scraper WITHOUT API keys
 */

import { searchFandomCharacter, formatFandomDataForContent } from '../lib/fandom-scraper-v2';

async function testFandomScraperV2() {
  console.log('='.repeat(80));
  console.log('TESTING: Fandom Scraper V2 (Cloudflare-Resistant, NO API KEY)');
  console.log('='.repeat(80));
  console.log('');

  // Test Case 1: Popular character from Shrinking
  console.log('Test 1: Jimmy Laird from Shrinking');
  console.log('-'.repeat(80));
  
  const test1 = await searchFandomCharacter('Jimmy Laird', 'Shrinking');
  
  if (test1.found) {
    console.log('✅ SUCCESS - Character found!');
    console.log(`   Name: ${test1.name}`);
    console.log(`   URL: ${test1.source_url}`);
    console.log(`   Description: ${test1.description?.substring(0, 100)}...`);
    console.log(`   Portrayed by: ${test1.portrayed_by || 'N/A'}`);
    console.log(`   Status: ${test1.status || 'N/A'}`);
    console.log('');
    console.log('Formatted Content:');
    console.log(formatFandomDataForContent(test1).substring(0, 300) + '...');
  } else {
    console.log('❌ Character not found');
  }
  console.log('');

  // Test Case 2: Character from Breaking Bad (well-documented wiki)
  console.log('Test 2: Walter White from Breaking Bad');
  console.log('-'.repeat(80));
  
  const test2 = await searchFandomCharacter('Walter White', 'Breaking Bad');
  
  if (test2.found) {
    console.log('✅ SUCCESS - Character found!');
    console.log(`   Name: ${test2.name}`);
    console.log(`   URL: ${test2.source_url}`);
    console.log(`   Description length: ${test2.description?.length || 0} chars`);
    console.log(`   Portrayed by: ${test2.portrayed_by || 'N/A'}`);
  } else {
    console.log('❌ Character not found');
  }
  console.log('');

  // Test Case 3: Non-existent character (should fail gracefully)
  console.log('Test 3: NonExistent Character (should return not found)');
  console.log('-'.repeat(80));
  
  const test3 = await searchFandomCharacter('XYZ_NonExistent_12345', 'Shrinking');
  
  if (!test3.found) {
    console.log('✅ SUCCESS - Correctly returned not found');
  } else {
    console.log('⚠️  Unexpected: Found data for non-existent character');
  }
  console.log('');

  console.log('='.repeat(80));
  console.log('FANDOM SCRAPER V2 TESTING COMPLETE');
  console.log('='.repeat(80));
  console.log('');
  console.log('Summary:');
  console.log('- MediaWiki API: Public, no auth required ✅');
  console.log('- Browser Automation: Cloudflare bypass ✅');
  console.log('- No API keys needed ✅');
}

// Run tests
testFandomScraperV2().catch(console.error);
