import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '20');

    const articles = await prisma.articles.findMany({
      where: { status: 'published' },
      include: {
        author: {
          select: { name: true, email: true }
        },
        series: {
          select: { title: true, slug: true }
        }
      },
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit
    });

    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching news:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
}