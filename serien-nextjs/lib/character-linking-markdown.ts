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
  seriesTmdbId: number
): Promise<CharacterLinkResult> {
  console.log('🔗 Linking characters in markdown...');
  
  // Get all characters for this series
  const characters = await prisma.characters.findMany({
    where: { seriesTmdbId },
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
    const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const regex = new RegExp(
      `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gi'
    );
    
    let matches = linkedMarkdown.match(regex);
    let matchedName = char.name;
    
    // Try nickname in quotes: "Dr. Michael 'Robby' Robinavitch" → "Robby"
    if (!matches && char.name.includes("'")) {
      const nicknameMatch = char.name.match(/'([^']+)'/);
      if (nicknameMatch) {
        const nickname = nicknameMatch[1];
        const escapedNickname = nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nicknameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedNickname}\\b(?!\\])(?!\\))`,
          'gi'
        );
        
        matches = linkedMarkdown.match(nicknameRegex);
        
        if (matches && matches.length > 0) {
          linkedMarkdown = linkedMarkdown.replace(
            nicknameRegex,
            `[${nickname}](/charaktere/${char.slug})`
          );
          linkedCount++;
          console.log(`   ✅ Linked: ${nickname} → ${char.name} (${matches.length} occurrences)`);
          return;
        }
      }
    }
    
    // If full name not found, try matching first name only (for "Xavier Collins" → "Xavier")
    if (!matches && char.name.includes(' ')) {
      const firstName = char.name.split(' ')[0];
      
      // Skip if first name is a title like "Dr." or "Nurse"
      if (['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Officer', 'Detective'].includes(firstName)) {
        // Try second word instead
        const secondName = char.name.split(' ')[1];
        if (secondName) {
          const escapedSecondName = secondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const secondNameRegex = new RegExp(
            `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedSecondName}\\b(?!\\])(?!\\))`,
            'gi'
          );
          
          matches = linkedMarkdown.match(secondNameRegex);
          
          if (matches && matches.length > 0) {
            linkedMarkdown = linkedMarkdown.replace(
              secondNameRegex,
              `[${secondName}](/charaktere/${char.slug})`
            );
            linkedCount++;
            console.log(`   ✅ Linked: ${secondName} → ${char.name} (${matches.length} occurrences)`);
            return;
          }
        }
      } else {
        const escapedFirstName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const firstNameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedFirstName}\\b(?!\\])(?!\\))`,
          'gi'
        );
        
        matches = linkedMarkdown.match(firstNameRegex);
        
        if (matches && matches.length > 0) {
          linkedMarkdown = linkedMarkdown.replace(
            firstNameRegex,
            `[${firstName}](/charaktere/${char.slug})`
          );
          linkedCount++;
          console.log(`   ✅ Linked: ${firstName} → ${char.name} (${matches.length} occurrences)`);
          return;
        }
      }
    }
    
    if (matches && matches.length > 0) {
      // Replace with markdown link
      linkedMarkdown = linkedMarkdown.replace(
        regex,
        `[${matchedName}](/charaktere/${char.slug})`
      );
      
      linkedCount++;
      console.log(`   ✅ Linked: ${matchedName} (${matches.length} occurrences)`);
    }
  });
  
  console.log(`   ✅ Total characters linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    charactersLinked: linkedCount,
  };
}
