'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';

interface DiscoverMetrics {
  id: string;
  articleId: string;
  timestamp: Date;
  pipelineVersion: string;
  discoverScore: number;
  finalVerdict: string;
  primaryBlockers: string[];
  improvementHints: string[];
  headlineMetrics: any;
  contentMetrics: any;
  freshnessMetrics: any;
  imageMetrics: any;
  trustMetrics: any;
  article?: {
    id: string;
    title: string;
    slug: string;
    publishMode: string;
    publishedAt: string;
  } | null;
}

export default function DiscoverAnalyticsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<DiscoverMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed'>('all');

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/discover-dashboard/recent?limit=50', {
          headers: getAuthHeaders()
        });

        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        setMetrics(data.data?.dashboards || data.data || []);
      } catch (err) {
        console.error('Error fetching discover metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_username');
    }
    router.push('/admin/login');
  };

  // Filter metrics
  const filteredMetrics = metrics.filter(m => {
    if (filter === 'passed') return m.discoverScore >= 91;
    if (filter === 'failed') return m.discoverScore < 91;
    return true;
  });

  // Calculate stats
  const totalCount = metrics.length;
  const passedCount = metrics.filter(m => m.discoverScore >= 91).length;
  const failedCount = totalCount - passedCount;
  const avgScore = metrics.length > 0 
    ? metrics.reduce((sum, m) => sum + m.discoverScore, 0) / metrics.length 
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link 
                href="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Discover Analytics</h1>
                <p className="text-sm text-gray-500">
                  Google Discover Score Performance
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard 
            title="Gesamt" 
            value={totalCount} 
            icon="📊"
            trend={null}
          />
          <StatCard 
            title="Bestanden (≥91)" 
            value={passedCount} 
            icon="✅"
            trend={totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0}
            trendLabel="%"
          />
          <StatCard 
            title="Durchgefallen (<91)" 
            value={failedCount} 
            icon="❌"
            trend={totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0}
            trendLabel="%"
          />
          <StatCard 
            title="Ø Score" 
            value={Math.round(avgScore)} 
            icon="📈"
            trend={null}
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-900" data-testid="discover-threshold-info">
          <strong>Schwellenwert:</strong> Artikel mit <strong>≥ 91 Punkten</strong> werden als <code className="bg-blue-100 px-1 rounded">DISCOVER</code> klassifiziert und landen in der Google News Sitemap. Alle anderen laufen als <code className="bg-blue-100 px-1 rounded">SEARCH_ONLY</code>.
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'passed', label: 'Bestanden' },
            { id: 'failed', label: 'Durchgefallen' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilter(id as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === id
                  ? 'bg-cyan-500 text-white'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Metrics Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artikel
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Headline Quality (max 30)">
                      Head<br/><span className="text-gray-400 normal-case">/30</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Freshness (max 20)">
                      Fresh<br/><span className="text-gray-400 normal-case">/20</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Content Opening (max 20)">
                      Cont.<br/><span className="text-gray-400 normal-case">/20</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Image/Visual (max 15)">
                      Img<br/><span className="text-gray-400 normal-case">/15</span>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Trust/Clarity (max 15)">
                      Trust<br/><span className="text-gray-400 normal-case">/15</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verdict
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMetrics.map((metric) => {
                    const title = metric.article?.title || `(Artikel gelöscht) ${metric.articleId.slice(0, 8)}…`;
                    const verdictColor =
                      metric.finalVerdict === 'DISCOVER_OK' || metric.finalVerdict === 'DISCOVER' || metric.finalVerdict === 'EXCELLENT'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800';
                    return (
                      <tr
                        key={metric.id}
                        className="hover:bg-cyan-50 cursor-pointer transition-colors"
                        onClick={() => router.push(`/admin/discover/${metric.articleId}`)}
                        data-testid={`discover-row-${metric.articleId}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                          <div className="truncate font-medium" title={title}>{title}</div>
                          {metric.article?.slug && (
                            <div className="text-xs text-gray-500 truncate">/{metric.article.slug}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <ScoreBadge score={metric.discoverScore} />
                        </td>
                        <MetricCell score={metric.headlineMetrics?.score} max={30} />
                        <MetricCell score={metric.freshnessMetrics?.score} max={20} />
                        <MetricCell score={metric.contentMetrics?.score} max={20} />
                        <MetricCell score={metric.imageMetrics?.score} max={15} />
                        <MetricCell score={metric.trustMetrics?.score} max={15} />
                        <td className="px-4 py-3 text-xs">
                          <span className={`inline-block px-2 py-1 rounded-full font-medium ${verdictColor}`}>
                            {metric.finalVerdict}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">
                          {new Date(metric.timestamp).toLocaleDateString('de-DE')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredMetrics.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">Keine Metriken gefunden</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCell({ score, max }: { score: number | undefined; max: number }) {
  if (score === undefined || score === null) {
    return <td className="px-4 py-3 text-center text-xs text-gray-400">-</td>;
  }
  const ratio = score / max;
  const color =
    ratio >= 0.8 ? 'text-green-700 bg-green-50' :
    ratio >= 0.5 ? 'text-yellow-700 bg-yellow-50' :
    'text-red-700 bg-red-50';
  return (
    <td className="px-4 py-3 text-center">
      <span className={`inline-block px-2 py-1 rounded text-xs font-bold ${color}`}>
        {score}
      </span>
    </td>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  trend, 
  trendLabel 
}: { 
  title: string; 
  value: number; 
  icon: string; 
  trend: number | null;
  trendLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
        {trend !== null && (
          <div className="text-sm font-medium text-gray-500 mb-1">
            {trend}{trendLabel || ''}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const passed = score >= 91;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
      passed 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {score}/130
    </span>
  );
}
