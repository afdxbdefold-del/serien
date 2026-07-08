'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle, Info, RefreshCw, Search, ChevronDown, ChevronUp,
  ArrowLeft, Loader2, Shield, Sparkles, ExternalLink, Filter, BarChart3,
  AlertCircle, XCircle, Clock, Globe, Zap, FileSearch, Map, Download,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';

// ──── Types ────

interface CrawlRun {
  id: string;
  status: string;
  totalPages: number;
  issuesFound: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  healthScore: number;
  aiSummary: string | null;
  startedAt: string;
  completedAt: string | null;
  trigger: string;
}

interface PageResult {
  id: string;
  url: string;
  pageType: string;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  contentHash: string | null;
  internalLinks: number;
  responseTimeMs: number | null;
  hasJsonLd: boolean | null;
  issues: SeoIssue[];
}

interface SeoIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: string;
}

interface IssueBreakdown {
  [key: string]: { count: number; severity: string };
}

interface HistoryItem {
  id: string;
  healthScore: number;
  totalPages: number;
  issuesFound: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  startedAt: string;
  trigger: string;
}

interface RunComparison {
  previousRun: { id: string; healthScore: number; startedAt: string } | null;
  scoreDelta: number;
  newIssues: { type: string; count: number }[];
  fixedIssues: { type: string; count: number }[];
}

// ──── Helpers ────

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('admin_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function severityIcon(sev: string) {
  if (sev === 'critical') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (sev === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
}

function severityBadge(sev: string) {
  const m: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    info: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  };
  const label = sev === 'critical' ? 'Kritisch' : sev === 'warning' ? 'Warnung' : 'Hinweis';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m[sev] || m.info}`}>{label}</span>;
}

function scoreColor(s: number) { return s >= 80 ? 'text-emerald-500' : s >= 60 ? 'text-amber-500' : 'text-red-500'; }
function scoreBg(s: number) { return s >= 80 ? 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20' : s >= 60 ? 'from-amber-500/10 to-amber-500/5 border-amber-500/20' : 'from-red-500/10 to-red-500/5 border-red-500/20'; }
function scoreRing(s: number) { return s >= 80 ? 'stroke-emerald-500' : s >= 60 ? 'stroke-amber-500' : 'stroke-red-500'; }

function statusCodeBadge(code: number | null) {
  if (!code) return null;
  const cls = code >= 200 && code < 300 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    : code >= 300 && code < 400 ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return <span className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${cls}`}>{code}</span>;
}

// ──── Score Circle ────

