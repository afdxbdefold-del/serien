/**
 * Headline Comparison Dashboard - Recent Comparisons
 * 
 * GET /api/admin/headline-dashboard/recent?limit=100
 * 
 * Returns recent headline comparisons with statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    
    if (limit > 500) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 500' },
        { status: 400 }
      );
    }

    // Get recent comparisons
    const comparisons = await prisma.headline_comparisons.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
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

    // Calculate statistics
    const total = await prisma.headline_comparisons.count();
    const improved = comparisons.filter(c => c.status === 'IMPROVED').length;
    const neutral = comparisons.filter(c => c.status === 'NEUTRAL').length;
    const worse = comparisons.filter(c => c.status === 'WORSE').length;
    const noRewrite = comparisons.filter(c => c.status === 'NO_REWRITE').length;
    
    const rewritten = comparisons.filter(c => c.headline_rewritten !== null);
    const avgDelta = rewritten.length > 0
      ? rewritten.reduce((sum, c) => sum + (c.headline_delta || 0), 0) / rewritten.length
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        comparisons,
        statistics: {
          total,
          limit,
          improved,
          neutral,
          worse,
          noRewrite,
          rewriteRate: total > 0 ? ((total - noRewrite) / total * 100).toFixed(1) : '0',
          avgDelta: avgDelta.toFixed(1),
        },
      },
    });

  } catch (error: any) {
    console.error('Recent comparisons API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
