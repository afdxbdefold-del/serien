import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = page * limit;

    const articles = await prisma.articles.findMany({
      where: { status: 'published' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        heroLocalUrl: true,
        heroImageUrl: true,
        tmdbId: true,
        tmdbType: true,
        publishedAt: true,
        category: true,
        users: {
          select: { name: true }
        },
        series: {
          select: { 
            name: true, 
            slug: true,
            networks: true
          }
        }
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit
    });

    // Transform to match expected format
    const transformedArticles = articles.map(article => ({
      ...article,
      author: article.users,
      primarySeries: article.series
    }));

    return NextResponse.json({ 
      articles: transformedArticles,
      page,
      hasMore: articles.length === limit
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}