#!/usr/bin/env tsx
/**
 * ARTICLE STYLE REWRITER CLI
 * 
 * Teste das Style-Rewriting für journalistische Artikel
 * 
 * Usage:
 *   npx tsx scripts/test-style-rewriter.ts
 */

import { rewriteArticleStyle } from '../lib/article-style-rewriter';

async function main() {
  console.log('📝 ARTICLE STYLE REWRITER TEST\n');
  console.log('='.repeat(70));

  const testCases = [
    {
      name: 'Staffel-Bestätigung',
      input: {
        extractedFacts: `- Amazon hat eine zweite Staffel von Fallout bestätigt
- Die erste Staffel war eine Videospiel-Adaption
- Showrunner Jonathan Nolan ist beteiligt
- Produktion beginnt noch in diesem Jahr
- Die erste Staffel startete 2024`,
        seriesName: 'Fallout',
        platform: 'Prime Video',
        eventType: 'renewal' as const,
      },
    },
    {
      name: 'Dreharbeiten beendet',
      input: {
        extractedFacts: `- Netflix hat die Dreharbeiten zur finalen Staffel 5 von Stranger Things beendet
- Die fünfte Staffel ist die letzte der Serie
- Voraussichtlicher Release: 2025
- Die Duffer Brothers haben ein Statement veröffentlicht
- Die Serie lief seit 2016`,
        seriesName: 'Stranger Things',
        platform: 'Netflix',
        eventType: 'production' as const,
      },
    },
    {
      name: 'Spin-off Ankündigung',
      input: {
        extractedFacts: `- HBO arbeitet an einem Succession Spin-off
- Fokus auf eine andere Familie im Medien-Imperium
- Creator Jesse Armstrong ist als Executive Producer beteiligt
- Succession gewann mehrere Emmys
- Die Hauptserie endete 2023`,
        seriesName: 'Succession',
        platform: 'HBO',
        eventType: 'other' as const,
      },
    },
  ];

  for (const [index, testCase] of testCases.entries()) {
    console.log(`\n📰 TEST ${index + 1}/${testCases.length}: ${testCase.name}`);
    console.log('-'.repeat(70));
    console.log(`Serie: ${testCase.input.seriesName}`);
    console.log(`Plattform: ${testCase.input.platform}`);
    console.log(`Event: ${testCase.input.eventType}\n`);

    try {
      const result = await rewriteArticleStyle(testCase.input);
      
      console.log('✅ UMGESCHRIEBENER ARTIKEL:\n');
      
      // Pretty print HTML
      const paragraphs = result.match(/<p>(.*?)<\/p>/g) || [];
      paragraphs.forEach((p, i) => {
        const text = p.replace(/<\/?p>/g, '');
        console.log(`[Absatz ${i + 1}]`);
        console.log(text);
        console.log();
      });

      // Stats
      const wordCount = result.replace(/<[^>]*>/g, '').split(/\s+/).length;
      const paraCount = paragraphs.length;
      console.log(`📊 Stats: ${paraCount} Absätze, ${wordCount} Wörter`);

    } catch (error: any) {
      console.error('❌ ERROR:', error.message);
    }

    console.log('='.repeat(70));
  }

  console.log('\n✨ Fertig!\n');
}

main().catch(console.error);
