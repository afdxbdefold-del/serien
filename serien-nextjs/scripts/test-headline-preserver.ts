/**
 * TESTS for Headline Preserver
 */

import { preserveHeadline } from '../lib/headline-preserver';

interface TestCase {
  name: string;
  sourceTitle: string;
  facts: {
    renewalStatus: 'RENEWED' | 'NOT_RENEWED' | 'UNKNOWN';
    seasonMentioned: number | null;
    keyClaim: string;
    entities: {
      seriesNames: string[];
      peopleNames: string[];
      platforms: string[];
    };
  };
  expectedMode: string;
  expectedPattern?: RegExp;
  shouldContain?: string[];
  shouldNotContain?: string[];
}

const testCases: TestCase[] = [
  // TEST 1: English title -> translated, series name preserved
  {
    name: 'TEST 1: English title translation with series name protection',
    sourceTitle: 'Tell Me Lies Season 4 Confirmed by Hulu',
    facts: {
      renewalStatus: 'RENEWED',
      seasonMentioned: 4,
      keyClaim: 'Hulu confirms Tell Me Lies Season 4',
      entities: {
        seriesNames: ['Tell Me Lies'],
        peopleNames: [],
        platforms: ['Hulu'],
      },
    },
    expectedMode: 'TRANSLATED',
    shouldContain: ['Tell Me Lies', 'Staffel 4'],
    shouldNotContain: ['Season'],
  },

  // TEST 2: NOT_RENEWED contradiction
  {
    name: 'TEST 2: NOT_RENEWED contradiction - "Staffel 4" when cancelled',
    sourceTitle: 'Tell Me Lies Staffel 4',
    facts: {
      renewalStatus: 'NOT_RENEWED',
      seasonMentioned: 3,
      keyClaim: 'Show cancelled after season 3',
      entities: {
        seriesNames: ['Tell Me Lies'],
        peopleNames: [],
        platforms: ['Hulu'],
      },
    },
    expectedMode: 'MIN_FIX',
    shouldContain: ['endet', 'keine Staffel 4'],
    shouldNotContain: ['Staffel 4 kommt', 'bestätigt'],
  },

  // TEST 3: UNKNOWN with false certainty
  {
    name: 'TEST 3: UNKNOWN - remove "bestätigt" when not confirmed',
    sourceTitle: 'Fallout Staffel 2 offiziell bestätigt',
    facts: {
      renewalStatus: 'UNKNOWN',
      seasonMentioned: 2,
      keyClaim: 'No official confirmation yet',
      entities: {
        seriesNames: ['Fallout'],
        peopleNames: [],
        platforms: ['Prime Video'],
      },
    },
    expectedMode: 'MIN_FIX',
    shouldContain: ['noch nicht', 'Fallout'],
    shouldNotContain: ['offiziell bestätigt'],
  },

  // TEST 4: Clickbait removal
  {
    name: 'TEST 4: Remove clickbait tokens',
    sourceTitle: 'Mega-News: Stranger Things Staffel 5 endlich bestätigt!',
    facts: {
      renewalStatus: 'RENEWED',
      seasonMentioned: 5,
      keyClaim: 'Season 5 confirmed',
      entities: {
        seriesNames: ['Stranger Things'],
        peopleNames: [],
        platforms: ['Netflix'],
      },
    },
    expectedMode: 'MIN_FIX',
    shouldContain: ['Stranger Things', 'Staffel 5'],
    shouldNotContain: ['Mega-', 'endlich'],
  },

  // TEST 5: Clean-up branding
  {
    name: 'TEST 5: Remove source branding',
    sourceTitle: 'The Witcher Staffel 4 angekündigt - TVLine',
    facts: {
      renewalStatus: 'RENEWED',
      seasonMentioned: 4,
      keyClaim: 'Season 4 announced',
      entities: {
        seriesNames: ['The Witcher'],
        peopleNames: [],
        platforms: ['Netflix'],
      },
    },
    expectedMode: 'PRESERVED',
    shouldContain: ['The Witcher', 'Staffel 4'],
    shouldNotContain: ['TVLine'],
  },

  // TEST 6: Season number correction
  {
    name: 'TEST 6: Correct season number mismatch',
    sourceTitle: 'Breaking Bad Staffel 6 kommt',
    facts: {
      renewalStatus: 'RENEWED',
      seasonMentioned: 5,
      keyClaim: 'Season 5 confirmed',
      entities: {
        seriesNames: ['Breaking Bad'],
        peopleNames: [],
        platforms: ['AMC'],
      },
    },
    expectedMode: 'MIN_FIX',
    shouldContain: ['Staffel 5'],
    shouldNotContain: ['Staffel 6'],
  },
];

async function runTests() {
  console.log('🧪 RUNNING HEADLINE PRESERVER TESTS\n');
  console.log('='.repeat(70));
  
  let passed = 0;
  let failed = 0;

  for (const test of testCases) {
    console.log(`\n📝 ${test.name}`);
    console.log(`   Input: "${test.sourceTitle}"`);
    console.log(`   Facts: ${test.facts.renewalStatus}, Season ${test.facts.seasonMentioned}`);
    
    try {
      const result = await preserveHeadline(test.sourceTitle, test.facts);
      
      console.log(`   Output: "${result.final}"`);
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Reason: ${result.reason}`);
      
      // Check mode
      let testPassed = true;
      if (result.mode !== test.expectedMode) {
        console.log(`   ❌ Expected mode: ${test.expectedMode}, got: ${result.mode}`);
        testPassed = false;
      }
      
      // Check shouldContain
      if (test.shouldContain) {
        for (const token of test.shouldContain) {
          if (!result.final.includes(token)) {
            console.log(`   ❌ Should contain: "${token}"`);
            testPassed = false;
          }
        }
      }
      
      // Check shouldNotContain
      if (test.shouldNotContain) {
        for (const token of test.shouldNotContain) {
          if (result.final.includes(token)) {
            console.log(`   ❌ Should NOT contain: "${token}"`);
            testPassed = false;
          }
        }
      }
      
      // Check pattern
      if (test.expectedPattern && !test.expectedPattern.test(result.final)) {
        console.log(`   ❌ Does not match pattern: ${test.expectedPattern}`);
        testPassed = false;
      }
      
      if (testPassed) {
        console.log(`   ✅ PASSED`);
        passed++;
      } else {
        failed++;
      }
      
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`\n📊 TEST RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

runTests().catch(console.error);
