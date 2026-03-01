/**
 * Update Article Character Links Script
 * Updates existing articles to include automatic links to character pages
 * 
 * Usage:
 *   npx ts-node scripts/update-article-character-links.ts <seriesTmdbId>
 * 
 * Example:
 *   npx ts-node scripts/update-article-character-links.ts 157741
 */

import { updateExistingArticlesWithCharacterLinks } from '../lib/character-linking';

async function main() {
  const seriesTmdbId = parseInt(process.argv[2]);

  if (!seriesTmdbId || isNaN(seriesTmdbId)) {
    console.error('❌ Usage: npx ts-node scripts/update-article-character-links.ts <seriesTmdbId>');
    console.error('   Example: npx ts-node scripts/update-article-character-links.ts 157741');
    process.exit(1);
  }

  console.log(`\n🔗 Starting character link update for series ${seriesTmdbId}...\n`);

  try {
    const updatedCount = await updateExistingArticlesWithCharacterLinks(seriesTmdbId);
    
    console.log(`\n✅ Successfully updated ${updatedCount} articles with character links!`);
    console.log('   Articles now contain automatic links to character pages.\n');
  } catch (error) {
    console.error('\n❌ Error updating articles:', error);
    process.exit(1);
  }
}

main();
