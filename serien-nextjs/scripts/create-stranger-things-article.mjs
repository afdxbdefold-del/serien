/**
 * Create New Article - Stranger Things Season 5
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🎬 Erstelle neuen Artikel: Stranger Things Season 5...\n');
  
  const testArticle = {
    title: "Stranger Things Season 5: Duffer Brothers Reveal Episode Titles and Production Update",
    url: "https://tvline.com/test-stranger-things-s5",
    text: `
The Duffer Brothers have officially revealed the episode titles for the fifth and final season of Stranger Things on Netflix. The announcement was made via the show's official social media accounts, giving fans their first glimpse into what's to come.

Season 5 will consist of eight episodes, matching the episode count of the first season. The titles suggest a darker, more intense final chapter for the beloved series. Filming began in January 2024 and is expected to continue through the end of 2024.

Netflix has confirmed that Season 5 will premiere in 2025, though an exact date has not been announced. The streaming giant has indicated that this final season will be the longest yet, with each episode running significantly longer than previous seasons.

The main cast, including Millie Bobby Brown, Finn Wolfhard, Gaten Matarazzo, Caleb McLaughlin, Noah Schnapp, and Sadie Sink, will all return for the final season. Winona Ryder and David Harbour will also reprise their roles as Joyce Byers and Jim Hopper.

The Duffer Brothers have promised that Season 5 will provide closure to all the storylines that have been building since the show's debut in 2016. They've described it as "the beginning of the end" and have teased major character deaths and shocking revelations.

Production has been taking place in Atlanta, Georgia, with the Duffers stating that the final season will return to the show's roots while also pushing the story forward in unexpected ways.
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
