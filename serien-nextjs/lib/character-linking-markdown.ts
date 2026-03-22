/**
 * CHARACTER LINKING FOR MARKDOWN (v2)
 * 
 * Links character names in Markdown BEFORE HTML conversion
 * This prevents HTML structure corruption
 * 
 * Also links streamer names to their hub pages (1x per article)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Streamer Hub URLs - add more as hubs are created
const STREAMER_HUBS: Record<string, string> = {
  'Netflix': '/netflix-serien',
  'Prime Video': '/prime-video-serien',
  'Amazon Prime Video': '/prime-video-serien',
  'Disney+': '/disney-plus-serien',
  'Disney Plus': '/disney-plus-serien',
  'HBO': '/hbo-serien',
  'HBO Max': '/hbo-serien',
  'Max': '/hbo-serien',
  'Apple TV+': '/apple-tv-serien',
  'Apple TV': '/apple-tv-serien',
  'AppleTV+': '/apple-tv-serien',
};

interface CharacterLinkResult {
  linkedMarkdown: string;
  charactersLinked: number;
}

interface StreamerLinkResult {
  linkedMarkdown: string;
  streamersLinked: string[];
}

/**
 * Link streamer names to their hub pages (1x per streamer)
 */
export function linkStreamersInMarkdown(markdown: string): StreamerLinkResult {
  let linkedMarkdown = markdown;
  const streamersLinked: string[] = [];

  for (const [streamerName, hubUrl] of Object.entries(STREAMER_HUBS)) {
    const escapedName = streamerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Match streamer name not already in a link, not in heading
    const regex = new RegExp(
      `(?<!\\[)(?<!\\()\\b${escapedName}\\b(?!\\])(?!\\))(?![^\\[]*\\])`,
      'gi'
    );

    // Find first valid occurrence (not in heading)
    regex.lastIndex = 0;
    let match;
    let validMatch = null;

    while ((match = regex.exec(linkedMarkdown)) !== null) {
      const matchIndex = match.index;

      // Check if match is inside a heading line
      const beforeMatch = linkedMarkdown.substring(Math.max(0, matchIndex - 300), matchIndex);
      const afterMatch = linkedMarkdown.substring(matchIndex, Math.min(linkedMarkdown.length, matchIndex + 300));
      
      // Find the start of the current line
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const lineStart = lastNewline === -1 ? beforeMatch : beforeMatch.substring(lastNewline + 1);
      
      // Find the end of the current line
      const nextNewline = afterMatch.indexOf('\n');
      const fullLine = lineStart + (nextNewline === -1 ? afterMatch : afterMatch.substring(0, nextNewline));

      // Skip if line is a heading (starts with # or ##)
      if (/^#{1,6}\s/.test(fullLine.trimStart())) {
        continue;
      }

      // This is the first valid match!
      validMatch = match;
      break;
    }

    if (validMatch) {
      const matchIndex = validMatch.index;
      const matchText = validMatch[0];

      linkedMarkdown =
        linkedMarkdown.substring(0, matchIndex) +
        `[${matchText}](${hubUrl})` +
        linkedMarkdown.substring(matchIndex + matchText.length);

      streamersLinked.push(streamerName);
      console.log(`   ✅ Linked: ${streamerName} → ${hubUrl} (1st valid occurrence)`);
    }
  }

  return {
    linkedMarkdown,
    streamersLinked,
  };
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
        
        // Skip very short nicknames
        if (nickname.length < 4) {
          return;
        }
        
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
          
          // Skip very short names
          if (cleanSecondName.length < 4) {
            return;
          }
          
          const escapedSecondName = cleanSecondName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          regex = new RegExp(
            `(?<!\\[)(?<!\\()\\b${escapedSecondName}\\b(?!\\])(?!\\))`,
            'gim'
          );
          matchedName = cleanSecondName;
        }
      } else {
        // Skip very short first names
        if (firstName.length < 4) {
          return;
        }
        
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
      
      // Check if match is inside a heading line
      const beforeMatch = linkedMarkdown.substring(Math.max(0, matchIndex - 300), matchIndex);
      const afterMatch = linkedMarkdown.substring(matchIndex, Math.min(linkedMarkdown.length, matchIndex + 300));
      
      // Find the start of the current line
      const lastNewline = beforeMatch.lastIndexOf('\n');
      const lineStart = lastNewline === -1 ? beforeMatch : beforeMatch.substring(lastNewline + 1);
      
      // Find the end of the current line
      const nextNewline = afterMatch.indexOf('\n');
      const fullLine = lineStart + (nextNewline === -1 ? afterMatch : afterMatch.substring(0, nextNewline));
      
      // Skip if line is a heading (starts with # or ##)
      if (/^#{1,6}\s/.test(fullLine.trimStart())) {
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
        `[${matchText}](/figur/${char.slug})` +
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
