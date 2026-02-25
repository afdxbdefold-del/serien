#!/usr/bin/env tsx
/**
 * HEADLINE OPTIMIZER CLI
 * 
 * Teste und optimiere Artikel-Überschriften
 * 
 * Usage:
 *   npx tsx scripts/optimize-headline.ts
 */

import { optimizeHeadline } from '../lib/headline-optimizer';

async function main() {
  console.log('🎯 HEADLINE OPTIMIZATION TEST\n');
  console.log('='.repeat(60));

  const testCases = [
    {
      rawContent: 'Netflix hat heute offiziell die Dreharbeiten zur finalen Staffel von Stranger Things beendet. Die fünfte und letzte Staffel wird voraussichtlich 2025 erscheinen. Die Duffer Brothers haben auf Social Media ein emotionales Statement veröffentlicht.',
      originalHeadline: 'Stranger Things: Netflix verkündet Ende der Dreharbeiten für finale Staffel 5!',
      seriesName: 'Stranger Things',
      platform: 'Netflix',
    },
    {
      rawContent: 'Amazon Prime Video hat die Fortsetzung der Videospiel-Adaption Fallout offiziell bestätigt. Die zweite Staffel wird die Geschichte der postapokalyptischen Welt weiter erzählen. Showrunner Jonathan Nolan kündigte an, dass die Produktion noch in diesem Jahr beginnen soll.',
      originalHeadline: 'Fallout Staffel 2: Amazon bestätigt Fortsetzung der erfolgreichen Videospiel-Adaption!',
      seriesName: 'Fallout',
      platform: 'Prime Video',
    },
    {
      rawContent: 'HBO arbeitet an einem Spin-off zur Emmy-prämierten Serie Succession. Das neue Format soll sich auf eine andere Familie im Medien-Imperium konzentrieren. Creator Jesse Armstrong ist als Executive Producer beteiligt.',
      originalHeadline: 'HBO entwickelt Succession Spin-off: Neue Serie in Arbeit!',
      seriesName: 'Succession',
      platform: 'HBO',
    },
  ];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n📰 TEST ${index + 1}/${testCases.length}`);
    console.log('-'.repeat(60));
    console.log(`Serie: ${testCase.seriesName}`);
    console.log(`Plattform: ${testCase.platform}`);
    console.log(`\n❌ ORIGINAL:\n"${testCase.originalHeadline}"`);
    console.log(`   (${testCase.originalHeadline.length} Zeichen)`);

    try {
      const result = await optimizeHeadline(testCase);
      
      console.log(`\n✅ OPTIMIERT:\n"${result.final_headline}"`);
      console.log(`   (${result.final_headline.length} Zeichen)`);

      if (result.alternatives.length > 0) {
        console.log('\n📋 ALTERNATIVEN:');
        result.alternatives.forEach((alt, i) => {
          console.log(`   ${i + 1}. "${alt}" (${alt.length} Zeichen)`);
        });
      }

    } catch (error: any) {
      console.error('❌ ERROR:', error.message);
    }

    console.log('='.repeat(60));
  }

  console.log('\n✨ Fertig!\n');
}

main().catch(console.error);
