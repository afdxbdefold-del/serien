/**
 * Auto-Linking of Actors in Article Content
 * Links first occurrence only (Discover-safe)
 */

import { PrismaClient } from '@prisma/client';
import { linkPersonNamesInHtml } from './person-link-safety';

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
    const articlePersons = await prisma.article_persons.findMany({
      where: { articleId },
      include: {
        persons: true,
      },
    });

    if (articlePersons.length === 0) {
      return contentHtml;
    }

    // Use the same conservative identity and DOM boundaries as pipeline links.
    // Never infer a person from a surname, or link inside an existing anchor.
    const result = linkPersonNamesInHtml(
      contentHtml,
      articlePersons.map(({ persons }) => ({ name: persons.name, slug: persons.slug }))
    );

    if (result.linked > 0) {
      console.log(`✅ Auto-linked ${result.linked} actors in content`);
    }

    return result.html;
  } catch (error) {
    console.error('❌ Auto-linking failed:', error);
    return contentHtml;
  }
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
