/**
 * Actor Hub - Central page for all actors/persons
 * Route: /personen
 */

import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schauspieler & Stars - Alle Serien-Darsteller | serien.de',
  description: 'Entdecke alle Schauspieler und Stars aus deinen Lieblingsserien. Profile, Rollen, News und mehr.',
  openGraph: {
    title: 'Schauspieler & Stars - Serien-Darsteller',
    description: 'Alle Schauspieler aus TV-Serien auf einen Blick'
  }
};

export default async function PersonenPage() {
  // Fetch all persons ordered by popularity
  const persons = await prisma.persons.findMany({
    orderBy: {
      popularity: 'desc'
    },
    select: {
      id: true,
      slug: true,
      name: true,
      profilePath: true,
      knownFor: true,
      popularity: true,
      _count: {
        select: {
          article_persons: true
        }
      }
    }
  });

  // Helper function to get TMDB image URL
  const getTMDBImageUrl = (path: string | null, size: string = 'w185') => {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Schauspieler & Stars
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl">
            Entdecke {persons.length} Schauspieler aus deinen Lieblingsserien
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{persons.length}</span>
              <span>Schauspieler</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">
                {persons.reduce((sum, p) => sum + p._count.article_persons, 0)}
              </span>
              <span>Artikel</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {persons.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-500">
              Noch keine Schauspieler in der Datenbank
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {persons.map((person) => (
              <Link
                key={person.id}
                href={`/person/${person.slug}`}
                className="group"
              >
                <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  {/* Profile Image */}
                  <div className="relative aspect-[2/3] bg-gray-200">
                    {person.profilePath ? (
                      <Image
                        src={getTMDBImageUrl(person.profilePath, 'w185') || ''}
                        alt={person.name}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-16 h-16 text-gray-400"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                        </svg>
                      </div>
                    )}
                    
                    {/* Article Count Badge */}
                    {person._count.article_persons > 0 && (
                      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                        {person._count.article_persons} {person._count.article_persons === 1 ? 'Artikel' : 'Artikel'}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 group-hover:text-blue-600 transition">
                      {person.name}
                    </h3>
                    {person.knownFor && (
                      <p className="text-xs text-gray-500 line-clamp-1">
                        {person.knownFor}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
