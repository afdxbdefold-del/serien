/**
 * Auto-Linking of Actors in Article Content
 * Links first occurrence only (Discover-safe)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Auto-link actors in article HTML
 * Links ONLY first occurrence of each actor name
 */
export async function autoLinkActors(
  articleId: string,
  contentHtml: string
): Promise<string> {
  try {
    // Get linked persons for this article
    const articlePersons = await prisma.articlePerson.findMany({
      where: { articleId },
      include: {
        person: true,
      },
    });

    if (articlePersons.length === 0) {
      return contentHtml;
    }

    let modifiedHtml = contentHtml;
    let linkedCount = 0;

    // Sort by name length (longest first to avoid partial matches)
    const sortedPersons = articlePersons.sort(
      (a, b) => b.person.name.length - a.person.name.length
    );

    for (const { person } of sortedPersons) {
      // Create regex for exact name match (case-insensitive, word boundaries)
      const nameRegex = new RegExp(
        `\\b(${escapeRegex(person.name)})\\b`,
        'i'
      );

      // Find first occurrence (not inside HTML tags)
      const match = findFirstOccurrenceOutsideHTML(modifiedHtml, nameRegex);

      if (match) {
        const { index, matchedText } = match;

        // Create link
        const link = `<a href="/person/${person.slug}" title="${person.name} – Serien & Biografie" class="actor-link">${matchedText}</a>`;

        // Replace first occurrence
        modifiedHtml =
          modifiedHtml.slice(0, index) +
          link +
          modifiedHtml.slice(index + matchedText.length);

        linkedCount++;
        console.log(`   🔗 Linked: ${person.name} → /person/${person.slug}`);
      }
    }

    if (linkedCount > 0) {
      console.log(`✅ Auto-linked ${linkedCount} actors in content`);
    }

    return modifiedHtml;
  } catch (error) {
    console.error('❌ Auto-linking failed:', error);
    return contentHtml;
  }
}

/**
 * Find first occurrence of pattern outside HTML tags
 */
function findFirstOccurrenceOutsideHTML(
  html: string,
  pattern: RegExp
): { index: number; matchedText: string } | null {
  let inTag = false;
  let currentText = '';
  let currentIndex = 0;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];

    if (char === '<') {
      // Check accumulated text before entering tag
      if (!inTag && currentText) {
        const match = currentText.match(pattern);
        if (match && match.index !== undefined) {
          return {
            index: currentIndex + match.index,
            matchedText: match[0],
          };
        }
      }
      inTag = true;
      currentText = '';
    } else if (char === '>') {
      inTag = false;
      currentText = '';
      currentIndex = i + 1;
    } else if (!inTag) {
      currentText += char;
    }
  }

  // Check remaining text
  if (currentText) {
    const match = currentText.match(pattern);
    if (match && match.index !== undefined) {
      return {
        index: currentIndex + match.index,
        matchedText: match[0],
      };
    }
  }

  return null;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Apply auto-linking to article
 * Updates article content in database
 */
export async function applyAutoLinking(articleId: string): Promise<boolean> {
  try {
    const article = await prisma.articles.findUnique({
      where: { id: articleId },
      select: { contentHtml: true },
    });

    if (!article || !article.contentHtml) {
      return false;
    }

    const linkedHtml = await autoLinkActors(articleId, article.contentHtml);

    if (linkedHtml !== article.contentHtml) {
      await prisma.articles.update({
        where: { id: articleId },
        data: { contentHtml: linkedHtml },
      });

      console.log('✅ Auto-linking applied and saved to article');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Apply auto-linking failed:', error);
    return false;
  }
}
