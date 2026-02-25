#!/usr/bin/env tsx
/**
 * QUALITY CHECKER CLI
 * 
 * Teste die Qualitätsprüfung für Artikel vor Veröffentlichung
 * 
 * Usage:
 *   npx tsx scripts/test-quality-checker.ts
 */

import { qualityCheck } from '../lib/quality-checker';

async function main() {
  console.log('✅ QUALITY CHECKER TEST\n');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'PASS: Sauberer serienjunkies.de Stil',
      input: {
        generatedArticleHtml: `<p>Amazon hat eine zweite Staffel der Serie „Fallout" bestätigt. Die Videospiel-Adaption erhält damit eine Fortsetzung nach dem Start der ersten Staffel im Jahr 2024.</p>
<p>Die erste Staffel basierte auf der gleichnamigen Spiele-Reihe und verlegte deren postapokalyptische Welt ins Serienformat. Sie erschien 2024 und markierte den Einstieg des Franchise in die Realserie.</p>
<p>Showrunner Jonathan Nolan bleibt der Produktion erhalten. Die Dreharbeiten zur zweiten Staffel sollen noch in diesem Jahr beginnen.</p>
<p>Ein konkreter Starttermin für Staffel zwei liegt noch nicht vor. Weitere Angaben zu Besetzung und Umfang der neuen Episoden stehen ebenfalls aus.</p>`,
        finalHeadline: 'Fallout erhält zweite Staffel bei Prime Video',
        primarySeriesName: 'Fallout',
        platform: 'Prime Video',
      },
      expectedStatus: 'PASS',
    },
    {
      name: 'FAIL: Hype-Wörter und Marketing-Ton',
      input: {
        generatedArticleHtml: `<p>Die erfolgreiche Hit-Serie Stranger Things bekommt endlich ihre finale Staffel! Fans dürfen sich freuen: Netflix hat offiziell die Dreharbeiten beendet.</p>
<p>Die fünfte und letzte Staffel der beliebten Serie wird voraussichtlich 2025 erscheinen und verspricht ein emotionales und dramatisches Finale. Die Duffer Brothers haben ein riesiges Statement auf Social Media veröffentlicht.</p>
<p>Die spannende Serie lief seit 2016 und wurde zu einer der erfolgreichsten Netflix-Produktionen aller Zeiten. Wir sind mega gespannt auf das Finale!</p>`,
        finalHeadline: 'Stranger Things Staffel 5: Netflix verkündet offiziell das Ende der Dreharbeiten!',
        primarySeriesName: 'Stranger Things',
        platform: 'Netflix',
      },
      expectedStatus: 'FAIL',
    },
    {
      name: 'FAIL: Leser-Ansprache',
      input: {
        generatedArticleHtml: `<p>HBO arbeitet an einem Spin-off zur Serie Succession. Wenn ihr die Hauptserie geliebt habt, werdet ihr euch über diese Neuigkeit freuen.</p>
<p>Das neue Format soll sich auf eine andere Familie im Medien-Imperium konzentrieren. Creator Jesse Armstrong ist als Executive Producer beteiligt, also könnt ihr euch auf hohe Qualität verlassen.</p>
<p>Wir halten euch auf dem Laufenden, sobald weitere Details bekannt werden. Bleibt dran!</p>`,
        finalHeadline: 'HBO entwickelt Succession Spin-off',
        primarySeriesName: 'Succession',
        platform: 'HBO',
      },
      expectedStatus: 'FAIL',
    },
    {
      name: 'FAIL: Zu lange Absätze und Überschrift',
      input: {
        generatedArticleHtml: `<p>Disney+ hat die Fortsetzung der Star Wars-Serie The Mandalorian bestätigt. Die vierte Staffel wird die Geschichte von Din Djarin und Grogu weitererzählen. Die dritte Staffel endete mit einem großen Cliffhanger und Fans warten gespannt auf die Auflösung. Showrunner Jon Favreau und Dave Filoni sind erneut beteiligt. Die Produktion soll noch in diesem Jahr beginnen und die Ausstrahlung ist für 2026 geplant.</p>
<p>The Mandalorian startete 2019 und wurde zur erfolgreichsten Star Wars-Serie auf Disney+.</p>`,
        finalHeadline: 'The Mandalorian Staffel 4: Disney+ bestätigt offiziell die Fortsetzung der beliebten Star Wars-Serie mit Din Djarin und Grogu',
        primarySeriesName: 'The Mandalorian',
        platform: 'Disney+',
      },
      expectedStatus: 'FAIL',
    },
  ];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n🧪 TEST ${index + 1}/${testCases.length}: ${testCase.name}`);
    console.log('-'.repeat(70));
    console.log(`Serie: ${testCase.input.primarySeriesName}`);
    console.log(`Plattform: ${testCase.input.platform}`);
    console.log(`Erwarteter Status: ${testCase.expectedStatus}\n`);

    try {
      const result = await qualityCheck(testCase.input);
      
      console.log(`📊 RESULT: ${result.status}`);
      console.log(`\n🎯 Scores:`);
      console.log(`   Style:           ${result.scores.style}/10`);
      console.log(`   Clarity:         ${result.scores.clarity}/10`);
      console.log(`   Readability:     ${result.scores.readability}/10`);
      console.log(`   Trustworthiness: ${result.scores.trustworthiness}/10`);
      console.log(`   ─────────────────────────────`);
      console.log(`   Total:           ${result.scores.total}/40`);

      if (result.failReasons.length > 0) {
        console.log(`\n❌ Fail Reasons (${result.failReasons.length}):`);
        result.failReasons.forEach((reason, i) => {
          console.log(`   ${i + 1}. ${reason}`);
        });
      }

      if (result.autoRewriteRecommended) {
        console.log(`\n🔄 Auto-Rewrite empfohlen (Score: ${result.scores.total}/40, nah am Limit)`);
      }

      // Validation
      const matchesExpected = result.status === testCase.expectedStatus;
      if (matchesExpected) {
        console.log(`\n✅ Test bestanden: Status matched expected`);
      } else {
        console.log(`\n⚠️  Test-Abweichung: Erwartet ${testCase.expectedStatus}, bekommen ${result.status}`);
      }

    } catch (error: any) {
      console.error('❌ ERROR:', error.message);
    }

    console.log('='.repeat(70));
  }

  console.log('\n✨ Fertig!\n');
}

main().catch(console.error);
