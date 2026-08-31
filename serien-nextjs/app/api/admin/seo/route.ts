import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdminRequest } from '@/lib/admin-auth';
import { runFullAudit, runHttpAudit, generateAiSummary, compareRuns, generateCsvExport, ISSUE_LABELS } from '@/lib/seo-auditor';

// GET /api/admin/seo
export async function GET(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
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
        crawlRun: null, pages: [], issueBreakdown: {},
        history: [], issueLabels: ISSUE_LABELS,
      });
    }

    const where: any = { crawlRunId: crawlRun.id };
    if (pageType) where.pageType = pageType;

    let allPages = await prisma.seo_page_results.findMany({
      where, orderBy: { url: 'asc' },
    });

    // Filter by severity or issue type
    if (severity || issueType) {
      allPages = allPages.filter(p => {
        const issues = p.issues as any[];
        if (severity && issueType) {
          return issues.some(i => i.severity === severity && i.type === issueType);
        }
        if (severity) return issues.some(i => i.severity === severity);
        if (issueType) return issues.some(i => i.type === issueType);
        return true;
      });
    }

    const total = allPages.length;
    const paginatedPages = allPages.slice((page - 1) * limit, page * limit);

    // Issue breakdown
    const issueBreakdown: Record<string, { count: number; severity: string }> = {};
    const allPagesForBreakdown = await prisma.seo_page_results.findMany({ where: { crawlRunId: crawlRun.id } });
    for (const p of allPagesForBreakdown) {
      const issues = p.issues as any[];
      for (const issue of issues) {
        if (!issueBreakdown[issue.type]) {
          issueBreakdown[issue.type] = { count: 0, severity: issue.severity };
        }
        issueBreakdown[issue.type].count++;
      }
    }

    // History (last 10)
    const history = await prisma.seo_crawl_runs.findMany({
      where: { status: 'completed' },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true, healthScore: true, totalPages: true,
        issuesFound: true, criticalCount: true, warningCount: true,
        infoCount: true, startedAt: true, trigger: true,
      },
    });

    // Comparison with previous run
    let comparison = null;
    try {
      comparison = await compareRuns(crawlRun.id);
    } catch { /* no previous run */ }

    return NextResponse.json({
      crawlRun, pages: paginatedPages, total, page, limit,
      issueBreakdown, history, issueLabels: ISSUE_LABELS, comparison,
    });
  } catch (error: any) {
    console.error('SEO API error:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}

// POST /api/admin/seo
export async function POST(request: NextRequest) {
  if (!(await verifyAdminRequest(request))) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action || 'crawl';

    if (action === 'crawl') {
      const running = await prisma.seo_crawl_runs.findFirst({
        where: { status: 'running' },
      });
      if (running) {
        return NextResponse.json(
          { detail: 'Ein Audit läuft bereits.', runId: running.id },
          { status: 409 }
        );
      }

      // Run DB audit
      const runId = await runFullAudit('manual');
      const result = await prisma.seo_crawl_runs.findUnique({ where: { id: runId } });
      return NextResponse.json({ success: true, crawlRun: result });
    }

    if (action === 'http_audit') {
      const { runId, sampleSize } = body;

      // Either use existing run or create fresh one with DB audit first
      let targetRunId = runId;
      if (!targetRunId) {
        targetRunId = await runFullAudit('manual');
      }

      // Run HTTP audit (this adds to the existing run)
      await runHttpAudit(targetRunId, sampleSize || 50);
      const result = await prisma.seo_crawl_runs.findUnique({ where: { id: targetRunId } });
      return NextResponse.json({ success: true, crawlRun: result });
    }

    if (action === 'ai_summary') {
      const { runId } = body;
      if (!runId) return NextResponse.json({ detail: 'runId required' }, { status: 400 });
      const summary = await generateAiSummary(runId);
      return NextResponse.json({ success: true, summary });
    }

    if (action === 'export_csv') {
      const { runId } = body;
      if (!runId) return NextResponse.json({ detail: 'runId required' }, { status: 400 });
      const csv = await generateCsvExport(runId);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="seo-audit-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({ detail: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('SEO POST error:', error);
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
