import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Diagnostic endpoint: returns raw contentHtml link count from DB
// Usage: /api/admin/debug-links?slug=article-slug-here
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  
  if (!slug) {
    return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
  }

  const article = await prisma.articles.findFirst({
    where: { slug },
    select: { 
      id: true,
      title: true,
      contentHtml: true, 
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  const html = article.contentHtml || '';
  const personLinks = (html.match(/href="\/person\//g) || []).length;
  const figurLinks = (html.match(/href="\/figur\//g) || []).length;
  const streamerLinks = (html.match(/href="\/(netflix|disney|amazon|apple-tv|paramount|hulu|sky)-serien/g) || []).length;
  const hubLinks = (html.match(/href="\/serie\//g) || []).length;
  const allLinks = (html.match(/<a [^>]*href="[^"]*"[^>]*>/g) || []);
  
  return NextResponse.json({
    slug,
    title: article.title,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    htmlLength: html.length,
    links: {
      person: personLinks,
      figur: figurLinks,
      streamer: streamerLinks,
      hub: hubLinks,
      total: allLinks.length,
      details: allLinks.map(l => {
        const href = l.match(/href="([^"]*)"/)?.[1] || '';
        return href;
      }),
    },
  });
}
