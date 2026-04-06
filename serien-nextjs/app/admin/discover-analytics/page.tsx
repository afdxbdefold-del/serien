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
    if (filter === 'passed') return m.discoverScore >= 65;
    if (filter === 'failed') return m.discoverScore < 65;
    return true;
  });

  // Calculate stats
  const totalCount = metrics.length;
  const passedCount = metrics.filter(m => m.discoverScore >= 65).length;
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
            title="Bestanden (≥65)" 
            value={passedCount} 
            icon="✅"
            trend={totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0}
            trendLabel="%"
          />
          <StatCard 
            title="Durchgefallen (<65)" 
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Artikel ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Headline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Freshness
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Verdict
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Datum
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMetrics.map((metric) => (
                    <tr key={metric.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {metric.articleId.slice(0, 12)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ScoreBadge score={metric.discoverScore} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.headlineMetrics?.score || '-'}/30
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.contentMetrics?.score || '-'}/20
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.freshnessMetrics?.score || '-'}/20
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {metric.finalVerdict}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(metric.timestamp).toLocaleDateString('de-DE')}
                      </td>
                    </tr>
                  ))}
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
  const passed = score >= 65;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
      passed 
        ? 'bg-green-100 text-green-800' 
        : 'bg-red-100 text-red-800'
    }`}>
      {score}/100
    </span>
  );
}
