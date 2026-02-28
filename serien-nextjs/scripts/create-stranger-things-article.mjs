/**
 * Create New Article - Stranger Things Season 5
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🎬 Erstelle neuen Artikel: The Last of Us Season 2...\n');
  
  const testArticle = {
    title: "The Last of Us Season 2: Pedro Pascal Teases Darker Storyline for Joel",
    url: "https://tvline.com/test-tlou-s2",
    text: `
Pedro Pascal has given fans a glimpse into what to expect from his character Joel in The Last of Us Season 2. In a recent interview, the actor revealed that the upcoming season will explore much darker territory for the beloved character.

Season 2 is currently in production in Vancouver, with filming expected to wrap in June 2024. HBO has confirmed that the new season will premiere in early 2025, adapting the events of the second video game.

Pascal described Season 2 as "emotionally devastating" and hinted that Joel's journey will take unexpected turns. The actor emphasized that the show will stay faithful to the game's story while adding new dimensions to the characters.

Bella Ramsey will return as Ellie, with their relationship at the center of the season's narrative. New cast members include Kaitlyn Dever as Abby and Isabela Merced as Dina, both crucial characters from the game.

Co-creators Craig Mazin and Neil Druckmann have stated that Season 2 will be more action-packed than the first, while maintaining the emotional depth that made the show a critical success. The season is expected to consist of eight to ten episodes.

HBO has already greenlit Season 3, ensuring that the complete story from the games will be told on screen. The show has become one of HBO's biggest hits, earning multiple Emmy Awards and critical acclaim.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Artikel-Info:');
    console.log('   Titel:', testArticle.title);
    console.log('   Länge:', testArticle.text.split(/\s+/).length, 'Wörter');
    console.log('');
    
    console.log('🚀 Starte Content-Pipeline...\n');
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ ARTIKEL ERFOLGREICH ERSTELLT!');
      console.log('✅ ================================\n');
      console.log('📊 Details:');
      console.log('   ID:', result.article.id);
      console.log('   Slug:', result.article.slug);
      console.log('   Titel:', result.article.title);
      console.log('   Status:', result.article.status);
      console.log('   Publish Mode:', result.article.publishMode);
      console.log('');
      console.log('🌐 URL:', 'http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Artikel wurde übersprungen:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    throw error;
  }
}

createArticle().catch(console.error);
