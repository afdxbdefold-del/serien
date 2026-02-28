/**
 * Headline Comparison Dashboard API
 * 
 * GET /api/admin/headline-dashboard?articleId=xxx
 * 
 * Returns comparison between original and rewritten headline
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    
    if (!articleId) {
      return NextResponse.json(
        { error: 'articleId parameter required' },
        { status: 400 }
      );
    }

    // Get headline comparison for specific article
    const comparison = await prisma.headline_comparisons.findUnique({
      where: { articleId },
      include: {
        article: {
          select: {
            id: true,
            slug: true,
            title: true,
            publishMode: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!comparison) {
      return NextResponse.json(
        { error: 'Headline comparison not found for this article' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: comparison,
    });

  } catch (error: any) {
    console.error('Headline Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
