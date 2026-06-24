'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface Person {
  id: string;
  slug: string;
  name: string;
  profilePath: string | null;
  knownFor: string | null;
  popularity: number;
  _count: {
    article_persons: number;
  };
}

interface ActorGridProps {
  persons: Person[];
}

export default function ActorGrid({ persons }: ActorGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter actors based on search query
  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) {
      return persons;
    }

    const query = searchQuery.toLowerCase().trim();
    return persons.filter(person =>
      person.name.toLowerCase().includes(query)
    );
  }, [persons, searchQuery]);

  // Helper function to get TMDB image URL
  const getTMDBImageUrl = (path: string | null, size: string = 'w185') => {
    if (!path) return null;
    return `/img/tmdb/${size}${path}`;
  };

  return (
    <>
      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Schauspieler suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Search Results Count */}
        {searchQuery && (
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              {filteredPersons.length === 0 ? (
                <span className="text-red-600">Keine Schauspieler gefunden für "{searchQuery}"</span>
              ) : (
                <span>
                  {filteredPersons.length} {filteredPersons.length === 1 ? 'Schauspieler' : 'Schauspieler'} gefunden
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Actor Grid */}
      {filteredPersons.length === 0 ? (
        <div className="text-center py-20">
          <svg
            className="mx-auto h-16 w-16 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-xl text-gray-500 mb-2">
            Keine Schauspieler gefunden
          </p>
          <p className="text-sm text-gray-400">
            Versuche es mit einem anderen Suchbegriff
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredPersons.map((person) => (
            <Link
              key={person.id}
              href={`/person/${person.slug}`}
              className="group"
            >
              {/* Schauspieler-Fotos site-wide entfernt (Juni 2026, Bildrechte). */}
              <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-gray-100 p-4 h-full flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base mb-1 line-clamp-2 group-hover:text-blue-600 transition">
                    {person.name}
                  </h3>
                  {person.knownFor && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {person.knownFor}
                    </p>
                  )}
                </div>
                {person._count.article_persons > 0 && (
                  <div className="mt-3 text-xs text-gray-400">
                    {person._count.article_persons} {person._count.article_persons === 1 ? 'Artikel' : 'Artikel'}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
