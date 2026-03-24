'use client';

import { Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Stats {
  total_news: number;
  total_series: number;
  total_users: number;
  recent_news_48h: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [adminUsername, setAdminUsername] = useState('');

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 'Authorization': `Bearer ${token}` };
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/admin/dashboard', {
          headers: getAuthHeaders()
        });

        if (response.status === 401) {
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_username');
    }
    router.push('/admin/login');
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAdminUsername(localStorage.getItem('admin_username') || 'Admin');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">serien.de Admin</h1>
            <p className="text-sm text-gray-500">
              Willkommen, {adminUsername}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 overflow-x-auto">
            {[
              { id: 'dashboard', label: '📊 Dashboard', href: null },
              { id: 'discover', label: '🎯 Discover Analytics', href: '/admin/discover-analytics' },
              { id: 'headlines', label: '✏️ Headline Analytics', href: '/admin/headline-analytics' },
              { id: 'articles', label: '📝 Artikel', href: '/admin/articles' },
              { id: 'pipeline', label: '🚀 Pipeline', href: '/admin/pipeline' },
              { id: 'ads', label: '📢 Werbung', href: '/admin/ads' },
              { id: 'users', label: '👥 Users', href: null },
            ].map(({ id, label, href }) => (
              href ? (
                <Link
                  key={id}
                  href={href}
                  className="py-4 px-3 border-b-2 border-transparent font-medium text-sm whitespace-nowrap text-gray-500 hover:text-gray-700 hover:border-gray-300"
                >
                  {label}
                </Link>
              ) : (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === id
                      ? 'border-cyan-500 text-cyan-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              )
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : activeTab === 'dashboard' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Artikel gesamt" value={stats?.total_news || 0} icon="📰" />
            <StatCard title="Serien gesamt" value={stats?.total_series || 0} icon="📺" />
            <StatCard title="Benutzer" value={stats?.total_users || 0} icon="👥" />
            <StatCard title="Letzte 48h" value={stats?.recent_news_48h || 0} icon="🔥" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500 text-lg">
              {activeTab === 'articles' && 'Artikel-Verwaltung'}
              {activeTab === 'users' && 'Benutzer-Verwaltung'}
              {activeTab === 'crawler' && 'Crawler-Verwaltung'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Diese Funktion ist in Entwicklung.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
    </div>
  );
}