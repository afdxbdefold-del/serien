/**
 * Full Pipeline v2 Test - All Features
 */
import { runPipelineV2 } from './pipeline-v2';

async function main() {
  console.log('🧪 FULL PIPELINE V2 TEST - ALL FEATURES');
  console.log('='.repeat(70));
  
  const uniqueId = Math.random().toString(36).substring(7);
  
  const testSource = {
    title: `Stranger Things Staffel 5 Starttermin bekannt gegeben ${uniqueId}`,
    url: 'https://example.com/stranger-things-season-5',
    text: `Netflix hat endlich den offiziellen Starttermin für die mit Spannung erwartete finale Staffel von "Stranger Things" bekannt gegeben. Die fünfte und letzte Staffel wird im Sommer 2025 auf dem Streaming-Dienst erscheinen. Die Showrunner Matt und Ross Duffer haben in einem Statement bestätigt, dass dies definitiv die letzte Staffel der erfolgreichen Mystery-Serie sein wird. Alle Hauptdarsteller kehren zurück: Millie Bobby Brown als Eleven, Finn Wolfhard als Mike Wheeler, Noah Schnapp als Will Byers und Winona Ryder als Joyce Byers. Die Dreharbeiten für die finale Staffel sind bereits abgeschlossen. Die Post-Produktion läuft auf Hochtouren. Fans dürfen sich auf ein episches und emotionales Finale freuen, das alle offenen Fragen der Serie beantworten wird.`,
    useFullTextMode: false,
  };
  
  try {
    const result = await runPipelineV2(testSource);
    
    if (result) {
      console.log('\n' + '='.repeat(70));
      console.log('✅ PIPELINE V2 TEST ERFOLGREICH');
      console.log('='.repeat(70));
      console.log(`📝 Artikel: ${result.headline}`);
      console.log(`🔗 URL: http://localhost:3000/${result.slug}`);
      console.log(`🆔 ID: ${result.articleId}`);
      console.log('='.repeat(70));
    } else {
      console.log('\n❌ Pipeline returned null');
    }
  } catch (error: any) {
    console.error('\n❌ PIPELINE TEST FEHLGESCHLAGEN:', error.message);
  }
  
  process.exit(0);
}

main();
