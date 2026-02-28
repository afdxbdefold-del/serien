/**
 * Create Article from URL - Cross Season 3
 */

import { runContentPipeline } from './pipeline-v1.ts';

async function createArticle() {
  console.log('🎬 Erstelle Artikel: Cross Season 3...\n');
  
  const article = {
    title: "'Cross' Renewed for Season 3 at Amazon Prime",
    url: "https://thecinemaholic.com/cross-season-3/",
    text: `
Amazon Prime has officially renewed the crime thriller series 'Cross' for its third season. The Cinemaholic can confirm that principal photography will take place between April 6 and July 30, 2026 in Mississauga, Ontario, Canada.

Creator and showrunner Ben Watkins is returning as head writer for Season 3, with Craig Siebels joining as co-writer and director. The show, which is based on James Patterson's Alex Cross book series, stars Aldis Hodge as detective and forensic psychologist Alex Cross.

Season 2 is currently airing on Amazon Prime Video, with Episode 5 titled 'Climb' recently released. In this episode, Alex Cross and Rebecca Matthews, played by Jeanie Mason, finally meet face to face. The episode reveals major plot developments as Cross and his partner Craig, portrayed by Alona Tal, uncover Rebecca's identity and track her to Florida.

The season features Matthew Lillard as Lance Durand, owner of Crestbrook Industries, which is involved in sex trafficking. Rebecca is revealed to be targeting various individuals connected to these crimes, including Senator Ashford, played by Josh Peck.

Episode 6 of Season 2 is scheduled to air on March 4, 2026. Three more episodes remain before the season finale, where viewers will see the final confrontation between Cross and Rebecca, as well as the resolution of the Crestbrook Industries case.

The renewal for Season 3 comes as the show continues to attract strong viewership on Prime Video. Amazon has not yet announced a premiere date for the third season, but with filming scheduled for mid-2026, the season is expected to debut in late 2026 or early 2027.
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
    } else if (result.skipped) {
      console.log('\n⚠️  Artikel wurde übersprungen:', result.reason);
    }
    
  } catch (error) {
    console.error('\n❌ FEHLER:', error.message);
    throw error;
  }
}

createArticle().catch(console.error);
