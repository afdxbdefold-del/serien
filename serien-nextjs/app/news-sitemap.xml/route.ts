import prisma from '@/lib/prisma';

export async function GET() {
  const baseUrl = 'https://serien.de';
  
  // Get articles from last 48 hours only
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  // Google News: only real news articles, max 48h old.
  // Discover-pipeline articles are the only true "news"; search-only drafts,
  // ranking-listicles, and video-imports are excluded.
  const recentArticles = await prisma.articles.findMany({
    where: {
      status: 'published',
      publishedAt: { gte: fortyEightHoursAgo },
      publishMode: 'DISCOVER',
      isRankingArticle: { not: true },
      OR: [
        { category: { not: 'neue-videos' } },
        { category: null },
      ],
    },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
      tmdbId: true,
      tmdbType: true,
      ogImageUrl: true,
      heroLocalUrl: true,
    },
    orderBy: {
      publishedAt: 'desc'
    }
  });

  const newsItems = recentArticles.map(article => {
    // Build image URL with same logic as article page
    const ogImagePath = article.ogImageUrl || 
      (article.tmdbId && article.tmdbType ? `/img/og/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl);
    const imageUrl = ogImagePath?.startsWith('http') 
      ? ogImagePath 
      : ogImagePath 
        ? `${baseUrl}${ogImagePath.startsWith('/') ? '' : '/'}${ogImagePath}`
        : null;

    return {
      url: `${baseUrl}/${article.slug}`,
      title: article.title,
      publication_date: (article.publishedAt || new Date()).toISOString(),
      imageUrl,
    };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${newsItems.map(item => `  <url>
    <loc>${item.url}</loc>
    <lastmod>${item.publication_date}</lastmod>
    <news:news>
      <news:publication>
        <news:name>Serien.de</news:name>
        <news:language>de</news:language>
      </news:publication>
      <news:publication_date>${item.publication_date}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
    </news:news>${item.imageUrl ? `
    <image:image>
      <image:loc>${escapeXml(item.imageUrl)}</image:loc>
      <image:title>${escapeXml(item.title)}</image:title>
    </image:image>` : ''}
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
