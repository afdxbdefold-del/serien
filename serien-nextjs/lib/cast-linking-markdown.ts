/**
 * CAST LINKING FOR MARKDOWN v2
 * 
 * Links actor/actress names in Markdown to their person pages
 * 
 * Strategy:
 * 1. First try series-specific cast (via characters table)
 * 2. Then scan for ALL known persons in DB (global match)
 * 3. Match both full names AND last names
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
  
  // STEP 1: Get series-specific cast via characters
  const characters = await prisma.characters.findMany({
    where: { seriesTmdbId },
    select: { actorTmdbId: true },
  });
  
  const seriesActorIds = [...new Set(characters.map(c => c.actorTmdbId).filter(Boolean))];
  
  // STEP 2: Get ALL known persons from DB (for global matching)
  // Prioritize series cast, but also check other known actors
  const allPersons = await prisma.persons.findMany({
    select: { id: true, name: true, slug: true, tmdbId: true },
    orderBy: { name: 'asc' },
  });
  
  if (allPersons.length === 0) {
    console.log('   ℹ️  No persons in database');
    return { linkedMarkdown: markdown, castLinked: 0 };
  }
  
  // Separate into series cast and other known persons
  const seriesCast = allPersons.filter(p => seriesActorIds.includes(p.tmdbId));
  const otherPersons = allPersons.filter(p => !seriesActorIds.includes(p.tmdbId));
  
  // Combine: Series cast first (priority), then others
  const cast = [...seriesCast, ...otherPersons];
  
  console.log(`   Found ${seriesCast.length} series cast, ${otherPersons.length} other known persons`);
  
  let linkedMarkdown = markdown;
  let linkedCount = 0;
  const linkedNames = new Set<string>(); // Track already linked names
  
  // Sort by name length (longest first) to avoid partial matches
  const sortedCast = cast.sort((a, b) => b.name.length - a.name.length);
  
  for (const member of sortedCast) {
    // Skip very short names (likely too generic)
    if (member.name.length < 4) {
      continue;
    }
    
    // Skip if we already linked this person
    if (linkedNames.has(member.name.toLowerCase())) {
      continue;
    }
    
    const nameParts = member.name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : null;
    
    // Try multiple matching strategies
    // IMPORTANT: Only use lastName if fullName is NOT found anywhere in text
    const fullNameRegex = new RegExp(`\\b${member.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const fullNameExists = fullNameRegex.test(markdown);
    
    const strategies = [
      { name: member.name, type: 'full' },                    // Full name: "Elisabeth Moss"
    ];
    
    // Only try lastName as fallback if:
    // 1. Full name NOT in text
    // 2. lastName is unique enough (>= 5 chars)
    // 3. This is a series cast member (not random global match)
    if (!fullNameExists && lastName && lastName.length >= 5 && seriesActorIds.includes(member.tmdbId)) {
      strategies.push({ name: lastName, type: 'last' });
    }
    
    for (const strategy of strategies) {
      // Skip if this partial name was already linked to someone else
      if (linkedNames.has(strategy.name.toLowerCase())) {
        continue;
      }
      
      const escapedName = strategy.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const regex = new RegExp(
        `(?<!\\[)(?<!\\()\\b${escapedName}\\b(?!\\])(?!\\))`,
        'gim'
      );
      
      // Find first valid occurrence (not in heading, not already linked)
      regex.lastIndex = 0;
      let match;
      let validMatch = null;
      
      while ((match = regex.exec(linkedMarkdown)) !== null) {
        const matchIndex = match.index;
        const matchText = match[0];

        // Check if match is inside a heading
        const beforeMatch = linkedMarkdown.substring(Math.max(0, matchIndex - 150), matchIndex);
        const lastNewline = beforeMatch.lastIndexOf('\n');
        const lineStart = lastNewline === -1 ? beforeMatch : beforeMatch.substring(lastNewline + 1);

        // Skip if in heading (## Heading text)
        if (/^\s*#{1,6}\s/.test(lineStart)) {
          continue;
        }

        // SURNAME-CONTEXT GUARD (Mai 2026): when matching a bare last name
        // (e.g. "Brooks" for cast member "Jason Brooks"), refuse the match
        // if the adjacent context shows this is actually part of a different
        // person's name in the text (e.g. "Brooks Nader" → don't claim
        // "Brooks" for Jason Brooks here).
        if (strategy.type === 'last') {
          const tail = linkedMarkdown.slice(matchIndex + matchText.length, matchIndex + matchText.length + 40);
          // word immediately following is capitalized → looks like another surname
          if (/^\s+[A-ZÄÖÜ][\wäöüß'-]{2,}/.test(tail)) continue;

          const head = linkedMarkdown.slice(Math.max(0, matchIndex - 40), matchIndex);
          const priorWord = head.match(/([A-ZÄÖÜ][\wäöüß'-]{2,})\s+$/);
          if (priorWord && firstName && priorWord[1].toLowerCase() !== firstName.toLowerCase()) {
            // word immediately before is a different given name
            continue;
          }
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
          `[${matchText}](/person/${member.slug})` +
          linkedMarkdown.substring(matchIndex + matchText.length);
        
        linkedCount++;
        linkedNames.add(member.name.toLowerCase());
        linkedNames.add(strategy.name.toLowerCase());
        
        const fromSeries = seriesActorIds.includes(member.tmdbId) ? '(series)' : '(global)';
        console.log(`   ✅ Linked: ${matchText} → ${member.name} ${fromSeries}`);
        
        // Found a match for this person, no need to try other strategies
        break;
      }
    }
  }
  
  console.log(`   ✅ Total cast linked: ${linkedCount}`);
  
  return {
    linkedMarkdown,
    castLinked: linkedCount,
  };
}
