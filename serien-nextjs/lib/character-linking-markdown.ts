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
    const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    let regex = new RegExp(
      `(?<!\\[)(?<!\\()\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gim'
    );
    
    let matchedName = char.name;
    
    // Try nickname in quotes: "Dr. Michael 'Robby' Robinavitch" → "Robby"
    if (char.name.includes("'")) {
      const nicknameMatch = char.name.match(/'([^']+)'/);
      if (nicknameMatch) {
        const nickname = nicknameMatch[1];
        const escapedNickname = nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nicknameRegex = new RegExp(
          `(?<!\\[)(?<!\\()\\b${escapedNickname}\\b(?!\\])(?!\\))`,
          'gim'
        );
        
        const match = nicknameRegex.exec(linkedMarkdown);
        
        if (match) {
          matchedName = nickname;
          regex = nicknameRegex;
        }
      }
    }
    
    // If full name not found, try other variations
    if (!regex.test(linkedMarkdown) && char.name.includes(' ')) {
      const words = char.name.split(' ');
      const firstName = words[0];
      
      // Skip if first name is a title
      if (['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Officer', 'Detective'].includes(firstName)) {
        // Try second word
        const secondName = words[1];
        if (secondName) {
          const cleanSecondName = secondName.replace(/'/g, '');
          const escapedSecondName = cleanSecondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(
            `(?<!\\[)(?<!\\()\\b${escapedSecondName}\\b(?!\\])(?!\\))`,
            'gim'
          );
          matchedName = cleanSecondName;
        }
      } else {
        const escapedFirstName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(
          `(?<!\\[)(?<!\\()\\b${escapedFirstName}\\b(?!\\])(?!\\))`,
          'gim'
        );
        matchedName = firstName;
      }
    }
    
    // Find first valid occurrence (not in heading)
    regex.lastIndex = 0;
    let match;
    let validMatch = null;
    
    while ((match = regex.exec(linkedMarkdown)) !== null) {
      const matchIndex = match.index;
      
      // Check if match is inside a heading
      const beforeMatch = linkedMarkdown.substring(Math.max(0, matchIndex - 150), matchIndex);
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const lineStart = lastNewline === -1 ? beforeMatch : beforeMatch.substring(lastNewline + 1);
      
      // Skip if in heading (starts with #)
      if (/^#+\s/.test(lineStart.trim())) {
        continue;
      }
      
      // This is the first valid match!
      validMatch = match;
      break;
    }
    
    if (validMatch) {
      // Replace only this occurrence using string slicing
      const matchIndex = validMatch.index;
      const matchText = validMatch[0];
      
      linkedMarkdown = 
        linkedMarkdown.substring(0, matchIndex) +
        `[${matchText}](/charaktere/${char.slug})` +
        linkedMarkdown.substring(matchIndex + matchText.length);
      
      linkedCount++;
      console.log(`   ✅ Linked: ${matchedName} → ${char.name} (1st valid occurrence)`);
    }
  });
  
  console.log(`   ✅ Total characters linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    charactersLinked: linkedCount,
  };
}
