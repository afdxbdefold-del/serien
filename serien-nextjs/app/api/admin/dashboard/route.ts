import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export async function GET(request: NextRequest) {
  try {
    // Verify admin token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { detail: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (payload.role !== 'admin') {
        return NextResponse.json(
          { detail: 'Forbidden' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { detail: 'Invalid token' },
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