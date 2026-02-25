/**
 * Real News Crawler Test - Batch 3
 * 
 * 5 neue Artikel mit Fact Safety Layer
 */

import { runContentPipeline } from './pipeline-v1';

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

const newsArticles: CrawledSource[] = [
  {
    title: "Stranger Things: Finale Staffel startet Produktion",
    url: "https://example.com/stranger-things-s5-prod-" + Date.now(),
    text: `
      Netflix hat den Produktionsstart der finalen Staffel von Stranger Things bestätigt. Die fünfte Season geht in Produktion.
      
      Millie Bobby Brown kehrt als Eleven zurück. Finn Wolfhard, Gaten Matarazzo und Caleb McLaughlin sind wieder dabei. Die Duffer Brothers schreiben und produzieren die finale Staffel.
      
      Die Dreharbeiten finden in Atlanta statt. Netflix plant mehrere Episoden für den Abschluss. Die Serie lief seit 2016 auf dem Streaming-Dienst. Stranger Things war einer der größten Netflix-Hits.
    `
  },
  {
    title: "Peaky Blinders: Cillian Murphy bestätigt Film-Projekt",
    url: "https://example.com/peaky-blinders-film-" + Date.now(),
    text: `
      Cillian Murphy hat seine Rückkehr als Tommy Shelby bestätigt. Ein Peaky Blinders-Film ist in Entwicklung.
      
      Steven Knight schreibt das Drehbuch für den Film. Die Serie endete nach sechs Staffeln auf Netflix. Murphy gewann kürzlich den Oscar für Oppenheimer. Der Film wird die Geschichte der Shelbys fortsetzen.
      
      Netflix produziert das Projekt gemeinsam mit BBC. Die Besetzung ist noch nicht vollständig bekannt. Die Serie war international erfolgreich. Der Produktionsstart steht noch nicht fest.
    `
  },
  {
    title: "The Crown: Netflix veröffentlicht Behind-the-Scenes Dokumentation",
    url: "https://example.com/the-crown-bts-" + Date.now(),
    text: `
      Netflix bringt eine Behind-the-Scenes Dokumentation zu The Crown. Die Doku zeigt Einblicke in die Produktion der Serie.
      
      Die sechste Staffel war die finale Season der Serie. Imelda Staunton spielte Queen Elizabeth II in den letzten beiden Staffeln. Peter Morgan schuf die preisgekrönte Serie.
      
      Die Dokumentation erscheint auf Netflix. Sie zeigt Interviews mit Cast und Crew. The Crown gewann zahlreiche Emmy Awards. Die Serie lief von 2016 bis 2023.
    `
  },
  {
    title: "Arcane Staffel 2: League of Legends Serie kehrt zurück",
    url: "https://example.com/arcane-s2-return-" + Date.now(),
    text: `
      Riot Games und Netflix haben neue Details zur zweiten Staffel von Arcane veröffentlicht. Die animierte League of Legends-Serie wird fortgesetzt.
      
      Ella Purnell und Hailee Steinfeld sprechen erneut die Hauptrollen. Die erste Staffel gewann drei Emmy Awards. Fortiche Production animiert die Serie. Die zweite Staffel ist bereits fertiggestellt.
      
      Netflix plant eine Veröffentlichung in diesem Jahr. Riot Games investierte Millionen in die Produktion. Die erste Staffel war ein weltweiter Erfolg. Arcane gilt als eine der besten animierten Serien.
    `
  },
  {
    title: "Breaking Bad Universe: Vince Gilligan entwickelt neues Projekt",
    url: "https://example.com/vince-gilligan-new-" + Date.now(),
    text: `
      Vince Gilligan arbeitet an einem neuen Projekt für Apple TV+. Der Breaking Bad-Schöpfer kehrt zum Fernsehen zurück.
      
      Details zur neuen Serie sind noch geheim. Gilligan hat einen Deal mit Apple abgeschlossen. Better Call Saul endete kürzlich nach sechs Staffeln. Bryan Cranston äußerte Interesse an einer Zusammenarbeit.
      
      Apple TV+ produziert das Projekt. Die Serie ist nicht mit Breaking Bad verbunden. Gilligan gewann mehrere Emmy Awards für sein bisheriges Werk. Das Breaking Bad-Universum bleibt bei AMC.
    `
  }
];

async function main() {
  console.log('\n🎬 REAL NEWS CRAWLER - BATCH 3 (mit Fact Safety Layer)');
  console.log('='.repeat(70));
  console.log(`Processing ${newsArticles.length} news articles...\n`);

  const results = [];
  
  for (let i = 0; i < newsArticles.length; i++) {
    const article = newsArticles[i];
    console.log(`\n[${i + 1}/${newsArticles.length}] ${article.title}`);
    console.log('─'.repeat(70));
    
    try {
      const result = await runContentPipeline(article);
      
      if ('skipped' in result && result.skipped) {
        console.log(`⚠️  SKIPPED: ${result.reason}`);
        results.push({ 
          title: article.title, 
          status: 'SKIPPED', 
          reason: result.reason 
        });
      } else if ('success' in result && result.success) {
        console.log(`✅ SUCCESS: ${result.article.slug}`);
        console.log(`   Publish Mode: ${result.article.publishMode}`);
        results.push({ 
          title: article.title, 
          status: 'SUCCESS', 
          slug: result.article.slug,
          publishMode: result.article.publishMode 
        });
      }
    } catch (error: any) {
      console.error(`❌ ERROR: ${error.message}`);
      results.push({ 
        title: article.title, 
        status: 'ERROR', 
        error: error.message 
      });
    }
    
    if (i < newsArticles.length - 1) {
      console.log('\n⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 BATCH 3 SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  const factSafetyFails = results.filter(r => 
    r.status === 'SKIPPED' && 
    r.reason && 
    r.reason.includes('fact_safety')
  ).length;
  
  console.log(`✅ Successful: ${successful}/${newsArticles.length}`);
  console.log(`⚠️  Skipped: ${skipped}/${newsArticles.length}`);
  console.log(`   └─ Fact Safety Fails: ${factSafetyFails}`);
  console.log(`❌ Errors: ${errors}/${newsArticles.length}`);
  
  console.log('\n📝 Articles:');
  results.forEach((r, i) => {
    const statusIcon = r.status === 'SUCCESS' ? '✅' : r.status === 'SKIPPED' ? '⚠️' : '❌';
    console.log(`\n${statusIcon} ${i + 1}. ${r.title.substring(0, 60)}...`);
    console.log(`   Status: ${r.status}`);
    if (r.status === 'SUCCESS' && 'slug' in r) {
      console.log(`   Mode: ${r.publishMode}`);
    } else if (r.status === 'SKIPPED' && 'reason' in r) {
      console.log(`   Reason: ${r.reason}`);
    }
  });
  
  console.log('\n✅ Batch 3 complete with Fact Safety Layer!\n');
}

if (require.main === module) {
  main().catch(console.error);
}
