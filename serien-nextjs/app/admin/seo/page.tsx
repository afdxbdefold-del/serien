'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle, Info, RefreshCw, Search, ChevronDown, ChevronUp,
  ArrowLeft, Loader2, Shield, Sparkles, ExternalLink, Filter, BarChart3,
  AlertCircle, XCircle, Clock
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
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  contentHash: string | null;
  internalLinks: number;
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
  startedAt: string;
  trigger: string;
}

// ──── Helpers ────

function getAuthHeaders() {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('admin_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function severityIcon(severity: string) {
  switch (severity) {
    case 'critical': return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
    case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    default: return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
  }
}

function severityBadge(severity: string) {
  const cls = severity === 'critical'
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : severity === 'warning'
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{severity === 'critical' ? 'Kritisch' : severity === 'warning' ? 'Warnung' : 'Hinweis'}</span>;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function scoreBg(score: number) {
  if (score >= 80) return 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20';
  if (score >= 60) return 'from-amber-500/10 to-amber-500/5 border-amber-500/20';
  return 'from-red-500/10 to-red-500/5 border-red-500/20';
}

function scoreRing(score: number) {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 60) return 'stroke-amber-500';
  return 'stroke-red-500';
}

// ──── Components ────

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
        {criticals > 0 ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : warnings > 0 ? <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" /> : <Info className="w-4 h-4 text-blue-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{page.title || page.url}</p>
          <p className="text-xs text-gray-500 truncate">{page.url}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400">{page.pageType}</span>
          <span className="text-xs text-gray-500">{page.issues.length} Issues</span>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pl-11 space-y-2">
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

  const fetchData = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterType) params.set('issueType', filterType);
      if (filterPageType) params.set('pageType', filterPageType);

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
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [router, filterSeverity, filterType, filterPageType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const startCrawl = async () => {
    setCrawling(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'crawl' }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || 'Fehler');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCrawling(false);
    }
  };

  const generateSummary = async () => {
    if (!crawlRun) return;
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'ai_summary', runId: crawlRun.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCrawlRun(prev => prev ? { ...prev, aiSummary: data.summary } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const filteredPages = searchTerm
    ? pages.filter(p =>
        (p.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.url.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : pages;

  // Sort issue breakdown by count
  const sortedIssues = Object.entries(issueBreakdown).sort((a, b) => b[1].count - a[1].count);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" data-testid="seo-audit-page">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/dashboard" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-500" /> SEO Audit
              </h1>
              <p className="text-xs text-gray-500">Internes SEO-Monitoring für serien.de</p>
            </div>
          </div>
          <button
            onClick={startCrawl}
            disabled={crawling}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition text-sm font-medium"
            data-testid="start-crawl-btn"
          >
            {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {crawling ? 'Audit läuft...' : 'Neues Audit starten'}
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-cyan-500" /></div>
        ) : !crawlRun ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-12 text-center" data-testid="no-audit-state">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Noch kein Audit durchgeführt</h2>
            <p className="text-sm text-gray-500 mt-1">Starte ein neues SEO-Audit, um den Zustand deiner Website zu prüfen.</p>
            <button
              onClick={startCrawl}
              disabled={crawling}
              className="mt-4 px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm font-medium"
              data-testid="start-first-crawl-btn"
            >
              Erstes Audit starten
            </button>
          </div>
        ) : (
          <>
            {/* ── Score + Stats Row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Health Score */}
              <div className={`bg-gradient-to-br ${scoreBg(crawlRun.healthScore)} border rounded-xl p-6 flex items-center gap-6 lg:col-span-1`} data-testid="health-score-card">
                <HealthScoreCircle score={crawlRun.healthScore} />
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Health Score</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {crawlRun.healthScore >= 80 ? 'Guter Zustand' : crawlRun.healthScore >= 60 ? 'Verbesserungsbedarf' : 'Kritisch'}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(crawlRun.startedAt).toLocaleString('de-DE')}
                  </p>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="stat-pages">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Geprüfte Seiten</span>
                  <BarChart3 className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{crawlRun.totalPages.toLocaleString()}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="stat-critical">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Kritische Fehler</span>
                  <XCircle className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-2xl font-bold text-red-600">{crawlRun.criticalCount}</p>
              </div>
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="stat-warnings">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wider">Warnungen</span>
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                </div>
                <p className="text-2xl font-bold text-amber-600">{crawlRun.warningCount}</p>
              </div>
            </div>

            {/* ── AI Summary ── */}
            <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="ai-summary-section">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" /> AI-Zusammenfassung
                </h3>
                {!crawlRun.aiSummary && (
                  <button
                    onClick={generateSummary}
                    disabled={generatingAi}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-xs font-medium"
                    data-testid="generate-ai-summary-btn"
                  >
                    {generatingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {generatingAi ? 'Generiere...' : 'Generieren'}
                  </button>
                )}
              </div>
              {crawlRun.aiSummary ? (
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-line">{crawlRun.aiSummary}</p>
              ) : (
                <p className="text-sm text-gray-400 italic">Noch keine AI-Zusammenfassung. Klicke auf "Generieren".</p>
              )}
            </div>

            {/* ── Issue Breakdown ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="issue-breakdown">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" /> Issue-Verteilung
                </h3>
                {sortedIssues.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle className="w-4 h-4" /> Keine Issues gefunden
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedIssues.map(([type, { count, severity }]) => (
                      <button
                        key={type}
                        onClick={() => { setFilterType(type === filterType ? '' : type); setCurrentPage(1); }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition text-sm ${
                          filterType === type ? 'bg-cyan-50 dark:bg-cyan-900/20 ring-1 ring-cyan-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                        }`}
                        data-testid={`issue-filter-${type}`}
                      >
                        {severityIcon(severity)}
                        <span className="flex-1 text-gray-700 dark:text-gray-300">{issueLabels[type] || type}</span>
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{count}</span>
                        {severityBadge(severity)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* History */}
              <div className="bg-white dark:bg-gray-900 border rounded-xl p-5" data-testid="audit-history">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" /> Audit-Verlauf
                </h3>
                {history.length === 0 ? (
                  <p className="text-sm text-gray-400">Kein Verlauf</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <button
                        key={h.id}
                        onClick={() => { fetchData(1); }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 text-left text-sm"
                      >
                        <span className={`text-lg font-bold ${scoreColor(h.healthScore)}`}>{h.healthScore}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500">{new Date(h.startedAt).toLocaleDateString('de-DE')}</p>
                          <p className="text-xs text-gray-400">{h.criticalCount} krit. / {h.warningCount} warn.</p>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{h.trigger}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── URL List ── */}
            <div className="bg-white dark:bg-gray-900 border rounded-xl" data-testid="url-list-section">
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 shrink-0">
                  Betroffene URLs ({total})
                </h3>
                <div className="flex-1 flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      placeholder="URL oder Titel suchen..."
                      className="pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-transparent w-56"
                      data-testid="seo-search-input"
                    />
                  </div>
                  <select
                    value={filterSeverity}
                    onChange={e => { setFilterSeverity(e.target.value); setCurrentPage(1); }}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-transparent"
                    data-testid="severity-filter"
                  >
                    <option value="">Alle Stufen</option>
                    <option value="critical">Kritisch</option>
                    <option value="warning">Warnung</option>
                    <option value="info">Hinweis</option>
                  </select>
                  <select
                    value={filterPageType}
                    onChange={e => { setFilterPageType(e.target.value); setCurrentPage(1); }}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-transparent"
                    data-testid="pagetype-filter"
                  >
                    <option value="">Alle Typen</option>
                    <option value="article">Artikel</option>
                    <option value="series">Serie</option>
                  </select>
                  {(filterSeverity || filterType || filterPageType) && (
                    <button
                      onClick={() => { setFilterSeverity(''); setFilterType(''); setFilterPageType(''); setCurrentPage(1); }}
                      className="text-xs text-cyan-600 hover:underline flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3" /> Filter zurücksetzen
                    </button>
                  )}
                </div>
              </div>

              {filteredPages.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Keine Ergebnisse mit diesen Filtern.</p>
                </div>
              ) : (
                <div>
                  {filteredPages.map(page => (
                    <IssueRow key={page.id} page={page} issueLabels={issueLabels} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {total > 30 && (
                <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Seite {currentPage} von {Math.ceil(total / 30)}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchData(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30"
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => fetchData(currentPage + 1)}
                      disabled={currentPage >= Math.ceil(total / 30)}
                      className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30"
                    >
                      Weiter
                    </button>
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
