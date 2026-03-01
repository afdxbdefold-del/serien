/**
 * Character Auto-linking Utility
 * Automatically links character names in article HTML to their character pages
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Character {
  name: string;
  slug: string;
}

/**
 * Links character names in article HTML to their character pages
 * Only links the FIRST occurrence of each character name
 * @param articleHtml - The HTML content of the article
 * @param seriesTmdbId - The TMDB ID of the series
 * @returns Updated HTML with character links
 */
export async function linkCharactersInArticle(
  articleHtml: string,
  seriesTmdbId: number
): Promise<string> {
  try {
    // Fetch all published characters for this series
    const characters = await prisma.characters.findMany({
      where: {
        seriesTmdbId,
        publishStatus: 'published',
      },
      select: {
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'desc', // Longer names first to avoid partial matches
      },
    });

    if (characters.length === 0) {
      return articleHtml;
    }

    let updatedHtml = articleHtml;

    // Process each character
    for (const character of characters) {
      // Create regex to find the character name
      // - Must be word boundary
      // - Case insensitive
      // - Not already inside an <a> tag
      const namePattern = new RegExp(
        `\\b(${escapeRegex(character.name)})\\b`,
        'i'
      );

      // Check if character name exists in the HTML (outside of tags)
      // We'll use a simple approach: find text nodes only
      const textMatch = updatedHtml.match(namePattern);
      
      if (textMatch) {
        // Make sure we're not inside an existing link or tag
        const beforeMatch = updatedHtml.substring(0, textMatch.index!);
        const afterMatch = updatedHtml.substring(textMatch.index! + textMatch[0].length);
        
        // Simple check: if last < before match is closed by > after it, we're in a tag
        const lastOpenTag = beforeMatch.lastIndexOf('<');
        const lastCloseTag = beforeMatch.lastIndexOf('>');
        
        // Only link if we're not inside a tag or existing link
        if (lastCloseTag > lastOpenTag) {
          // Also check we're not inside an <a> tag
          const linkCheck = beforeMatch.match(/<a[^>]*$/);
          const closingLinkCheck = afterMatch.match(/^[^<]*<\/a>/);
          
          if (!linkCheck && !closingLinkCheck) {
            // Replace first occurrence with link
            const characterLink = `<a href="/figur/${character.slug}" class="text-blue-600 hover:text-blue-800 underline font-medium">${textMatch[1]}</a>`;
            updatedHtml = updatedHtml.replace(namePattern, characterLink);
          }
        }
      }
    }

    return updatedHtml;
  } catch (error) {
    console.error('[Character Linking] Error:', error);
    // Return original HTML on error to avoid breaking articles
    return articleHtml;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update existing articles for a series with character links
 * @param seriesTmdbId - The TMDB ID of the series
 * @returns Number of articles updated
 */
export async function updateExistingArticlesWithCharacterLinks(
  seriesTmdbId: number
): Promise<number> {
  try {
    // Get all published articles for this series
    const articles = await prisma.articles.findMany({
      where: {
        primarySeriesId: seriesTmdbId,
        status: 'published',
      },
      select: {
        id: true,
        contentHtml: true,
      },
    });

    console.log(`[Character Linking] Found ${articles.length} articles for series ${seriesTmdbId}`);

    let updatedCount = 0;

    for (const article of articles) {
      const originalHtml = article.contentHtml;
      const updatedHtml = await linkCharactersInArticle(originalHtml, seriesTmdbId);

      // Only update if HTML changed
      if (updatedHtml !== originalHtml) {
        await prisma.articles.update({
          where: { id: article.id },
          data: { contentHtml: updatedHtml },
        });
        updatedCount++;
        console.log(`[Character Linking] Updated article ${article.id}`);
      }
    }

    console.log(`[Character Linking] Updated ${updatedCount} articles`);
    return updatedCount;
  } catch (error) {
    console.error('[Character Linking] Error updating articles:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
