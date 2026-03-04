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
    // Skip very short names (likely too generic)
    if (member.name.length < 4) {
      return;
    }
    
    const escapedName = member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    let regex = new RegExp(
      `(?<!\\[)(?<!\\()\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gim'
    );
    
    let matchedName = member.name;
    
    // Try last name if full name not found
    if (member.name.includes(' ')) {
      const firstName = member.name.split(' ')[0];
      const lastName = member.name.split(' ').pop();
      
      if (lastName && lastName !== firstName) {
        const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lastNameRegex = new RegExp(
          `(?<!\\[)(?<!\\()\\b${escapedLastName}\\b(?!\\])(?!\\))`,
          'gim'
        );
        
        const testMatch = lastNameRegex.exec(linkedMarkdown);
        if (testMatch) {
          regex = lastNameRegex;
          matchedName = lastName;
        }
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
      
      // Skip if in heading
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
        `[${matchText}](/person/${member.slug})` +
        linkedMarkdown.substring(matchIndex + matchText.length);
      
      linkedCount++;
      console.log(`   ✅ Linked: ${matchedName} → ${member.name} (1st valid occurrence)`);
    }
  });
  
  console.log(`   ✅ Total cast linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    castLinked: linkedCount,
  };
}
