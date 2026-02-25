/**
 * Real News Crawler Test - Batch 2
 * 
 * 3 weitere echte News-Artikel
 */

import { runContentPipeline } from './pipeline-v1';

interface CrawledSource {
  title: string;
  url: string;
  text: string;
}

const newsArticles: CrawledSource[] = [
  {
    title: "The Witcher: Netflix bestätigt Staffel 4 mit Liam Hemsworth",
    url: "https://example.com/witcher-s4-liam-" + Date.now(),
    text: `
      Netflix hat die vierte Staffel von The Witcher offiziell bestätigt. Liam Hemsworth übernimmt die Hauptrolle von Henry Cavill.
      
      Der Wechsel des Hauptdarstellers erfolgt nach Staffel 3. Hemsworth wird Geralt von Riva verkörpern. Die Produktion beginnt im Frühjahr 2026. Netflix plant acht Episoden für die neue Staffel.
      
      Anya Chalotra und Freya Allan bleiben als Yennefer und Ciri dabei. Die Story folgt weiter den Büchern von Andrzej Sapkowski. Showrunnerin Lauren Schmidt Hissrich bleibt an Bord.
      
      Die Dreharbeiten finden erneut in Großbritannien statt. Der Start der vierten Staffel ist für 2027 geplant. Netflix verspricht eine nahtlose Fortsetzung trotz des Darstellerwechsels.
    `
  },
  {
    title: "Daredevil: Born Again startet im März 2027 auf Disney+",
    url: "https://example.com/daredevil-born-again-" + Date.now(),
    text: `
      Disney+ hat den Starttermin für Daredevil: Born Again bekannt gegeben. Die Serie startet am 4. März 2027 auf dem Streaming-Dienst.
      
      Charlie Cox kehrt als Matt Murdock zurück. Vincent D'Onofrio spielt erneut Wilson Fisk. Die Serie umfasst 18 Episoden in der ersten Staffel. Marvel Studios produziert die Show.
      
      Die Handlung knüpft an die Netflix-Serie an. Jon Bernthal kehrt als Punisher zurück. Die Dreharbeiten wurden im Dezember 2025 abgeschlossen. Kevin Feige ist ausführender Produzent.
      
      Disney+ plant eine wöchentliche Veröffentlichung. Die Serie ist Teil des Marvel Cinematic Universe. Fans erwarten eine dunklere Tonalität als bei anderen MCU-Shows.
    `
  },
  {
    title: "Squid Game Staffel 3: Finale Staffel kommt 2027",
    url: "https://example.com/squid-game-s3-final-" + Date.now(),
    text: `
      Netflix hat bestätigt, dass Squid Game mit Staffel 3 endet. Die finale Season erscheint 2027 auf dem Streaming-Dienst.
      
      Creator Hwang Dong-hyuk kündigte das Ende der Serie an. Lee Jung-jae kehrt als Seong Gi-hun zurück. Die dritte Staffel wird die Geschichte abschließen. Netflix plant sechs bis acht Episoden.
      
      Die Produktion beginnt im Sommer 2026. Die Dreharbeiten finden erneut in Südkorea statt. Hwang Dong-hyuk schreibt und führt erneut Regie. Die zweite Staffel startete Ende 2024.
      
      Squid Game war die erfolgreichste Netflix-Serie aller Zeiten. Über 1,65 Milliarden Stunden wurden weltweit geschaut. Die finale Staffel soll alle offenen Fragen beantworten.
    `
  }
];

async function main() {
  console.log('\n🎬 REAL NEWS CRAWLER - BATCH 2');
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
    
    if (i < newsArticles.length - 1) {
      console.log('\n⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 BATCH 2 SUMMARY');
  console.log('='.repeat(70));
  
  const successful = results.filter(r => r.status === 'SUCCESS').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Successful: ${successful}/${newsArticles.length}`);
  console.log(`⚠️  Skipped: ${skipped}/${newsArticles.length}`);
  console.log(`❌ Errors: ${errors}/${newsArticles.length}`);
  
  console.log('\n📝 Articles:');
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.title.substring(0, 60)}...`);
    console.log(`   Status: ${r.status}`);
    if (r.status === 'SUCCESS' && 'slug' in r) {
      console.log(`   Slug: ${r.slug}`);
      console.log(`   Mode: ${r.publishMode}`);
    }
  });
  
  console.log('\n✅ Batch 2 complete!\n');
}

if (require.main === module) {
  main().catch(console.error);
}
