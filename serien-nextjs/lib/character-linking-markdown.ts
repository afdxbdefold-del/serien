/**
 * CHARACTER LINKING FOR MARKDOWN (v2)
 * 
 * Links character names in Markdown BEFORE HTML conversion
 * This prevents HTML structure corruption
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CharacterLinkResult {
  linkedMarkdown: string;
  charactersLinked: number;
}

/**
 * Link character names in markdown text
 * Works on plain markdown, not HTML
 */
export async function linkCharactersInMarkdown(
  markdown: string,
  seriesId: number
): Promise<CharacterLinkResult> {
  console.log('🔗 Linking characters in markdown...');
  
  // Get all characters for this series
  const characters = await prisma.characters.findMany({
    where: { seriesId },
    select: { id: true, name: true, slug: true },
  });
  
  if (characters.length === 0) {
    console.log('   ℹ️  No characters found for series');
    return { linkedMarkdown: markdown, charactersLinked: 0 };
  }
  
  console.log(`   Found ${characters.length} characters`);
  
  let linkedMarkdown = markdown;
  let linkedCount = 0;
  
  // Sort by name length (longest first) to avoid partial matches
  const sortedCharacters = characters.sort((a, b) => b.name.length - a.name.length);
  
  sortedCharacters.forEach(char => {
    // Build regex that matches character name but not inside markdown links
    // Avoid matching inside: [text](url) or **bold** or ## headings
    const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match character name only if:
    // - Not inside markdown link brackets []
    // - Not inside markdown link URLs ()
    // - Not at start of line after ## (heading)
    const regex = new RegExp(
      `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gi'
    );
    
    const matches = linkedMarkdown.match(regex);
    
    if (matches && matches.length > 0) {
      // Replace with markdown link
      linkedMarkdown = linkedMarkdown.replace(
        regex,
        `[${char.name}](/charaktere/${char.slug})`
      );
      
      linkedCount++;
      console.log(`   ✅ Linked: ${char.name} (${matches.length} occurrences)`);
    }
  });
  
  console.log(`   ✅ Total characters linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    charactersLinked: linkedCount,
  };
}
