/**
 * TEST: MULTI_SERIES_EDITORIAL Pipeline
 * 
 * Tests the pipeline with a list-style article mentioning multiple series
 */

import { runContentPipeline } from './pipeline-v1';

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

async function main() {
  // Test Article: Top 5 Sci-Fi Series 2026
  const testArticle: CrawledSource = {
    title: "Die 5 besten Sci-Fi-Serien 2026",
    url: "https://example.com/top-5-scifi-2026-" + Date.now(),
    text: `
      Die besten Science-Fiction-Serien des Jahres 2026 im Überblick.
      
      Stranger Things kehrt mit der finalen Staffel 5 zurück. Netflix setzt die beliebte Mystery-Serie fort. 
      Die Duffer Brothers schließen die Geschichte ab.
      
      The Mandalorian startet Staffel 4 auf Disney+. Pedro Pascal kehrt als Kopfgeldjäger zurück.
      Jon Favreau bleibt als Showrunner an Bord.
      
      Foundation wird mit Staffel 3 bei Apple TV+ fortgesetzt. Die Isaac-Asimov-Adaption geht weiter.
      Jared Harris spielt weiterhin Hari Seldon.
      
      The Expanse bekommt ein Revival bei Amazon Prime Video. Die Weltraum-Saga kehrt zurück.
      Die Crew der Rocinante ist wieder dabei.
      
      Severance startet die lange erwartete Staffel 2 bei Apple TV+. Adam Scott kehrt zurück.
      Ben Stiller führt wieder Regie.
    `
  };

  console.log('\n🧪 TESTING: MULTI_SERIES_EDITORIAL Pipeline');
  console.log('='.repeat(70));

  try {
    const result = await runContentPipeline(testArticle);
    
    // Handle different result types
    if ('skipped' in result && result.skipped) {
      console.log(`\n⚠️  Pipeline Result: SKIPPED`);
      console.log(`   Reason: ${result.reason}`);
      if ('draft' in result && result.draft) {
        console.log(`   Draft saved: ${result.draft.id}`);
      }
      process.exit(1);
    } else if ('success' in result && result.success) {
      console.log(`\n✅ Pipeline Result: SUCCESS`);
      console.log(`   Article ID: ${result.article.id}`);
      console.log(`   Article Slug: ${result.article.slug}`);
      console.log(`   Content Type: ${result.classification.content_type}`);
      console.log(`   Primary Series: ${result.resolution.primarySeries.name}`);
      console.log(`   Related Series: ${result.resolution.relatedSeries.length}`);
      console.log(`   Total Series: ${result.resolution.totalResolved}`);
      
      // Verify it's a multi-series article
      if (result.classification.content_type !== 'MULTI_SERIES_EDITORIAL') {
        console.error(`\n❌ ERROR: Expected MULTI_SERIES_EDITORIAL, got ${result.classification.content_type}`);
        process.exit(1);
      }
      
      if (result.resolution.totalResolved < 3) {
        console.error(`\n❌ ERROR: Expected at least 3 series, got ${result.resolution.totalResolved}`);
        process.exit(1);
      }
      
      console.log('\n✅ MULTI_SERIES_EDITORIAL test PASSED!');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Test FAILED:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
