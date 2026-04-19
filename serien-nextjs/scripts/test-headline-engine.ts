/**
 * Smoke-test the v5.1 headline engine on 3 real-world TV topics —
 * one per primary angle bucket — and print the generated headlines.
 *
 *   npx tsx scripts/test-headline-engine.ts
 */
import { generateHeadlines } from '../lib/headline-engine';
import { detectAngle } from '../lib/headline-patterns';

const CASES = [
  {
    label: 'SUCCESS — Fallout 100M viewers',
    input: {
      originalHeadline: 'Fallout reaches 100 million viewers months after finale',
      articleContent: 'Amazon Prime Video\'s hit series Fallout has now crossed 100 million viewers worldwide, months after the first season wrapped. The show continues to dominate Prime Video\'s global top 10 and has renewed interest in Bethesda\'s video game franchise. Prime Video already renewed Fallout for a second season, which is currently in production.',
      seriesName: 'Fallout',
      entities: {
        persons: ['Ella Purnell', 'Walton Goggins'],
        events: ['100 million viewers crossed', 'Season 2 in production'],
        keywords: ['Fallout', 'Prime Video', 'Amazon'],
      },
    },
  },
  {
    label: 'COMEBACK — Tracker S3 finale with Ackles',
    input: {
      originalHeadline: 'Jensen Ackles Returns In First Look At Tracker Season 3 Finale',
      articleContent: 'CBS has released the first image from the Tracker Season 3 finale, confirming that Jensen Ackles will reprise his role as Russell Shaw. The finale airs May 24, 2026. Ackles originally appeared in a 2024 episode and fans have been asking for his return ever since.',
      seriesName: 'Tracker',
      entities: {
        persons: ['Jensen Ackles', 'Justin Hartley'],
        events: ['Jensen Ackles confirmed for finale'],
        keywords: ['Tracker', 'CBS', 'The Boys'],
      },
    },
  },
  {
    label: 'QUALITY_PRAISE — Testaments 95% RT',
    input: {
      originalHeadline: 'Hulu\'s 10/10 Sci-Fi Sequel Is One of the Best New Shows on Streaming',
      articleContent: 'The Testaments, Hulu\'s sequel to The Handmaid\'s Tale, is currently scoring 95% on Rotten Tomatoes and has been praised by critics. Each new episode is drawing higher viewership than its predecessor, and the finale is set for April 30, 2026.',
      seriesName: 'The Testaments',
      entities: {
        persons: ['Ann Dowd'],
        events: ['95% Rotten Tomatoes', 'Finale April 30'],
        keywords: ['The Testaments', 'Hulu'],
      },
    },
  },
  {
    label: 'NOSTALGIA — Mark Harmon called Jack Webb',
    input: {
      originalHeadline: "Mark Harmon's Career Almost Didn't Happen — He Called Jack Webb Directly",
      articleContent: 'Before becoming the face of NCIS, Mark Harmon was a young actor with no real industry contacts. In a recent Parade interview, Harmon revealed that he simply called producer Jack Webb directly, which led to his first big break on the drama series Sam in 1978. Decades later, Harmon would become one of television\'s most iconic leading men, defining NCIS for 19 seasons. The Emmy-winning actor reflected on how a single phone call changed everything and launched a career that has spanned nearly five decades on American television.',
      seriesName: 'Navy CIS',
      entities: {
        persons: ['Mark Harmon', 'Jack Webb'],
        events: ['Called Jack Webb directly', 'First role on Sam 1978'],
        keywords: ['Navy CIS', 'NCIS', 'CBS'],
      },
    },
  },
];

async function main() {
  for (const c of CASES) {
    console.log('\n' + '═'.repeat(72));
    console.log('🎯 ' + c.label);
    console.log(`   Heuristischer Angle: ${detectAngle(c.input.originalHeadline, c.input.articleContent)}`);
    console.log('═'.repeat(72));
    try {
      const res = await generateHeadlines(c.input);
      console.log(`\n✅ Winner: "${res.winner.text}"`);
      console.log(`   Angle: ${res.detectedAngle}  Score: ${res.winner.score}`);
      console.log(`   Banned today: [${res.bannedPhrases.join(', ') || 'none'}]`);
      console.log(`   Alle ${res.allVariants.length} Varianten:`);
      for (const v of res.allVariants) {
        console.log(`     ${v.score.toString().padStart(3)} [${(v.angle || '-').padEnd(14)}] ${v.text}`);
      }
    } catch (e: any) {
      console.error(`❌ ${e.message}`);
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
