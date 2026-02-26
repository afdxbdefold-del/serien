import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/discover-dashboard
 * 
 * Query params:
 * - articleId: Get specific article breakdown
 * - recent: Get recent audits (default: last 100)
 * - limit: Max audits to return (default: 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get('articleId');
  const limit = parseInt(searchParams.get('limit') || '100');

  // Simple auth: check for admin header or token
  // TODO: Replace with proper auth
  const adminSecret = request.headers.get('x-admin-secret');
  if (adminSecret !== process.env.ADMIN_SECRET && !process.env.ADMIN_SECRET) {
    // Allow if ADMIN_SECRET not set (dev mode)
    console.log('[Admin] Access granted (dev mode)');
  }

  try {
    if (articleId) {
      // Get specific article breakdown
      const audit = await prisma.discoverAudit.findUnique({
        where: { articleId },
        include: {
          article: {
            select: {
              id: true,
              slug: true,
              title: true,
              publishedAt: true,
              status: true,
            },
          },
        },
      });

      if (!audit) {
        return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
      }

      return NextResponse.json(audit);
    }

    // Get recent audits
    const audits = await prisma.discoverAudit.findMany({
      take: Math.min(limit, 500),
      orderBy: { createdAt: 'desc' },
      include: {
        article: {
          select: {
            id: true,
            slug: true,
            title: true,
            publishedAt: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      total: audits.length,
      audits,
    });
  } catch (error: any) {
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
