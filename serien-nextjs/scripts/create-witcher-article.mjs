/**
 * Create Test Article - The Witcher
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🧪 Erstelle Test-Artikel für The Witcher...\n');
  
  const testArticle = {
    title: "The Witcher Season 4: Netflix Confirms Liam Hemsworth as New Geralt",
    url: "https://tvline.com/test-witcher-season4",
    text: `
Netflix has officially confirmed that Liam Hemsworth will take over the role of Geralt of Rivia in The Witcher Season 4. The announcement comes after Henry Cavill's departure from the series was announced in October 2023.

Season 4 is currently in pre-production, with filming expected to begin in early 2026. Showrunner Lauren S. Hissrich confirmed that the transition will be addressed within the story, though specific details about how Geralt's new appearance will be explained remain under wraps.

Hemsworth expressed his excitement about joining the series, calling himself a lifelong fan of The Witcher books and games. He stated that he understands the responsibility of stepping into such an iconic role and is committed to honoring both the source material and the foundation Cavill built.

The series is based on the books by Andrzej Sapkowski and has been one of Netflix's most successful fantasy shows. Season 3 was split into two volumes, with the second volume releasing in July 2023.

Netflix has confirmed that Season 4 will premiere in late 2026 or early 2027. The cast, including Anya Chalotra as Yennefer and Freya Allan as Ciri, will return alongside Hemsworth. The show will continue to adapt Sapkowski's novels, moving forward with the storyline from "The Time of Contempt."
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Verarbeite:', testArticle.title);
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ ERFOLG! Artikel Veröffentlicht!');
      console.log('✅ ================================\n');
      console.log('📊 Artikel Details:');
      console.log('   Slug:', result.article.slug);
      console.log('   Title:', result.article.title);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Artikel wurde übersprungen:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ Fehler:', error.message);
    throw error;
  }
}

createArticle().catch(console.error);
