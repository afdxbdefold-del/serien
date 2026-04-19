'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAuthorUrl } from '@/lib/author-utils';

export type GenreSection = {
  genre: string;
  top: { author: string; image: string | null; cnt: number }[];
};

type Props = {
  sectionsAllTime: GenreSection[];
  sections90Days: GenreSection[];
};

export default function GenreExpertsToggle({ sectionsAllTime, sections90Days }: Props) {
  const [mode, setMode] = useState<'all' | '90'>('all');
  const active = mode === 'all' ? sectionsAllTime : sections90Days;
  const hasAny = active.length > 0;

  return (
    <section className="mt-20 pt-12 border-t border-slate-200" data-testid="genre-experts">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold tracking-wide uppercase mb-4">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            Genre-Expertinnen
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Wer schreibt worüber — datenbasiert
          </h2>
          <p className="text-slate-600">
            Keine manuellen Tags: Diese Rangfolge basiert auf der tatsächlichen Artikel-Historie.
            Wer eine Serie im Genre besonders oft analysiert hat, steht oben.
          </p>
        </div>

        {/* Toggle */}
        <div
          className="inline-flex bg-slate-100 rounded-full p-1 self-start"
          role="tablist"
          aria-label="Zeitraum"
          data-testid="genre-experts-toggle"
        >
          <button
            onClick={() => setMode('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            role="tab"
            aria-selected={mode === 'all'}
            data-testid="genre-experts-toggle-all"
          >
            All-Time
          </button>
          <button
            onClick={() => setMode('90')}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === '90'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            role="tab"
            aria-selected={mode === '90'}
            data-testid="genre-experts-toggle-90"
          >
            Letzte 90 Tage
          </button>
        </div>
      </div>

      {!hasAny ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          Für diesen Zeitraum liegen noch keine ausreichenden Daten vor.
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {active.map(({ genre, top }) => (
            <div
              key={genre}
              className="bg-white rounded-xl border border-slate-200/80 p-5"
              data-testid={`genre-block-${genre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900">{genre}</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Top {top.length}
                </span>
              </div>
              <ol className="space-y-3">
                {top.map((entry, idx) => (
                  <li key={entry.author}>
                    <Link href={getAuthorUrl(entry.author)} className="flex items-center gap-3 group">
                      <span className="text-xs font-bold text-slate-400 w-4 flex-shrink-0">
                        {idx + 1}
                      </span>
                      {entry.image ? (
                        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={entry.image}
                            alt={entry.author}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {entry.author.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-slate-900 group-hover:text-cyan-600 transition-colors truncate">
                          {entry.author}
                        </div>
                        <div className="text-xs text-slate-500">
                          {entry.cnt} {entry.cnt === 1 ? 'Artikel' : 'Artikel'} im Genre
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
