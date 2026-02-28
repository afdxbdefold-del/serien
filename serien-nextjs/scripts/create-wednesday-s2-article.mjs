/**
 * Create Article - Wednesday Season 2
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🎬 Erstelle Artikel: Wednesday Season 2...\n');
  
  const article = {
    title: "Wednesday Season 2: Netflix Announces Production Start and New Cast Members",
    url: "https://example.com/wednesday-season-2",
    text: `
Netflix has officially announced that production on Wednesday Season 2 will begin in May 2026 in Ireland. The streaming giant confirmed the news alongside the reveal of several new cast members joining Jenna Ortega for the highly anticipated second season.

The gothic comedy series became one of Netflix's biggest hits in 2022, with Jenna Ortega's portrayal of Wednesday Addams earning critical acclaim and a Golden Globe nomination. The show broke viewing records, accumulating over 1.7 billion hours viewed in its first month.

Season 2 will see the return of showrunners Alfred Gough and Miles Millar, who created the series. Tim Burton, who directed four episodes of Season 1, will also return to direct multiple episodes in the new season. The production team has confirmed that filming will take place primarily in Ireland, with some additional shooting locations in Romania.

New cast additions include Steve Buscemi, Billie Piper, and Haley Joel Osment, though their specific roles have not been disclosed. Emma Myers, Joy Sunday, and Georgie Farmer will all reprise their roles from the first season. Catherine Zeta-Jones and Luis Guzmán are also confirmed to return as Morticia and Gomez Addams.

The second season is expected to delve deeper into Wednesday's psychic visions and explore new mysteries at Nevermore Academy. Showrunner Alfred Gough has teased that the season will feature "bigger threats, darker secrets, and more supernatural elements" than the first season.

Netflix has indicated that Season 2 will consist of eight episodes, matching the episode count of the first season. With production beginning in May 2026, the season is expected to premiere in late 2026 or early 2027.

The show's massive success has also led to renewed interest in The Addams Family franchise, with merchandise sales skyrocketing and several spin-off projects reportedly in development. Wednesday's iconic dance scene from Season 1 became a viral TikTok trend, further cementing the show's cultural impact.

Jenna Ortega has expressed excitement about returning to the role, stating in recent interviews that she has been working closely with the writers to develop Wednesday's character arc for the second season. She has also confirmed that Wednesday will face new challenges that will test both her detective skills and her relationships with other students at Nevermore Academy.
    `,
    useFullTextMode: true,
  };
  
  try {
    console.log('📄 Starte Pipeline...\n');
    const result = await runContentPipeline(article);
    
    if (result.success) {
      console.log('\n✅ ================================');
      console.log('✅ ARTIKEL ERFOLGREICH ERSTELLT!');
      console.log('✅ ================================\n');
      console.log('📊 Details:');
      console.log('   Slug:', result.article.slug);
      console.log('   Status:', result.article.status);
      console.log('   URL: http://localhost:3000/' + result.article.slug);
      console.log('');
    } else if (result.skipped) {
      console.log('\n⚠️  Artikel übersprungen:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    throw error;
  }
}

createArticle().catch(console.error);
