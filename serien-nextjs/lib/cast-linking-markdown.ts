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
      `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedName}\\b(?!\\])(?!\\))`,
      'gi'
    );
    
    let matches = linkedMarkdown.match(regex);
    
    // Try first name only if full name not found
    if (!matches && member.name.includes(' ')) {
      const firstName = member.name.split(' ')[0];
      const lastName = member.name.split(' ').pop();
      
      // Try last name (more unique for actors)
      if (lastName && lastName !== firstName) {
        const escapedLastName = lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const lastNameRegex = new RegExp(
          `(?<!\\[)(?<!\\()(?<!##\\s)\\b${escapedLastName}\\b(?!\\])(?!\\))`,
          'gi'
        );
        
        matches = linkedMarkdown.match(lastNameRegex);
        
        if (matches && matches.length > 0) {
          linkedMarkdown = linkedMarkdown.replace(
            lastNameRegex,
            `[${lastName}](/personen/${member.slug})`
          );
          linkedCount++;
          console.log(`   ✅ Linked: ${lastName} → ${member.name} (${matches.length} occurrences)`);
          return;
        }
      }
    }
    
    if (matches && matches.length > 0) {
      linkedMarkdown = linkedMarkdown.replace(
        regex,
        `[${member.name}](/personen/${member.slug})`
      );
      linkedCount++;
      console.log(`   ✅ Linked: ${member.name} (${matches.length} occurrences)`);
    }
  });
  
  console.log(`   ✅ Total cast linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    castLinked: linkedCount,
  };
}
