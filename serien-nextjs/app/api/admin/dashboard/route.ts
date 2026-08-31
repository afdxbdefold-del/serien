import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdminRequest } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    if (!(await verifyAdminRequest(request))) {
      return NextResponse.json(
        { detail: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch stats
    const [totalNews, totalSeries, totalUsers, recentNews] = await Promise.all([
      prisma.articles.count({ where: { status: 'published' } }),
      prisma.series.count(),
      prisma.users.count(),
      prisma.articles.count({
        where: {
          status: 'published',
          createdAt: {
            gte: new Date(Date.now() - 48 * 60 * 60 * 1000) // Last 48 hours
          }
        }
      })
    ]);

    return NextResponse.json({
      total_news: totalNews,
      total_series: totalSeries,
      total_users: totalUsers,
      recent_news_48h: recentNews,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { detail: 'Fehler beim Laden der Statistiken' },
      { status: 500 }
    );
  }
}
