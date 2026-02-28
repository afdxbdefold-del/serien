/**
 * Create Test Article - House of the Dragon
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🧪 Erstelle neuen Artikel...\n');
  
  const testArticle = {
    title: "House of the Dragon Season 3: George R.R. Martin Reveals Major Plot Details",
    url: "https://tvline.com/test-article-hotd-season3",
    text: `
House of the Dragon has officially begun production on Season 3, and author George R.R. Martin has shared exciting new details about what fans can expect from the upcoming season.

The fantasy drama series, which serves as a prequel to Game of Thrones, will continue to explore the Targaryen civil war known as the Dance of the Dragons. Martin confirmed that Season 3 will adapt some of the most dramatic and pivotal moments from his book "Fire & Blood."

HBO has confirmed that Season 3 will premiere in 2026, with production currently underway in the UK. The cast, including Emma D'Arcy and Matt Smith, will return to their roles as the warring Targaryen factions continue their devastating conflict.

Martin teased that fans should prepare for "shocking betrayals, epic dragon battles, and heartbreaking losses" in the new season. He emphasized that Season 3 will be darker and more intense than previous seasons, staying true to the brutal nature of the source material.

The show's creators, Ryan Condal and Miguel Sapochnik, have been working closely with Martin to ensure the adaptation remains faithful while also surprising longtime fans of the books. HBO has already indicated that House of the Dragon could run for multiple additional seasons beyond Season 3.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Verarbeite:', testArticle.title);
    console.log('🔗 URL:', testArticle.url);
    console.log('');
    
    const result = await runContentPipeline(testArticle);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ ERFOLG! Artikel Veröffentlicht!');
      console.log('✅ ================================\n');
      console.log('📊 Artikel Details:');
      console.log('   ID:', result.article.id);
      console.log('   Slug:', result.article.slug);
      console.log('   Title:', result.article.title);
      console.log('   Status:', result.article.status);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Artikel wurde übersprungen:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ Fehler beim Erstellen des Artikels:', error.message);
    throw error;
  }
}

createArticle().catch(console.error);
