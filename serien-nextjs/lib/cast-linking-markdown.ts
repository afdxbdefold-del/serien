/**
 * CAST LINKING FOR MARKDOWN
 * Links actor/actress names in Markdown to their person pages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CastLinkResult {
  linkedMarkdown: string;
  castLinked: number;
}

/**
 * Link cast member names in markdown text
 */
export async function linkCastInMarkdown(
  markdown: string,
  seriesTmdbId: number
): Promise<CastLinkResult> {
  console.log('🎭 Linking cast members in markdown...');
  
  // Get cast via characters (persons who play characters in this series)
  const characters = await prisma.characters.findMany({
    where: { seriesTmdbId },
    select: { 
      actorTmdbId: true,
    },
  });
  
  const actorIds = [...new Set(characters.map(c => c.actorTmdbId).filter(Boolean))];
  
  if (actorIds.length === 0) {
    console.log('   ℹ️  No cast members found for series');
    return { linkedMarkdown: markdown, castLinked: 0 };
  }
  
  const cast = await prisma.persons.findMany({
    where: { tmdbId: { in: actorIds } },
    select: { id: true, name: true, slug: true },
  });
  
  if (cast.length === 0) {
    console.log('   ℹ️  No cast members found for series');
    return { linkedMarkdown: markdown, castLinked: 0 };
  }
  
  console.log(`   Found ${cast.length} cast members`);
  
  let linkedMarkdown = markdown;
  let linkedCount = 0;
  
  // Sort by name length (longest first) to avoid partial matches
  const sortedCast = cast.sort((a, b) => b.name.length - a.name.length);
  
  sortedCast.forEach(member => {
    const escapedName = member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    const regex = new RegExp(
      `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gim'
    );
    
    let matches = linkedMarkdown.match(regex);
    let matchedName = member.name;
    let regexToUse = regex;
    
    // Try first name only if full name not found
    if (!matches && member.name.includes(' ')) {
      const firstName = member.name.split(' ')[0];
      const lastName = member.name.split(' ').pop();
      
      // Try last name (more unique for actors)
      if (lastName && lastName !== firstName) {
        const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lastNameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!^#+ )\\b${escapedLastName}\\b(?!\\])(?!\\))`,
          'gim'
        );
        
        matches = linkedMarkdown.match(lastNameRegex);
        
        if (matches && matches.length > 0) {
          matchedName = lastName;
          regexToUse = lastNameRegex;
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
          return `[${matchedName}](/personen/${member.slug})`;
        }
      );
      
      if (replaced) {
        linkedCount++;
        console.log(`   ✅ Linked: ${matchedName} → ${member.name} (1st occurrence only)`);
      }
    }
  });
  
  console.log(`   ✅ Total cast linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    castLinked: linkedCount,
  };
}
