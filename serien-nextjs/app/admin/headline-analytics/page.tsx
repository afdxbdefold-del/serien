'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

interface HeadlineMetrics {
  id: string;
  articleId: string;
  timestamp: Date;
  headline_original: string;
  headline_rewritten: string | null;
  antiAiScore_original: number;
  antiAiScore_rewritten: number | null;
  headline_delta: number | null;
  status: 'NO_REWRITE' | 'IMPROVED' | 'WORSE' | 'NEUTRAL';
}

export default function HeadlineAnalyticsPage() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<HeadlineMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'improved' | 'worse' | 'neutral'>('all');

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/headline-dashboard/recent?limit=50', {
          headers: getAuthHeaders()
        });

        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        setMetrics(data.data || []);
      } catch (err) {
        console.error('Error fetching headline metrics:', err);
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
    if (filter === 'improved') return m.status === 'IMPROVED';
    if (filter === 'worse') return m.status === 'WORSE';
    if (filter === 'neutral') return m.status === 'NEUTRAL' || m.status === 'NO_REWRITE';
    return true;
  });

  // Calculate stats
  const totalCount = metrics.length;
  const rewrittenCount = metrics.filter(m => m.headline_rewritten !== null).length;
  const improvedCount = metrics.filter(m => m.status === 'IMPROVED').length;
  const worseCount = metrics.filter(m => m.status === 'WORSE').length;
  const neutralCount = totalCount - improvedCount - worseCount;
  
  const avgDelta = metrics
    .filter(m => m.headline_delta !== null)
    .reduce((sum, m) => sum + (m.headline_delta || 0), 0) / (rewrittenCount || 1);

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
                <h1 className="text-2xl font-bold text-gray-900">Headline Analytics</h1>
                <p className="text-sm text-gray-500">
                  Headline Rewrite Performance & Anti-AI Scores
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <StatCard 
            title="Gesamt" 
            value={totalCount} 
            icon="📊"
          />
          <StatCard 
            title="Rewritten" 
            value={rewrittenCount} 
            icon="✏️"
            subtitle={totalCount > 0 ? `${Math.round((rewrittenCount / totalCount) * 100)}%` : '0%'}
          />
          <StatCard 
            title="Verbessert" 
            value={improvedCount} 
            icon="✅"
            iconColor="text-green-600"
          />
          <StatCard 
            title="Verschlechtert" 
            value={worseCount} 
            icon="❌"
            iconColor="text-red-600"
          />
          <StatCard 
            title="Ø Delta" 
            value={avgDelta > 0 ? `+${Math.round(avgDelta)}` : Math.round(avgDelta)} 
            icon="📈"
            iconColor={avgDelta > 0 ? 'text-green-600' : 'text-gray-600'}
          />
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'improved', label: 'Verbessert' },
            { id: 'worse', label: 'Verschlechtert' },
            { id: 'neutral', label: 'Neutral' },
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
                      Original Headline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rewritten Headline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score Original
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score Rewritten
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delta
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
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
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="truncate" title={metric.headline_original}>
                          {metric.headline_original}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        {metric.headline_rewritten ? (
                          <div className="truncate" title={metric.headline_rewritten}>
                            {metric.headline_rewritten}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Keine Änderung</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.antiAiScore_original}/100
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {metric.antiAiScore_rewritten !== null 
                          ? `${metric.antiAiScore_rewritten}/100` 
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <DeltaBadge delta={metric.headline_delta} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={metric.status} />
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
  iconColor,
  subtitle 
}: { 
  title: string; 
  value: number | string; 
  icon: string; 
  iconColor?: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className={`text-2xl ${iconColor || ''}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtitle && (
        <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-gray-400">-</span>;
  }

  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium ${
      isPositive ? 'text-green-700 bg-green-50' :
      isNegative ? 'text-red-700 bg-red-50' :
      'text-gray-700 bg-gray-50'
    }`}>
      {isPositive && <TrendingUp className="w-3 h-3" />}
      {isNegative && <TrendingDown className="w-3 h-3" />}
      {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
      {isPositive ? '+' : ''}{delta}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    IMPROVED: { label: 'Verbessert', color: 'bg-green-100 text-green-800' },
    WORSE: { label: 'Verschlechtert', color: 'bg-red-100 text-red-800' },
    NEUTRAL: { label: 'Neutral', color: 'bg-gray-100 text-gray-800' },
    NO_REWRITE: { label: 'Kein Rewrite', color: 'bg-blue-100 text-blue-800' },
  }[status] || { label: status, color: 'bg-gray-100 text-gray-800' };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
