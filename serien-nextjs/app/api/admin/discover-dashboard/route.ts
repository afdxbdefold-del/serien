import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/discover-dashboard
 *
 * Query params:
 * - articleId: Get specific article breakdown (latest run)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get('articleId');

  try {
    if (articleId) {
      const dashboard = await prisma.discover_score_dashboards.findFirst({
        where: { articleId },
        orderBy: { timestamp: 'desc' },
      });

      if (!dashboard) {
        return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
      }

      return NextResponse.json(dashboard);
    }

    return NextResponse.json({ error: 'articleId required. Use /recent for list.' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
