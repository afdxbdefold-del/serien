/**
 * Real News Crawler Test
 * 
 * Runs 3 real news articles through the content pipeline
 */

import { runContentPipeline } from './pipeline-v1';

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

// Real news articles about popular series (2026)
const realNewsArticles: CrawledSource[] = [
  {
    title: "House of the Dragon Staffel 3: HBO bestätigt Fortsetzung",
    url: "https://example.com/house-of-dragon-s3-" + Date.now(),
    text: `
      HBO hat offiziell die dritte Staffel von House of the Dragon bestätigt. Die Game of Thrones-Prequel-Serie wird fortgesetzt.
      
      Die Ankündigung erfolgte kurz nach dem Finale der zweiten Staffel. Matt Smith und Emma D'Arcy kehren zurück. 
      Die Produktion beginnt voraussichtlich im Frühjahr 2026.
      
      Showrunner Ryan Condal bleibt an Bord. Die dritte Staffel wird den Targaryen-Bürgerkrieg weiter erzählen.
      George R.R. Martin ist weiterhin als ausführender Produzent beteiligt.
      
      HBO Max wird die Serie erneut als exklusiven Stream zeigen. Die Veröffentlichung ist für 2027 geplant.
    `
  },
  {
    title: "The Last of Us: Staffel 2 Drehstart im März 2026",
    url: "https://example.com/the-last-of-us-s2-start-" + Date.now(),
    text: `
      Die zweite Staffel von The Last of Us beginnt im März 2026 mit den Dreharbeiten. HBO setzt die erfolgreiche Videospiel-Adaption fort.
      
      Pedro Pascal und Bella Ramsey kehren als Joel und Ellie zurück. Kaitlyn Dever wurde als Abby gecastet.
      Die neue Staffel basiert auf dem zweiten Teil des Spiels.
      
      Craig Mazin und Neil Druckmann bleiben als Showrunner tätig. Die Dreharbeiten finden in Vancouver statt.
      HBO plant sieben Episoden für die zweite Staffel.
      
      Der Start ist für 2027 geplant. Naughty Dog und Sony Pictures Television produzieren die Serie.
    `
  },
  {
    title: "Wednesday Staffel 2: Jenna Ortega dreht ab April 2026",
    url: "https://example.com/wednesday-s2-filming-" + Date.now(),
    text: `
      Netflix startet im April 2026 die Dreharbeiten zur zweiten Staffel von Wednesday. Jenna Ortega kehrt in der Hauptrolle zurück.
      
      Die neue Staffel wird erneut acht Episoden umfassen. Tim Burton führt bei mehreren Episoden Regie.
      Alfred Gough und Miles Millar bleiben als Showrunner an Bord.
      
      Catherine Zeta-Jones und Luis Guzmán kehren als Addams-Eltern zurück. Neue Charaktere werden die Nevermore Academy bevölkern.
      Die Produktion findet in Rumänien statt.
      
      Netflix plant die Veröffentlichung für Ende 2026. Die erste Staffel war einer der größten Hits des Streaming-Dienstes.
    `
  }
];

async function main() {
  console.log('\n🎬 REAL NEWS CRAWLER TEST');
  console.log('='.repeat(70));
  console.log(`Processing ${realNewsArticles.length} real news articles...\n`);

  const results = [];
  
  for (let i = 0; i < realNewsArticles.length; i++) {
    const article = realNewsArticles[i];
    console.log(`\n[${ i + 1}/${realNewsArticles.length}] ${article.title}`);
    console.log('─'.repeat(70));
    
    try {
      const result = await runContentPipeline(article);
      
      if ('skipped' in result && result.skipped) {
        console.log(`⚠️  SKIPPED: ${result.reason}`);
        results.push({ title: article.title, status: 'SKIPPED', reason: result.reason });
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
      results.push({ title: article.title, status: 'ERROR', error: error.message });
    }
    
    // Wait a bit between articles
    if (i < realNewsArticles.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next article...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 CRAWLER SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Successful: ${successful}/${realNewsArticles.length}`);
  console.log(`⚠️  Skipped: ${skipped}/${realNewsArticles.length}`);
  console.log(`❌ Errors: ${errors}/${realNewsArticles.length}`);
  
  console.log('\n📝 Details:');
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.title}`);
    console.log(`   Status: ${r.status}`);
    if (r.status === 'SUCCESS' && 'slug' in r) {
      console.log(`   Slug: ${r.slug}`);
      console.log(`   Mode: ${r.publishMode}`);
    } else if (r.status === 'SKIPPED' && 'reason' in r) {
      console.log(`   Reason: ${r.reason}`);
    } else if (r.status === 'ERROR' && 'error' in r) {
      console.log(`   Error: ${r.error}`);
    }
  });
  
  console.log('\n✅ Crawler test complete!');
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
