#!/usr/bin/env tsx
/**
 * Quick Apify Integration Test
 * Test a small article pipeline run to verify Apify works
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testApifyIntegration() {
  console.log('\n🧪 APIFY INTEGRATION TEST\n');
  console.log('='.repeat(60));

  // Check API token
  const hasToken = !!process.env.APIFY_API_TOKEN;
  console.log(`✓ APIFY_API_TOKEN: ${hasToken ? 'FOUND' : 'MISSING'}`);
  
  if (!hasToken) {
    console.log('❌ No Apify token found. Aborting test.');
    return;
  }

  // Import with dynamic require to see logs
  const { searchFandomCharacter } = await import('../lib/fandom-scraper-apify');

  console.log('\n📡 Testing Apify scraper with sample character...\n');

  // Test with a well-known character from a popular series
  const testCharacter = 'Maddie Nears';
  const testSeries = 'School Spirits';

  console.log(`Character: ${testCharacter}`);
  console.log(`Series: ${testSeries}`);
  console.log('-'.repeat(60));

  const startTime = Date.now();
  
  const result = await searchFandomCharacter(testCharacter, testSeries);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`✓ Found: ${result.found ? 'YES ✅' : 'NO ❌'}`);
  
  if (result.found) {
    console.log(`✓ Name: ${result.name}`);
    console.log(`✓ Source: ${result.source_url}`);
    console.log(`✓ Description: ${result.description ? `${result.description.length} chars` : 'N/A'}`);
    console.log(`✓ Portrayed by: ${result.portrayed_by || 'N/A'}`);
    
    // Check if URL contains "apify" or check logs to determine method used
    console.log('\n💡 Check logs above to see if Apify was used or fallback to browser.');
  }

  await prisma.$disconnect();
}

testApifyIntegration().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
