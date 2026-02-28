/**
 * Admin API: Recent Discover Dashboards
 * 
 * GET /api/admin/discover-dashboard/recent?limit=100
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    
    if (limit > 1000) {
      return NextResponse.json(
        { error: 'Limit cannot exceed 1000' },
        { status: 400 }
      );
    }

    // Get recent dashboard entries
    const dashboards = await prisma.discover_score_dashboards.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            publishMode: true,
            publishedAt: true,
            primarySeriesId: true,
          },
        },
      },
    });

    // Statistics
    const total = await prisma.discover_score_dashboards.count();
    const discoverOk = dashboards.filter(d => d.finalVerdict === 'DISCOVER_OK').length;
    const searchOnly = dashboards.filter(d => d.finalVerdict === 'SEARCH_ONLY').length;
    const avgDiscoverScore = dashboards.reduce((sum, d) => sum + d.discoverScore, 0) / dashboards.length;

    return NextResponse.json({
      success: true,
      data: {
        dashboards,
        statistics: {
          total,
          limit,
          discoverOk,
          searchOnly,
          avgDiscoverScore: avgDiscoverScore.toFixed(3),
        },
      },
    });

  } catch (error: any) {
    console.error('Recent dashboards API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
