import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  // Get articles from last 48 hours only
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  
  const recentArticles = await prisma.article.findMany({
    where: {
      status: 'published',
      publishedAt: {
        gte: fortyEightHoursAgo
      }
    },
    select: {
      slug: true,
      title: true,
      publishedAt: true,
    },
    orderBy: {
      publishedAt: 'desc'
    }
  });

  // Generate Google News Sitemap XML
  const newsItems = recentArticles.map(article => ({
    url: `${baseUrl}/${article.slug}`,
    title: article.title,
    publication_date: (article.publishedAt || new Date()).toISOString(),
  }));

  // Return raw XML for Google News
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsItems.map(item => `  <url>
    <loc>${item.url}</loc>
    <news:news>
      <news:publication>
        <news:name>serien.de</news:name>
        <news:language>de</news:language>
      </news:publication>
      <news:publication_date>${item.publication_date}</news:publication_date>
      <news:title>${escapeXml(item.title)}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
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
