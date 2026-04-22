/**
 * SeriesHubArticles Component
 * 
 * Displays recent articles for a series (for Hub page)
 * Auto-fetches from API
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Article {
  id: string;
  slug: string;
  title: string;
  publishedAt: string;
  teaser: string;
}

interface SeriesHubArticlesProps {
  seriesId: string;
  limit?: number;
}

export function SeriesHubArticles({ seriesId, limit = 7 }: SeriesHubArticlesProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticles() {
      try {
        const response = await fetch(`/api/series/${seriesId}/articles?limit=${limit}`);
        if (response.ok) {
          const data = await response.json();
          setArticles(data.data.articles);
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchArticles();
  }, [seriesId, limit]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <p className="text-gray-500 text-sm">Noch keine Artikel verfügbar.</p>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit',
      month: '2-digit',
      year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Aktuelle News</h2>
      
      <div className="space-y-4">
        {articles.map(article => (
          <article key={article.id} className="border-b border-gray-200 pb-4">
            <Link 
              href={`/${article.slug}`}
              className="group"
            >
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                {article.title}
              </h3>
              <p className="text-sm text-gray-600 mb-2">
                {article.teaser}
              </p>
              <time className="text-xs text-gray-500">
                {formatDate(article.publishedAt)}
              </time>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