function HealthScoreCircle({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" className="stroke-gray-200 dark:stroke-gray-700" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="8" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" className={`${scoreRing(score)} transition-all duration-1000`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

// ──── Issue Row ────

function IssueRow({ page, issueLabels }: { page: PageResult; issueLabels: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const criticals = page.issues.filter(i => i.severity === 'critical').length;
  const warnings = page.issues.filter(i => i.severity === 'warning').length;

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition text-left"
        data-testid={`seo-issue-row-${page.id}`}
      >
        {criticals > 0 ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : warnings > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> : <Info className="w-4 h-4 text-sky-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{page.title || page.url}</p>
          <p className="text-xs text-gray-500 truncate">{page.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusCodeBadge(page.statusCode)}
          {page.responseTimeMs !== null && (
            <span className={`text-xs font-mono ${page.responseTimeMs > 3000 ? 'text-red-500' : page.responseTimeMs > 1500 ? 'text-amber-500' : 'text-emerald-500'}`}>
              {(page.responseTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          {page.hasJsonLd !== null && (
            <span className={`text-xs ${page.hasJsonLd ? 'text-emerald-500' : 'text-gray-400'}`}>
              {page.hasJsonLd ? 'LD+' : 'LD-'}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">{page.pageType}</span>
          <span className="text-xs text-gray-500">{page.issues.length}</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {/* HTTP metadata row */}
          {(page.statusCode || page.h1 || page.canonical || page.robotsMeta) && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 text-xs space-y-1 mb-2">
              {page.statusCode && <div><span className="font-medium text-gray-500">Status:</span> {statusCodeBadge(page.statusCode)}</div>}
              {page.h1 && <div><span className="font-medium text-gray-500">H1:</span> <span className="text-gray-700 dark:text-gray-300">{page.h1}</span></div>}
              {page.canonical && <div className="truncate"><span className="font-medium text-gray-500">Canonical:</span> <span className="text-gray-700 dark:text-gray-300">{page.canonical}</span></div>}
              {page.robotsMeta && <div><span className="font-medium text-gray-500">Robots:</span> <span className="text-gray-700 dark:text-gray-300">{page.robotsMeta}</span></div>}
              {page.responseTimeMs !== null && <div><span className="font-medium text-gray-500">Ladezeit:</span> <span className={page.responseTimeMs > 3000 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}>{page.responseTimeMs}ms</span></div>}
            </div>
          )}
          {page.issues.map((issue, idx) => (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {severityIcon(issue.severity)}
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">{issueLabels[issue.type] || issue.type}:</span>
                <span className="text-gray-600 dark:text-gray-400 ml-1">{issue.message}</span>
                {issue.details && <p className="text-xs text-gray-400 mt-0.5">{issue.details}</p>}
              </div>
            </div>
          ))}
          <a href={page.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:underline mt-1">
            Seite öffnen <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </div>
  );
}

// ──── Main Dashboard ────

export default function SeoAuditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [httpCrawling, setHttpCrawling] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [crawlRun, setCrawlRun] = useState<CrawlRun | null>(null);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [total, setTotal] = useState(0);
  const [issueBreakdown, setIssueBreakdown] = useState<IssueBreakdown>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [issueLabels, setIssueLabels] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPageType, setFilterPageType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [comparison, setComparison] = useState<RunComparison | null>(null);
  const [httpSampleSize, setHttpSampleSize] = useState(50);

  const fetchData = useCallback(async (page = 1, runId?: string) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterType) params.set('issueType', filterType);
      if (filterPageType) params.set('pageType', filterPageType);
      if (runId) params.set('runId', runId);

      const res = await fetch(`/api/admin/seo?${params}`, { headers: getAuthHeaders() });
      if (res.status === 401) { router.push('/admin/login'); return; }
      const data = await res.json();

      setCrawlRun(data.crawlRun);
      setPages(data.pages || []);
      setTotal(data.total || 0);
      setIssueBreakdown(data.issueBreakdown || {});
      setHistory(data.history || []);
      setIssueLabels(data.issueLabels || {});
      setCurrentPage(page);
      setComparison(data.comparison || null);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, filterSeverity, filterType, filterPageType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startDbAudit = async () => {
    setCrawling(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'crawl' }),
      });
      if (res.ok) { setFilterSeverity(''); setFilterType(''); setFilterPageType(''); await fetchData(); }
      else { const d = await res.json(); alert(d.detail || 'Fehler'); }
    } catch (err) { console.error(err); }
    finally { setCrawling(false); }
  };

  const startHttpAudit = async () => {
    if (!crawlRun) return;
    setHttpCrawling(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'http_audit', runId: crawlRun.id, sampleSize: httpSampleSize }),
      });
      if (res.ok) { await fetchData(1, crawlRun.id); }
      else { const d = await res.json(); alert(d.detail || 'Fehler'); }
    } catch (err) { console.error(err); }
    finally { setHttpCrawling(false); }
  };

  const exportCsv = async () => {
    if (!crawlRun) return;
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'export_csv', runId: crawlRun.id }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seo-audit-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) { console.error(err); }
  };

  const generateSummary = async () => {
    if (!crawlRun) return;
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'ai_summary', runId: crawlRun.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCrawlRun(prev => prev ? { ...prev, aiSummary: data.summary } : null);
      }
    } catch (err) { console.error(err); }
    finally { setGeneratingAi(false); }
  };

  const filteredPages = searchTerm
    ? pages.filter(p =>
        (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.url.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : pages;

  const sortedIssues = Object.entries(issueBreakdown).sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const sDiff = (sevOrder[a[1].severity] ?? 2) - (sevOrder[b[1].severity] ?? 2);
    return sDiff !== 0 ? sDiff : b[1].count - a[1].count;
  });

  // Categorize issues
  const dbIssues = sortedIssues.filter(([type]) =>
    !['http_error','wrong_canonical','missing_canonical_tag','missing_robots_meta','noindex_detected','missing_h1','multiple_h1','missing_jsonld','invalid_jsonld_type','missing_og_tags','slow_response','sitemap_missing_url','sitemap_orphan','sitemap_unreachable'].includes(type)
  );
  const httpIssues = sortedIssues.filter(([type]) =>
    ['http_error','wrong_canonical','missing_canonical_tag','missing_robots_meta','noindex_detected','missing_h1','multiple_h1','missing_jsonld','invalid_jsonld_type','missing_og_tags','slow_response','news_missing_date','news_missing_author','news_missing_source','news_missing_tmdb','feed_indexable'].includes(type)
  );
  const sitemapIssues = sortedIssues.filter(([type]) =>
    ['sitemap_missing_url','sitemap_orphan','sitemap_unreachable'].includes(type)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" data-testid="seo-audit-page">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" data-testid="back-to-dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-500" /> SEO Audit
              </h1>
              <p className="text-xs text-gray-500">DB-Checks + HTTP-Crawl + Sitemap-Analyse</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={startDbAudit}
              disabled={crawling || httpCrawling}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition text-sm font-medium"
              data-testid="start-db-audit-btn"
            >
              {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
              {crawling ? 'DB-Audit...' : 'DB-Audit'}
            </button>
            {crawlRun && (
              <>
                <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
                  <select value={httpSampleSize} onChange={e => setHttpSampleSize(Number(e.target.value))}
                    className="text-xs bg-transparent border-0 focus:ring-0 pr-1" data-testid="sample-size-select">
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                  </select>
                  <span className="text-xs text-gray-500">Seiten</span>
                </div>
                <button
                  onClick={startHttpAudit}
                  disabled={crawling || httpCrawling}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition text-sm font-medium"
                  data-testid="start-http-audit-btn"
                >
                  {httpCrawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                  {httpCrawling ? 'HTTP-Crawl...' : 'HTTP-Crawl'}
                </button>
                <button onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition text-sm text-gray-600 dark:text-gray-400"
                  data-testid="export-csv-btn">
                  <Download className="w-4 h-4" /> CSV
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
        ) : !crawlRun ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center" data-testid="no-audit-state">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Noch kein Audit durchgeführt</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Starte ein DB-Audit, dann optional einen HTTP-Crawl.</p>
            <button onClick={startDbAudit} disabled={crawling}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium"
              data-testid="start-first-crawl-btn">
              Erstes Audit starten
            </button>
          </div>
        ) : (
          <>
            {/* Score + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className={`bg-gradient-to-br ${scoreBg(crawlRun.healthScore)} border rounded-xl p-6 flex items-center gap-6 lg:col-span-2`} data-testid="health-score-card">
                <HealthScoreCircle score={crawlRun.healthScore} />
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Health Score</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {crawlRun.healthScore >= 80 ? 'Guter Zustand' : crawlRun.healthScore >= 60 ? 'Verbesserungsbedarf' : 'Kritisch'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(crawlRun.startedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    Trigger: {crawlRun.trigger}
                  </p>
                </div>
              </div>
              <StatCard label="Seiten" value={crawlRun.totalPages} icon={<BarChart3 className="w-4 h-4 text-gray-400" />} />
              <StatCard label="Kritisch" value={crawlRun.criticalCount} icon={<XCircle className="w-4 h-4 text-red-400" />} color="text-red-600" />
              <StatCard label="Warnungen" value={crawlRun.warningCount} icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color="text-amber-600" />
            </div>

            {/* Run Comparison Delta */}
            {comparison && comparison.previousRun && (
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="run-comparison">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-500" /> Vergleich zum letzten Audit
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    ({new Date(comparison.previousRun.startedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })})
                  </span>
                </h3>
                <div className="flex flex-wrap gap-4">
                  {/* Score delta */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Score:</span>
                    {comparison.scoreDelta > 0 ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <TrendingUp className="w-4 h-4" /> +{comparison.scoreDelta}
                      </span>
                    ) : comparison.scoreDelta < 0 ? (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <TrendingDown className="w-4 h-4" /> {comparison.scoreDelta}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500 text-sm">
                        <Minus className="w-4 h-4" /> Gleich
                      </span>
                    )}
                  </div>
                  {/* Fixed issues */}
                  {comparison.fixedIssues.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm text-emerald-600">
                        {comparison.fixedIssues.reduce((s, i) => s + i.count, 0)} behoben
                      </span>
                      <span className="text-xs text-gray-400">
                        ({comparison.fixedIssues.map(i => issueLabels[i.type] || i.type).slice(0, 3).join(', ')})
                      </span>
                    </div>
                  )}
                  {/* New issues */}
                  {comparison.newIssues.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600">
                        +{comparison.newIssues.reduce((s, i) => s + i.count, 0)} neu
                      </span>
                      <span className="text-xs text-gray-400">
                        ({comparison.newIssues.map(i => issueLabels[i.type] || i.type).slice(0, 3).join(', ')})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Summary */}
            <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="ai-summary-section">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> AI-Zusammenfassung
                </h3>
                {!crawlRun.aiSummary && (
                  <button onClick={generateSummary} disabled={generatingAi}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs font-medium"
                    data-testid="generate-ai-summary-btn">
                    {generatingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generatingAi ? 'Generiere...' : 'Generieren'}
                  </button>
                )}
              </div>
              {crawlRun.aiSummary ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{crawlRun.aiSummary}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Noch keine AI-Zusammenfassung.</p>
              )}
            </div>

            {/* Issue Breakdown: DB + HTTP + Sitemap */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* DB Issues */}
              <IssueCategory title="Datenbank-Checks" icon={<FileSearch className="w-4 h-4 text-cyan-500" />}
                issues={dbIssues} filterType={filterType} setFilterType={setFilterType} setCurrentPage={setCurrentPage} issueLabels={issueLabels} />

              {/* HTTP Issues */}
              <IssueCategory title="HTTP-Crawl" icon={<Globe className="w-4 h-4 text-purple-500" />}
                issues={httpIssues} filterType={filterType} setFilterType={setFilterType} setCurrentPage={setCurrentPage} issueLabels={issueLabels}
                emptyText={httpIssues.length === 0 ? 'HTTP-Crawl starten um Live-Daten zu prüfen' : undefined} />

              {/* Sitemap + History */}
              <div className="space-y-4">
                {sitemapIssues.length > 0 && (
                  <IssueCategory title="Sitemap" icon={<Map className="w-4 h-4 text-orange-500" />}
                    issues={sitemapIssues} filterType={filterType} setFilterType={setFilterType} setCurrentPage={setCurrentPage} issueLabels={issueLabels} />
                )}
                <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="audit-history">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" /> Verlauf
                  </h3>
                  {history.length === 0 ? <p className="text-sm text-gray-400">Kein Verlauf</p> : (
                    <div className="space-y-1.5">
                      {history.map(h => (
                        <button key={h.id}
                          onClick={() => { setSelectedRunId(h.id); fetchData(1, h.id); }}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left text-sm transition ${selectedRunId === h.id ? 'ring-1 ring-cyan-300 bg-cyan-50 dark:bg-cyan-900/20' : ''}`}>
                          <span className={`text-lg font-bold w-8 ${scoreColor(h.healthScore)}`}>{h.healthScore}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500">{new Date(h.startedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })}</p>
                            <p className="text-xs text-gray-400">{h.criticalCount}K / {h.warningCount}W / {h.infoCount}I</p>
                          </div>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{h.trigger}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* URL List */}
            <div className="bg-white dark:bg-gray-900 border rounded-xl" data-testid="url-list-section">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                  Betroffene URLs ({total})
                </h3>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                      placeholder="URL oder Titel..." className="pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-transparent w-56"
                      data-testid="seo-search-input" />
                  </div>
                  <select value={filterSeverity} onChange={e => { setFilterSeverity(e.target.value); setCurrentPage(1); }}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-transparent" data-testid="severity-filter">
                    <option value="">Alle Stufen</option>
                    <option value="critical">Kritisch</option>
                    <option value="warning">Warnung</option>
                    <option value="info">Hinweis</option>
                  </select>
                  <select value={filterPageType} onChange={e => { setFilterPageType(e.target.value); setCurrentPage(1); }}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-transparent" data-testid="pagetype-filter">
                    <option value="">Alle Typen</option>
                    <option value="article">Artikel</option>
                    <option value="series">Serie</option>
                    <option value="static">Statisch</option>
                    <option value="sitemap">Sitemap</option>
                  </select>
                  {(filterSeverity || filterType || filterPageType) && (
                    <button onClick={() => { setFilterSeverity(''); setFilterType(''); setFilterPageType(''); setCurrentPage(1); }}
                      className="text-xs text-cyan-600 hover:underline flex items-center gap-1">
                      <Filter className="w-3 h-3" /> Reset
                    </button>
                  )}
                </div>
              </div>

              {filteredPages.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Keine Ergebnisse.</p>
                </div>
              ) : (
                <div>{filteredPages.map(page => <IssueRow key={page.id} page={page} issueLabels={issueLabels} />)}</div>
              )}

              {total > 30 && (
                <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Seite {currentPage} von {Math.ceil(total / 30)}</span>
                  <div className="flex gap-2">
                    <button onClick={() => fetchData(currentPage - 1, selectedRunId || undefined)} disabled={currentPage <= 1}
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30">Zurück</button>
                    <button onClick={() => fetchData(currentPage + 1, selectedRunId || undefined)} disabled={currentPage >= Math.ceil(total / 30)}
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30">Weiter</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ──── Sub-Components ────

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-white dark:bg-gray-900 border rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <p className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value.toLocaleString()}</p>
    </div>
  );
}

function IssueCategory({ title, icon, issues, filterType, setFilterType, setCurrentPage, issueLabels, emptyText }: {
  title: string; icon: React.ReactNode;
  issues: [string, { count: number; severity: string }][];
  filterType: string; setFilterType: (t: string) => void; setCurrentPage: (p: number) => void;
  issueLabels: Record<string, string>; emptyText?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
        {icon} {title}
      </h3>
      {issues.length === 0 ? (
        <p className="text-sm text-gray-400 italic">{emptyText || 'Keine Issues'}</p>
      ) : (
        <div className="space-y-1.5">
          {issues.map(([type, { count, severity }]) => (
            <button key={type}
              onClick={() => { setFilterType(type === filterType ? '' : type); setCurrentPage(1); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition text-sm ${
                filterType === type ? 'bg-cyan-50 dark:bg-cyan-900/20 ring-1 ring-cyan-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
              data-testid={`issue-filter-${type}`}>
              {severityIcon(severity)}
              <span className="flex-1 text-gray-700 dark:text-gray-300 text-xs">{issueLabels[type] || type}</span>
              <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
