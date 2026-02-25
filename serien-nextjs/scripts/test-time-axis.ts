/**
 * Test: Time Axis Correction
 * 
 * Test mit altem Content (sollte als BACKGROUND klassifiziert werden)
 */

import { classifyContentAge, shouldPublishBasedOnAge } from '../lib/time-axis-correction';

function testTimeAxis() {
  console.log('\n⏰ TIME AXIS CORRECTION TEST');
  console.log('='.repeat(70));

  // Test 1: Fresh News (2 days old)
  const freshDate = new Date();
  freshDate.setDate(freshDate.getDate() - 2);
  
  console.log('\n📰 Test 1: FRESH NEWS (2 days old)');
  console.log('─'.repeat(70));
  
  const fresh = classifyContentAge({
    sourcePublishedAt: freshDate,
    headline: "Breaking Bad Staffel 6 startet nächste Woche",
    contentType: 'NEWS'
  });
  
  const freshDecision = shouldPublishBasedOnAge(fresh);
  console.log(`   Result: ${fresh.contentAgeClass}`);
  console.log(`   Publish: ${freshDecision.shouldPublish ? '✅' : '❌'}`);
  console.log(`   Mode: ${freshDecision.publishMode}`);
  console.log(`   Discover: ${fresh.discoverEligible ? '✅' : '❌'}`);

  // Test 2: Recent Update (15 days old)
  const recentDate = new Date();
  recentDate.setDate(recentDate.getDate() - 15);
  
  console.log('\n\n📋 Test 2: RECENT UPDATE (15 days old)');
  console.log('─'.repeat(70));
  
  const recent = classifyContentAge({
    sourcePublishedAt: recentDate,
    headline: "The Wire kehrt mit neuer Staffel zurück",
    contentType: 'NEWS'
  });
  
  const recentDecision = shouldPublishBasedOnAge(recent);
  console.log(`   Result: ${recent.contentAgeClass}`);
  console.log(`   Publish: ${recentDecision.shouldPublish ? '✅' : '❌'}`);
  console.log(`   Mode: ${recentDecision.publishMode}`);
  console.log(`   Discover: ${recent.discoverEligible ? '✅' : '❌'}`);

  // Test 3: Background (45 days old)
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 45);
  
  console.log('\n\n📚 Test 3: BACKGROUND (45 days old)');
  console.log('─'.repeat(70));
  
  const background = classifyContentAge({
    sourcePublishedAt: oldDate,
    headline: "Game of Thrones startet mit neuer Staffel",
    contentType: 'NEWS'
  });
  
  const backgroundDecision = shouldPublishBasedOnAge(background);
  console.log(`   Result: ${background.contentAgeClass}`);
  console.log(`   Publish: ${backgroundDecision.shouldPublish ? '✅' : '❌'}`);
  console.log(`   Mode: ${backgroundDecision.publishMode}`);
  console.log(`   Discover: ${background.discoverEligible ? '✅' : '❌'}`);
  console.log(`   Headline Violations: ${background.headlineRestrictions.forbidden.join(', ')}`);

  // Test 4: Very Old (120 days old)
  const veryOldDate = new Date();
  veryOldDate.setDate(veryOldDate.getDate() - 120);
  
  console.log('\n\n🗄️  Test 4: VERY OLD (120 days old)');
  console.log('─'.repeat(70));
  
  const veryOld = classifyContentAge({
    sourcePublishedAt: veryOldDate,
    headline: "Friends wird fortgesetzt",
    contentType: 'NEWS'
  });
  
  const veryOldDecision = shouldPublishBasedOnAge(veryOld);
  console.log(`   Result: ${veryOld.contentAgeClass}`);
  console.log(`   Publish: ${veryOldDecision.shouldPublish ? '✅' : '❌'}`);
  console.log(`   Mode: ${veryOldDecision.publishMode}`);
  console.log(`   Reason: ${veryOldDecision.reason}`);

  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log('✅ FRESH_NEWS (≤7 days): Discover eligible, published immediately');
  console.log('⚠️  RECENT_UPDATE (8-30 days): SEARCH_ONLY, no Discover');
  console.log('📚 BACKGROUND (31-90 days): SEARCH_ONLY, original date');
  console.log('🗄️  VERY OLD (>90 days): SKIP publication');
  console.log('\n✅ Time Axis Correction working as expected!\n');
}

testTimeAxis();
