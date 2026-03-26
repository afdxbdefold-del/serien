/**
 * Actor Hub - Central page for all actors/persons
 * Route: /personen
 */

import prisma from '@/lib/prisma';
import { Metadata } from 'next';
import ActorGrid from '@/components/ActorGrid';

// Force dynamic rendering
export const dynamic = 'force-dynamic';


export const metadata: Metadata = {
  title: 'Schauspieler & Stars - Alle Serien-Darsteller | serien.de',
  description: 'Entdecke alle Schauspieler und Stars aus deinen Lieblingsserien. Profile, Rollen, News und mehr.',
  robots: {
    index: true,
    follow: true,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
  alternates: {
    canonical: 'https://serien.de/personen',
  },
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
          <ActorGrid persons={persons} />
        )}
      </div>
    </div>
  );
}
