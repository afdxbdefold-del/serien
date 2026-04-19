'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type AuthorHit = {
  name: string;
  image: string | null;
  url: string;
  articleCount: number;
  recentArticles: { title: string; slug: string; publishedAt: string | null }[];
};

type ApiResponse = {
  query: string;
  series: { title: string; slug: string }[];
  results: AuthorHit[];
  totalArticles: number;
};

const SUGGESTIONS = ['Fallout', 'Wednesday', 'Stranger Things', 'The Boys', 'House of the Dragon', 'Severance'];

export default function SeriesAuthorLookup() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (abortRef.current) abortRef.current.abort();
    const query = q.trim();
    if (query.length < 2) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/authors/for-series?q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const json = (await res.json()) as ApiResponse;
        setData(json);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError((e as Error).message);
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <section className="mt-16 pt-12 border-t border-slate-200" data-testid="series-author-lookup">
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold tracking-wide uppercase mb-4">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
          Expertise-Matcher
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
          Wer schreibt zu deiner Lieblingsserie?
        </h2>
        <p className="text-slate-600 mb-6">
          Gib eine Serie ein — wir zeigen dir die Redakteurin, die am meisten zu diesem Titel
          veröffentlicht hat. Direkte Expertise statt Marketing-Copy.
        </p>

        {/* Search input */}
        <div className="relative">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="z.B. Fallout, Wednesday, Stranger Things…"
            className="w-full px-5 py-4 pr-12 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none transition-colors text-base"
            data-testid="series-author-lookup-input"
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
            {loading ? (
              <div className="w-5 h-5 border-2 border-slate-200 border-t-cyan-500 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M16.65 16.65A7 7 0 105.64 5.64a7 7 0 0011.01 11.01z" />
              </svg>
            )}
          </div>
        </div>

        {/* Suggestion chips */}
        {!q && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center mr-1">Beliebt:</span>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setQ(s)}
                className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                data-testid={`series-suggestion-${s.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" data-testid="series-lookup-error">
          {error}
        </div>
      )}

      {data && q.trim().length >= 2 && (
        <div className="mt-8" data-testid="series-lookup-results">
          {data.series.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="text-4xl mb-3 opacity-50">🔍</div>
              <p className="text-slate-700 font-medium mb-1">Keine Serie mit diesem Namen gefunden</p>
              <p className="text-sm text-slate-500">Probier es mit einem anderen Titel oder einer bekannten Serie aus der Liste oben.</p>
            </div>
          ) : data.results.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-700 font-medium mb-1">Noch keine Artikel zu „{data.series[0].title}"</p>
              <p className="text-sm text-slate-500">Wir arbeiten daran — schau bald wieder vorbei.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 text-sm text-slate-600">
                <span className="font-medium text-slate-900">{data.totalArticles}</span>{' '}
                {data.totalArticles === 1 ? 'Artikel' : 'Artikel'} zu{' '}
                <span className="font-medium text-slate-900">
                  {data.series.slice(0, 2).map((s) => s.title).join(' · ')}
                  {data.series.length > 2 && ` +${data.series.length - 2}`}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {data.results.map((author, idx) => (
                  <Link
                    key={author.name}
                    href={author.url}
                    className="group bg-white rounded-xl border border-slate-200 hover:border-cyan-400 hover:shadow-lg transition-all p-5 flex flex-col"
                    data-testid={`series-lookup-author-${idx}`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      {author.image ? (
                        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                          <Image src={author.image} alt={author.name} fill sizes="48px" className="object-cover" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold">
                          {author.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              Top-Expertin
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-900 group-hover:text-cyan-600 transition-colors leading-tight">
                          {author.name}
                        </h3>
                        <div className="text-xs text-slate-500">
                          {author.articleCount} {author.articleCount === 1 ? 'Artikel' : 'Artikel'} zur Serie
                        </div>
                      </div>
                    </div>

                    {author.recentArticles.length > 0 && (
                      <div className="text-xs text-slate-500 space-y-1 mb-3 flex-1">
                        <div className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] mb-1">
                          Zuletzt veröffentlicht
                        </div>
                        {author.recentArticles.slice(0, 2).map((art) => (
                          <div key={art.slug} className="truncate">• {art.title}</div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm font-medium text-cyan-600 flex items-center gap-1 mt-auto">
                      Profil öffnen
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
