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
    });
    
    // Get article info for each dashboard
    const articleIds = dashboards.map(d => d.articleId);
    const articles = await prisma.articles.findMany({
      where: { id: { in: articleIds } },
      select: {
        id: true,
        title: true,
        slug: true,
        publishMode: true,
        publishedAt: true,
      }
    });
    
    // Merge article data into dashboards
    const articlesMap = new Map(articles.map(a => [a.id, a]));
    const dashboardsWithArticles = dashboards.map(d => ({
      ...d,
      article: articlesMap.get(d.articleId) || null
    }));

    // Fetch rewrite-loop outcomes from pipeline_runs for these articles
    const runs = await prisma.pipeline_runs.findMany({
      where: { articleId: { in: articleIds } },
      orderBy: { startedAt: 'desc' },
      select: { articleId: true, metadata: true },
      distinct: ['articleId'],
    });
    const rewriteByArticle = new Map<string, any>();
    for (const r of runs) {
      const rw = (r.metadata as any)?.headlineRewrite;
      if (rw && r.articleId) rewriteByArticle.set(r.articleId, rw);
    }

    // Rewrite statistics
    const rewriteAttempted = Array.from(rewriteByArticle.values()).filter((r: any) => r.attempted).length;
    const rewriteApplied = Array.from(rewriteByArticle.values()).filter((r: any) => r.applied).length;
    const rewriteGains = Array.from(rewriteByArticle.values()).filter((r: any) => r.applied).map((r: any) => r.gain || 0);
    const avgRewriteGain = rewriteGains.length > 0 ? rewriteGains.reduce((a, b) => a + b, 0) / rewriteGains.length : 0;

    // Statistics
    const total = await prisma.discover_score_dashboards.count();
    const discoverOk = dashboardsWithArticles.filter(d => d.finalVerdict === 'DISCOVER_OK').length;
    const searchOnly = dashboardsWithArticles.filter(d => d.finalVerdict === 'SEARCH_ONLY').length;
    const avgDiscoverScore = dashboardsWithArticles.length > 0 
      ? dashboardsWithArticles.reduce((sum, d) => sum + d.discoverScore, 0) / dashboardsWithArticles.length 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        dashboards: dashboardsWithArticles,
        statistics: {
          total,
          limit,
          discoverOk,
          searchOnly,
          avgDiscoverScore: avgDiscoverScore.toFixed(3),
          rewrite: {
            attempted: rewriteAttempted,
            applied: rewriteApplied,
            avgGain: Number(avgRewriteGain.toFixed(1)),
          },
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
