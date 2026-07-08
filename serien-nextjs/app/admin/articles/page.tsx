'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Trash2, Search, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle } from 'lucide-react';
import { ForceKillArticleCard } from '@/components/admin/ForceKillArticleCard';

interface Article {
  id: string;
  slug: string;
  title: string;
  status: string;
  contentType: string;
  publishedAt: string | null;
  createdAt: string;
  authorName: string;
  seriesName: string | null;
}

interface ArticlesResponse {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminArticlesPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('admin_token');
    return { 'Authorization': `Bearer ${token}` };
  };

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(contentTypeFilter && { contentType: contentTypeFilter }),
      });

      const response = await fetch(`/api/admin/articles?${params}`, {
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      const data: ArticlesResponse = await response.json();
      setArticles(data.articles);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [page, contentTypeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchArticles();
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/articles?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setArticles(prev => prev.filter(a => a.id !== id));
        setTotal(prev => prev - 1);
        setDeleteConfirm(null);
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.error}`);
      }
    } catch (err) {
      console.error('Error deleting article:', err);
      alert('Fehler beim Löschen');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit' });
  };

  const getContentTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; label: string }> = {
      'IMPORTED': { bg: 'bg-blue-100 text-blue-800', label: 'Importiert' },
      'IMPORTED_WITH_SERIES': { bg: 'bg-green-100 text-green-800', label: 'Import + Serie' },
      'GENERATED': { bg: 'bg-purple-100 text-purple-800', label: 'Generiert' },
      'MANUAL': { bg: 'bg-gray-100 text-gray-800', label: 'Manuell' },
    };
    const badge = badges[type] || { bg: 'bg-gray-100 text-gray-800', label: type };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg}`}>{badge.label}</span>;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; label: string }> = {
      'published': { bg: 'bg-green-100 text-green-800', label: 'Veröffentlicht' },
      'draft': { bg: 'bg-yellow-100 text-yellow-800', label: 'Entwurf' },
      'archived': { bg: 'bg-gray-100 text-gray-800', label: 'Archiviert' },
    };
    const badge = badges[status] || { bg: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge.bg}`}>{badge.label}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Artikel-Verwaltung</h1>
                <p className="text-sm text-gray-500">{total.toLocaleString()} Artikel gesamt</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ForceKillArticleCard />

        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Suche nach Titel oder Slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </form>

            {/* Content Type Filter */}
            <select
              value={contentTypeFilter}
              onChange={(e) => { setContentTypeFilter(e.target.value); setPage(0); }}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Alle Typen</option>
              <option value="IMPORTED">Importiert</option>
              <option value="IMPORTED_WITH_SERIES">Import + Serie</option>
              <option value="GENERATED">Generiert</option>
              <option value="MANUAL">Manuell</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Keine Artikel gefunden
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Titel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Typ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Autor
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serie
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Erstellt
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Aktionen
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {articles.map((article) => (
                    <tr key={article.id} className={`hover:bg-gray-50 ${deleteConfirm === article.id ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-4">
                        <div className="max-w-xs">
                          <div className="font-medium text-gray-900 truncate" title={article.title}>
                            {article.title}
                          </div>
                          <div className="text-xs text-gray-500 truncate" title={article.slug}>
                            /{article.slug}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getContentTypeBadge(article.contentType)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        {getStatusBadge(article.status)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {article.authorName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                        {article.seriesName || '-'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(article.createdAt)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/${article.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                            title="Artikel ansehen"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDelete(article.id)}
                            disabled={deleting}
                            className={`p-2 transition-colors ${
                              deleteConfirm === article.id
                                ? 'text-white bg-red-500 rounded hover:bg-red-600'
                                : 'text-gray-400 hover:text-red-600'
                            }`}
                            title={deleteConfirm === article.id ? 'Klicken zum Bestätigen' : 'Löschen'}
                          >
                            {deleteConfirm === article.id ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                Seite {page + 1} von {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
