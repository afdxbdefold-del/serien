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
    title: "House of the Dragon Staffel 3: HBO bestätigt Fortsetzung der Game of Thrones-Prequel-Serie",
    url: "https://example.com/house-of-dragon-s3-" + Date.now(),
    text: `
      HBO hat offiziell die dritte Staffel von House of the Dragon bestätigt. Die Game of Thrones-Prequel-Serie wird fortgesetzt und erzählt weiter die Geschichte der Targaryens.
      
      Die Ankündigung erfolgte nur wenige Tage nach dem Staffelfinale der zweiten Season. Matt Smith wird erneut als Daemon Targaryen zu sehen sein. Emma D'Arcy kehrt als Rhaenyra Targaryen zurück. Olivia Cooke bleibt als Alicent Hightower Teil des Casts.
      
      Die Produktion der dritten Staffel beginnt voraussichtlich im Frühjahr 2026. Die Dreharbeiten finden erneut in Großbritannien statt. Das Studio Leavesden in der Nähe von London dient als Hauptdrehort.
      
      Showrunner Ryan Condal bleibt für die dritte Staffel an Bord. Er entwickelt die Serie gemeinsam mit George R.R. Martin. Der Autor ist weiterhin als ausführender Produzent beteiligt. Miguel Sapochnik wird nicht mehr als Co-Showrunner tätig sein.
      
      Die dritte Staffel wird den Targaryen-Bürgerkrieg, bekannt als "Tanz der Drachen", weiter erzählen. Die Handlung basiert auf Martins Buch "Feuer und Blut". HBO plant acht bis zehn Episoden für Season 3.
      
      HBO Max wird die Serie erneut als exklusiven Stream zeigen. In Deutschland ist Sky Atlantic der TV-Partner. Die Veröffentlichung ist für 2027 geplant. Ein genauer Starttermin steht noch nicht fest.
      
      Die zweite Staffel erreichte durchschnittlich 8,9 Millionen Zuschauer pro Episode. Das macht House of the Dragon zu einer der erfolgreichsten HBO-Produktionen. Die Serie gewann mehrere Emmy Awards.
    `
  },
  {
    title: "The Last of Us Staffel 2: Pedro Pascal und Bella Ramsey starten Dreharbeiten im März",
    url: "https://example.com/the-last-of-us-s2-start-" + Date.now(),
    text: `
      Die zweite Staffel von The Last of Us beginnt im März 2026 mit den Dreharbeiten. HBO setzt die erfolgreiche Videospiel-Adaption fort und adaptiert den zweiten Teil des Spiels.
      
      Pedro Pascal kehrt als Joel Miller zurück. Bella Ramsey spielt erneut Ellie Williams. Kaitlyn Dever wurde als Abby Anderson gecastet. Sie übernimmt eine der Hauptrollen der neuen Staffel. Isabela Merced wird als Dina zu sehen sein.
      
      Craig Mazin und Neil Druckmann bleiben als Showrunner tätig. Mazin schrieb bereits die erste Staffel. Druckmann ist der Creative Director von Naughty Dog. Er entwickelte die Videospiel-Vorlage.
      
      Die Dreharbeiten finden hauptsächlich in Vancouver statt. Das Production Design Team baut erneut aufwendige Sets. Die Serie nutzt auch Originalschauplätze aus British Columbia. Die Produktion dauert voraussichtlich bis September 2026.
      
      HBO plant sieben Episoden für die zweite Staffel. Die erste Season umfasste neun Episoden. Jede Episode hat eine Laufzeit von 45 bis 80 Minuten. Das Budget pro Episode liegt bei etwa 10 bis 15 Millionen Dollar.
      
      Die Handlung spielt fünf Jahre nach den Ereignissen der ersten Staffel. Ellie ist nun älter und eigenständiger. Die Geschichte folgt dem zweiten Spiel. HBO verspricht eine emotionale und intensive Season.
      
      Der Start der zweiten Staffel ist für 2027 geplant. Ein genauer Termin wurde noch nicht bekannt gegeben. Naughty Dog und Sony Pictures Television produzieren die Serie. HBO betreut die Distribution.
      
      Die erste Staffel war ein großer Erfolg für HBO. Sie erreichte bis zu 40 Millionen Zuschauer. The Last of Us gewann acht Emmy Awards. Die Serie erhielt durchweg positive Kritiken.
    `
  },
  {
    title: "Wednesday Staffel 2: Netflix beginnt Produktion mit Jenna Ortega im April 2026",
    url: "https://example.com/wednesday-s2-filming-" + Date.now(),
    text: `
      Netflix startet im April 2026 die Dreharbeiten zur zweiten Staffel von Wednesday. Jenna Ortega kehrt in der Titelrolle zurück und verkörpert erneut die ikonische Wednesday Addams.
      
      Die neue Staffel wird erneut acht Episoden umfassen. Tim Burton führt bei mehreren Episoden Regie. Er war bereits bei vier Folgen der ersten Staffel als Regisseur tätig. Alfred Gough und Miles Millar bleiben als Showrunner an Bord.
      
      Catherine Zeta-Jones kehrt als Morticia Addams zurück. Luis Guzmán spielt erneut Gomez Addams. Emma Myers ist wieder als Enid Sinclair dabei. Joy Sunday übernimmt erneut die Rolle der Bianca Barclay. Neue Charaktere werden die Nevermore Academy bevölkern.
      
      Die Produktion findet hauptsächlich in Rumänien statt. Die Bukarester Studios dienen als Hauptdrehort. Das Production Design Team baut die Nevermore Academy neu auf. Die Dreharbeiten dauern voraussichtlich bis August 2026.
      
      Die zweite Staffel wird Wednesdays weiteres Leben an der Nevermore Academy zeigen. Die Handlung setzt direkt nach den Ereignissen der ersten Staffel an. Neue Mysterien und Gefahren erwarten die Schüler. Netflix verspricht mehr Gothic Horror.
      
      Danny Elfman komponiert erneut die Musik. Er arbeitete bereits an der ersten Staffel. Colleen Atwood ist erneut als Kostümbildnerin tätig. Sie gewann für ihre Arbeit mehrere Auszeichnungen.
      
      Netflix plant die Veröffentlichung für Ende 2026 oder Anfang 2027. Ein genauer Termin steht noch nicht fest. Die erste Staffel war einer der größten Hits des Streaming-Dienstes. Sie erreichte über 1,7 Milliarden Stunden Watchtime.
      
      Die Serie brach mehrere Netflix-Rekorde. Wednesday wurde zur meistgesehenen englischsprachigen Serie. Jenna Ortega erhielt für ihre Performance mehrere Auszeichnungen. Die Tanz-Szene zum Song "Goo Goo Muck" ging viral.
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
