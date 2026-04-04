import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { runFullAudit, generateAiSummary, ISSUE_LABELS } from '@/lib/seo-auditor';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

async function verifyAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  try {
    const { payload } = await jwtVerify(authHeader.substring(7), JWT_SECRET);
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// GET /api/admin/seo - Retrieve latest audit results
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  const pageType = searchParams.get('pageType');
  const severity = searchParams.get('severity');
  const issueType = searchParams.get('issueType');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    // Get specific run or latest
    let crawlRun;
    if (runId) {
      crawlRun = await prisma.seo_crawl_runs.findUnique({ where: { id: runId } });
    } else {
      crawlRun = await prisma.seo_crawl_runs.findFirst({
        where: { status: 'completed' },
        orderBy: { startedAt: 'desc' },
      });
    }

    if (!crawlRun) {
      return NextResponse.json({
        crawlRun: null,
        pages: [],
        issueBreakdown: {},
        history: [],
        issueLabels: ISSUE_LABELS,
      });
    }

    // Build page filter
    const where: any = { crawlRunId: crawlRun.id };
    if (pageType) where.pageType = pageType;

    // Get pages with issues
    let allPages = await prisma.seo_page_results.findMany({
      where,
      orderBy: { url: 'asc' },
    });

    // Filter by severity or issue type in-memory (JSON field)
    if (severity || issueType) {
      allPages = allPages.filter(p => {
        const issues = p.issues as any[];
        if (severity) return issues.some(i => i.severity === severity);
        if (issueType) return issues.some(i => i.type === issueType);
        return true;
      });
    }

    const total = allPages.length;
    const paginatedPages = allPages.slice((page - 1) * limit, page * limit);

    // Build issue breakdown
    const issueBreakdown: Record<string, { count: number; severity: string }> = {};
    for (const p of await prisma.seo_page_results.findMany({ where: { crawlRunId: crawlRun.id } })) {
      const issues = p.issues as any[];
      for (const issue of issues) {
        if (!issueBreakdown[issue.type]) {
          issueBreakdown[issue.type] = { count: 0, severity: issue.severity };
        }
        issueBreakdown[issue.type].count++;
      }
    }

    // Get crawl history (last 10)
    const history = await prisma.seo_crawl_runs.findMany({
      where: { status: 'completed' },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true, healthScore: true, totalPages: true,
        issuesFound: true, criticalCount: true, warningCount: true,
        startedAt: true, trigger: true,
      },
    });

    return NextResponse.json({
      crawlRun,
      pages: paginatedPages,
      total,
      page,
      limit,
      issueBreakdown,
      history,
      issueLabels: ISSUE_LABELS,
    });
  } catch (error: any) {
    console.error('SEO API error:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

// POST /api/admin/seo - Trigger new audit or generate AI summary
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action || 'crawl';

    if (action === 'crawl') {
      // Check if a crawl is already running
      const running = await prisma.seo_crawl_runs.findFirst({
        where: { status: 'running' },
      });
      if (running) {
        return NextResponse.json(
          { detail: 'Ein Audit läuft bereits.', runId: running.id },
          { status: 409 }
        );
      }

      // Run audit (blocking for now since it's DB-driven and fast)
      const runId = await runFullAudit('manual');
      const result = await prisma.seo_crawl_runs.findUnique({ where: { id: runId } });

      return NextResponse.json({ success: true, crawlRun: result });
    }

    if (action === 'ai_summary') {
      const { runId } = body;
      if (!runId) {
        return NextResponse.json({ detail: 'runId required' }, { status: 400 });
      }
      const summary = await generateAiSummary(runId);
      return NextResponse.json({ success: true, summary });
    }

    return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('SEO POST error:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
