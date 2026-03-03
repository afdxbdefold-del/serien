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
    // Build regex that matches character name but not inside markdown links or headings
    const escapedName = char.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const regex = new RegExp(
      `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gim'
    );
    
    let matches = linkedMarkdown.match(regex);
    let matchedName = char.name;
    let regexToUse = regex;
    
    // Try nickname in quotes: "Dr. Michael 'Robby' Robinavitch" → "Robby"
    if (!matches && char.name.includes("'")) {
      const nicknameMatch = char.name.match(/'([^']+)'/);
      if (nicknameMatch) {
        const nickname = nicknameMatch[1];
        const escapedNickname = nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const nicknameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedNickname}\\b(?!\\])(?!\\))`,
          'gim'
        );
        
        matches = linkedMarkdown.match(nicknameRegex);
        
        if (matches && matches.length > 0) {
          // Replace ONLY FIRST occurrence
          linkedMarkdown = linkedMarkdown.replace(
            nicknameRegex,
            (match) => {
              if (!linkedMarkdown.substring(0, linkedMarkdown.indexOf(match)).includes(`[${nickname}](`)) {
                return `[${nickname}](/charaktere/${char.slug})`;
              }
              return match;
            }
          );
          
          // Replace only the first match
          const firstIndex = linkedMarkdown.search(nicknameRegex);
          if (firstIndex !== -1) {
            linkedMarkdown = 
              linkedMarkdown.substring(0, firstIndex) +
              linkedMarkdown.substring(firstIndex).replace(nicknameRegex, `[${nickname}](/charaktere/${char.slug})`);
          }
          
          linkedCount++;
          console.log(`   ✅ Linked: ${nickname} → ${char.name} (1st occurrence only)`);
          return;
        }
      }
    }
    
    // If full name not found, try matching first name only
    if (!matches && char.name.includes(' ')) {
      const firstName = char.name.split(' ')[0];
      
      // Skip if first name is a title
      if (['Dr.', 'Mr.', 'Mrs.', 'Ms.', 'Nurse', 'Officer', 'Detective'].includes(firstName)) {
        // Try second word instead
        const secondName = char.name.split(' ')[1];
        if (secondName) {
          const cleanSecondName = secondName.replace(/'/g, '');
          const escapedSecondName = cleanSecondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const secondNameRegex = new RegExp(
            `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedSecondName}\\b(?!\\])(?!\\))`,
            'gim'
          );
          
          matches = linkedMarkdown.match(secondNameRegex);
          
          if (matches && matches.length > 0) {
            matchedName = cleanSecondName;
            regexToUse = secondNameRegex;
          }
        }
      } else {
        const escapedFirstName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const firstNameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedFirstName}\\b(?!\\])(?!\\))`,
          'gim'
        );
        
        matches = linkedMarkdown.match(firstNameRegex);
        
        if (matches && matches.length > 0) {
          matchedName = firstName;
          regexToUse = firstNameRegex;
        }
      }
    }
    
    if (matches && matches.length > 0) {
      // Replace ONLY THE FIRST occurrence
      let replaced = false;
      linkedMarkdown = linkedMarkdown.replace(
        regexToUse,
        (match, offset) => {
          // Check if we're inside a heading
          const beforeMatch = linkedMarkdown.substring(Math.max(0, offset - 100), offset);
          const lastNewline = beforeMatch.lastIndexOf('\n');
          const lineStart = beforeMatch.substring(lastNewline + 1);
          
          // Skip if in heading or already replaced
          if (replaced || /^#+\s/.test(lineStart)) {
            return match;
          }
          
          replaced = true;
          return `[${matchedName}](/charaktere/${char.slug})`;
        }
      );
      
      if (replaced) {
        linkedCount++;
        console.log(`   ✅ Linked: ${matchedName} → ${char.name} (1st occurrence only)`);
      }
    }
  });
  
  console.log(`   ✅ Total characters linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    charactersLinked: linkedCount,
  };
}
