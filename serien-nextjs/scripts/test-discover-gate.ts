#!/usr/bin/env tsx
/**
 * DISCOVER GATE CLI
 * 
 * Teste die Google Discover Eligibility für Artikel
 * 
 * Usage:
 *   npx tsx scripts/test-discover-gate.ts
 */

import { discoverGate } from '../lib/discover-gate';

async function main() {
  console.log('🎯 DISCOVER GATE TEST\n');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'PASS: Perfekter Discover-Artikel',
      input: {
        final_headline: 'Fallout erhält zweite Staffel bei Prime Video',
        article_html: `<p>Amazon hat eine zweite Staffel der Serie „Fallout" bestätigt. Die Videospiel-Adaption erhält damit eine Fortsetzung.</p>
<p>Die erste Staffel basierte auf der gleichnamigen Spiele-Reihe. Sie erschien 2024 und markierte den Einstieg ins Serienformat.</p>
<p>Showrunner Jonathan Nolan bleibt der Produktion erhalten. Die Dreharbeiten sollen noch in diesem Jahr beginnen.</p>`,
        hero_image_metadata: {
          url: 'https://image.tmdb.org/t/p/w1920_and_h1080_bestv2/backdrop.jpg',
          width: 1920,
          height: 1080,
          source: 'TMDB_BACKDROP' as const,
        },
        publishedAt: new Date(), // NOW - fresh
        primary_series: 'Fallout',
      },
      expectedEligible: true,
    },
    {
      name: 'FAIL: Clickbait Headline',
      input: {
        final_headline: 'Stranger Things Staffel 5: Das musst du wissen!',
        article_html: `<p>Netflix hat die Dreharbeiten zur finalen Staffel 5 von Stranger Things beendet. Die fünfte Staffel ist die letzte der Serie.</p>
<p>Voraussichtlicher Release: 2025. Die Duffer Brothers haben ein Statement veröffentlicht.</p>
<p>Die Serie lief seit 2016 und wurde zu einer der erfolgreichsten Netflix-Produktionen.</p>`,
        hero_image_metadata: {
          url: 'https://image.tmdb.org/t/p/w1920_and_h1080_bestv2/backdrop.jpg',
          width: 1920,
          height: 1080,
          source: 'TMDB_BACKDROP' as const,
        },
        publishedAt: new Date(),
        primary_series: 'Stranger Things',
      },
      expectedEligible: false,
    },
    {
      name: 'FAIL: Hero Image zu klein',
      input: {
        final_headline: 'Succession erhält Spin-off bei HBO',
        article_html: `<p>HBO arbeitet an einem Spin-off zur Serie Succession. Das neue Format soll sich auf eine andere Familie konzentrieren.</p>
<p>Creator Jesse Armstrong ist als Executive Producer beteiligt. Die Hauptserie endete 2023 nach vier Staffeln.</p>
<p>Ein konkreter Starttermin für das Spin-off liegt noch nicht vor. Weitere Details werden in den kommenden Monaten erwartet.</p>`,
        hero_image_metadata: {
          url: 'https://image.tmdb.org/t/p/w780/poster.jpg',
          width: 780, // TOO SMALL
          height: 1170,
          source: 'TMDB_POSTER' as const,
        },
        publishedAt: new Date(),
        primary_series: 'Succession',
      },
      expectedEligible: false,
    },
    {
      name: 'FAIL: Artikel zu alt (Freshness)',
      input: {
        final_headline: 'The Mandalorian Staffel 4 bestätigt',
        article_html: `<p>Disney+ hat die vierte Staffel von The Mandalorian bestätigt. Die Serie wird die Geschichte von Din Djarin und Grogu weitererzählen.</p>
<p>Showrunner Jon Favreau und Dave Filoni sind erneut beteiligt. Die Produktion soll noch in diesem Jahr beginnen.</p>
<p>Ein konkreter Starttermin liegt noch nicht vor. Weitere Angaben zur Besetzung stehen ebenfalls aus.</p>`,
        hero_image_metadata: {
          url: 'https://image.tmdb.org/t/p/w1920_and_h1080_bestv2/backdrop.jpg',
          width: 1920,
          height: 1080,
          source: 'TMDB_BACKDROP' as const,
        },
        publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago - TOO OLD
        primary_series: 'The Mandalorian',
      },
      expectedEligible: false,
    },
    {
      name: 'FAIL: Leser-Ansprache im Content',
      input: {
        final_headline: 'House of the Dragon Staffel 3 angekündigt',
        article_html: `<p>HBO hat eine dritte Staffel von House of the Dragon angekündigt. Wenn ihr die ersten beiden Staffeln geliebt habt, werdet ihr euch freuen.</p>
<p>Die Serie basiert auf George R.R. Martins „Fire & Blood". Die zweite Staffel erschien 2024 und war ein großer Erfolg.</p>
<p>Wir halten euch auf dem Laufenden, sobald weitere Details bekannt werden. Bleibt dran!</p>`,
        hero_image_metadata: {
          url: 'https://image.tmdb.org/t/p/w1920_and_h1080_bestv2/backdrop.jpg',
          width: 1920,
          height: 1080,
          source: 'TMDB_BACKDROP' as const,
        },
        publishedAt: new Date(),
        primary_series: 'House of the Dragon',
      },
      expectedEligible: false,
    },
  ];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n🧪 TEST ${index + 1}/${testCases.length}: ${testCase.name}`);
    console.log('-'.repeat(70));
    console.log(`Serie: ${testCase.input.primary_series}`);
    console.log(`Headline: ${testCase.input.final_headline}`);
    console.log(`Image: ${testCase.input.hero_image_metadata.width}x${testCase.input.hero_image_metadata.height}px (${testCase.input.hero_image_metadata.source})`);
    
    const hoursAgo = Math.floor((Date.now() - testCase.input.publishedAt.getTime()) / (60 * 60 * 1000));
    console.log(`Published: ${hoursAgo === 0 ? 'NOW' : `${hoursAgo}h ago`}`);
    console.log(`Erwarteter Status: ${testCase.expectedEligible ? '✅ ELIGIBLE' : '❌ NOT ELIGIBLE'}\n`);

    try {
      const result = await discoverGate(testCase.input);
      
      console.log(`📊 RESULT: ${result.discover_eligible ? '✅ DISCOVER ELIGIBLE' : '❌ NOT ELIGIBLE'}`);
      console.log(`\n🎯 Scores:`);
      console.log(`   Headline Quality: ${result.scores.headline_quality}/10`);
      console.log(`   Image Quality:    ${result.scores.image_quality}/10`);
      console.log(`   Content Trust:    ${result.scores.content_trust}/10`);
      console.log(`   Freshness:        ${result.scores.freshness}/10`);
      console.log(`   ─────────────────────────────`);
      console.log(`   Total:            ${result.scores.total}/40`);

      if (result.fail_reasons.length > 0) {
        console.log(`\n❌ Fail Reasons (${result.fail_reasons.length}):`);
        result.fail_reasons.forEach((reason, i) => {
          console.log(`   ${i + 1}. ${reason}`);
        });
      }

      if (result.auto_rewrite_recommended) {
        console.log(`\n🔄 Auto-Rewrite empfohlen (Score: ${result.scores.total}/40, nah am Limit)`);
      }

      // Validation
      const matchesExpected = result.discover_eligible === testCase.expectedEligible;
      if (matchesExpected) {
        console.log(`\n✅ Test bestanden: Eligibility matched expected`);
      } else {
        console.log(`\n⚠️  Test-Abweichung: Erwartet ${testCase.expectedEligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}, bekommen ${result.discover_eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
      }

    } catch (error: any) {
      console.error('❌ ERROR:', error.message);
    }

    console.log('='.repeat(70));
  }

  console.log('\n✨ Fertig!\n');
}

main().catch(console.error);
