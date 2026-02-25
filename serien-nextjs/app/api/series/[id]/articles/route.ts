/**
 * Series Hub - Recent Articles API
 * 
 * GET /api/series/[id]/articles?limit=7
 * 
 * Returns recent articles for a series (for Hub page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const seriesId = params.id;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '7', 10);

    if (limit > 20) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 20' },
        { status: 400 }
      );
    }

    // Get recent articles for this series
    const articles = await prisma.article.findMany({
      where: {
        primarySeriesId: seriesId,
        status: 'published',
        publishedAt: { not: null },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        publishedAt: true,
        wasBedeutetDasText: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        articles: articles.map(a => ({
          ...a,
          // Generate 1-sentence teaser from excerpt
          teaser: a.excerpt ? a.excerpt.split('.')[0] + '.' : a.wasBedeutetDasText || '',
        })),
        total: articles.length,
      },
    });

  } catch (error: any) {
    console.error('Series Articles API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
