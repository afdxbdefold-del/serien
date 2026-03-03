/**
 * INTERNAL_LINKING_ENGINE
 * 
 * Automatische interne Verlinkung zwischen Artikeln und Serien-Hubs
 * Optimiert für Google Search & Discover
 */

import prisma from './prisma'; // Use shared Prisma instance

interface InternalLinksConfig {
  articleId: string;
  contentHtml: string;
  primarySeriesId: string;
  primarySeriesName: string;
  primarySeriesSlug: string;
  publishedAt: Date | null;
}

interface InternalLinksResult {
  updatedContentHtml: string;
  hubLink: string;
  relatedArticles: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt: Date | null;
  }>;
  totalInternalLinks: number;
}

export async function generateInternalLinks(
  config: InternalLinksConfig
): Promise<InternalLinksResult> {
  // 1. Hub Link (PFLICHT)
  const hubLink = `/serie/${config.primarySeriesSlug}`;

  // 2. Find related articles (max 2)
  const relatedArticles = await findRelatedArticles(
    config.articleId,
    config.primarySeriesId,
    config.publishedAt
  );

  // 3. Inject links into content
  const updatedContentHtml = injectLinksIntoContent(
    config.contentHtml,
    config.primarySeriesName,
    hubLink,
    relatedArticles
  );

  // 4. Count total internal links (for validation)
  const totalInternalLinks = countInternalLinks(updatedContentHtml);

  return {
    updatedContentHtml,
    hubLink,
    relatedArticles,
    totalInternalLinks,
  };
}

async function findRelatedArticles(
  currentArticleId: string,
  seriesId: string,
  publishedAt: Date | null
): Promise<Array<{ id: string; title: string; slug: string; publishedAt: Date | null }>> {
  // Find max 2 related articles from same series
  // Priority: Most recent, but not the current article
  
  const articles = await prisma.articles.findMany({
    where: {
      primarySeriesId: seriesId,
      id: { not: currentArticleId },
      status: 'published',
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
    take: 3, // Get 3, we'll filter to 2 best
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
      contentHtml: true,
    },
  });

  // Filter to max 2, prefer thematically related
  // (e.g. renewal → start date)
  return articles.slice(0, 2);
}

function injectLinksIntoContent(
  html: string,
  seriesName: string,
  hubLink: string,
  relatedArticles: Array<{ title: string; slug: string; publishedAt: Date | null }>
): string {
  const paragraphs = html.split('</p>');
  
  if (paragraphs.length < 2) {
    // Not enough structure, return as-is
    return html;
  }

  // === 1. INJECT HUB LINK AFTER LEAD (after first or second paragraph) ===
  const hubLinkHtml = `\n\n<p class="internal-link-box"><a href="${hubLink}" rel="follow">Weitere News zu ${seriesName} auf serien.de</a></p>`;
  
  // Insert after second paragraph (assuming first = lead, second = context)
  let updatedHtml = '';
  paragraphs.forEach((para, index) => {
    updatedHtml += para;
    if (index < paragraphs.length - 1) {
      updatedHtml += '</p>';
    }
    
    // Insert hub link after paragraph 2
    if (index === 1) {
      updatedHtml += hubLinkHtml;
    }
  });

  // === 2. INJECT HUB LINK AT END ===
  const endLinkHtml = `\n\n<p class="internal-link-box"><a href="${hubLink}" rel="follow">Alle Entwicklungen zur Serie ${seriesName}</a></p>`;
  
  updatedHtml += endLinkHtml;

  // === 3. OPTIONAL: INJECT RELATED ARTICLES (if available) ===
  if (relatedArticles.length > 0) {
    const relatedLinksHtml = generateRelatedArticlesHtml(relatedArticles);
    updatedHtml += `\n\n${relatedLinksHtml}`;
  }

  return updatedHtml;
}

function generateRelatedArticlesHtml(
  articles: Array<{ title: string; slug: string; publishedAt: Date | null }>
): string {
  const links = articles.map(article => {
    const dateStr = article.publishedAt
      ? new Date(article.publishedAt).toLocaleDateString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';
    
    return `<li><a href="/${article.slug}" rel="follow">${article.title}</a> ${dateStr ? `(${dateStr})` : ''}</li>`;
  }).join('\n');

  return `<div class="related-articles">
<p><strong>Weitere Artikel zur Serie:</strong></p>
<ul>
${links}
</ul>
</div>`;
}

function countInternalLinks(html: string): number {
  // Count all <a> tags (internal links)
  const matches = html.match(/<a /g);
  return matches ? matches.length : 0;
}

export function validateInternalLinks(
  html: string,
  seriesName: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Rule 1: Max 10 internal links
  const linkCount = countInternalLinks(html);
  if (linkCount > 10) {
    errors.push(`Zu viele interne Links: ${linkCount} (max: 10)`);
  }

  // Rule 2: Series name must appear in links exactly as-is
  const links = html.match(/<a [^>]*>([^<]+)<\/a>/g) || [];
  links.forEach(link => {
    if (link.includes(seriesName)) {
      // Check if series name is altered
      const linkText = link.match(/>([^<]+)<\/a>/)?.[1] || '';
      if (linkText.includes(seriesName) && !linkText.includes(seriesName)) {
        errors.push(`Serienname im Link verändert: "${linkText}"`);
      }
    }
  });

  // Rule 3: No "Hier klicken" or "Mehr erfahren"
  const forbiddenPhrases = ['hier klicken', 'mehr erfahren', 'klick hier'];
  links.forEach(link => {
    const linkText = link.match(/>([^<]+)<\/a>/)?.[1]?.toLowerCase() || '';
    forbiddenPhrases.forEach(phrase => {
      if (linkText.includes(phrase)) {
        errors.push(`Verbotener Link-Text: "${linkText}"`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
