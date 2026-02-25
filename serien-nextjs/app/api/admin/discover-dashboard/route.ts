/**
 * Admin API: Discover Dashboard
 * 
 * GET /api/admin/discover-dashboard?articleId=xxx
 * GET /api/admin/discover-dashboard/recent?limit=100
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

    // Get dashboard data for specific article
    const dashboard = await prisma.discoverScoreDashboard.findFirst({
      where: { articleId },
      orderBy: { timestamp: 'desc' },
      include: {
        article: {
          select: {
            id: true,
            title: true,
            slug: true,
            publishMode: true,
            publishedAt: true,
          },
        },
      },
    });

    if (!dashboard) {
      return NextResponse.json(
        { error: 'Dashboard not found for this article' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: dashboard,
    });

  } catch (error: any) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
