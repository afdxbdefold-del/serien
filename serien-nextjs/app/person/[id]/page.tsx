/**
 * Person/Actor Page
 * Route: /person/[id] where id = {tmdb_id}-{slug}
 * Example: /person/287-brad-pitt
 */

import { notFound } from 'next/navigation';
import { PrismaClient } from '@prisma/client';
import { getTMDBPersonDetails, getTMDBProfileImageUrl } from '@/lib/tmdb-person';
import Image from 'next/image';

// Use global prisma instance for Next.js (avoid connection issues)
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Extract tmdbId from route param
 * Format: {tmdb_id}-{slug}
 */
function parsePersonId(id: string): number | null {
  const match = id.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  const tmdbId = parsePersonId(id);
  
  if (!tmdbId) {
    notFound();
  }

  // Fetch person from TMDB with combined credits
  const person = await getTMDBPersonDetails(tmdbId, true);
  
  if (!person) {
    notFound();
  }

  // Get TV series credits only (filter movies)
  const tvCredits = person.combined_credits?.cast
    .filter(credit => credit.media_type === 'tv')
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 10) || [];

  // Get related articles from database
  const relatedArticles = await prisma.articles.findMany({
    where: {
      article_persons: {
        some: {
          persons: {
            tmdbId: tmdbId
          }
        }
      },
      status: 'published'
    },
    orderBy: {
      publishedAt: 'desc'
    },
    take: 5,
    select: {
      id: true,
      title: true,
      slug: true,
      publishedAt: true,
      heroImageUrl: true
    }
  });

  // Format biography into 2-4 paragraphs
  const bioParagraphs = person.biography
    ? person.biography.split('\n\n').filter(p => p.trim().length > 0).slice(0, 4)
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SECTION 1: HERO */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center gap-8">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <Image
                src={getTMDBProfileImageUrl(person.profile_path, 'h632')}
                alt={person.name}
                width={200}
                height={300}
                className="rounded-lg shadow-2xl"
                priority
              />
            </div>

            {/* Name & Subline */}
            <div>
              <h1 className="text-5xl font-bold mb-3">{person.name}</h1>
              <p className="text-xl text-gray-300">
                {person.known_for_department} · bekannt aus Serien
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-12">
            {/* SECTION 3: BIOGRAPHY */}
            {bioParagraphs.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-6">Biografie</h2>
                <div className="prose prose-lg max-w-none space-y-4">
                  {bioParagraphs.map((para, idx) => (
                    <p key={idx} className="text-gray-700 leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 4: SERIES CREDITS */}
            {tvCredits.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-6">
                  Serien mit {person.name}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  {tvCredits.map((credit, idx) => (
                    <div key={`${credit.id}-${idx}`} className="group">
                      <div className="relative aspect-[2/3] mb-3 rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition">
                        {credit.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${credit.poster_path}`}
                            alt={credit.name || credit.title || ''}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-400">Kein Bild</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2">
                        {credit.name || credit.title}
                      </h3>
                      {credit.character && (
                        <p className="text-sm text-gray-600 line-clamp-1">
                          als {credit.character}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 5: RELATED NEWS */}
            {relatedArticles.length > 0 && (
              <section>
                <h2 className="text-3xl font-bold mb-6">
                  Aktuelle News mit {person.name}
                </h2>
                <div className="space-y-4">
                  {relatedArticles.map(article => (
                    <a
                      key={article.id}
                      href={`/${article.slug}`}
                      className="flex gap-4 p-4 bg-white rounded-lg shadow hover:shadow-md transition"
                    >
                      {article.heroImageUrl && (
                        <div className="relative w-24 h-24 flex-shrink-0 rounded overflow-hidden">
                          <Image
                            src={article.heroImageUrl}
                            alt={article.title}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1 line-clamp-2">
                          {article.title}
                        </h3>
                        <time className="text-sm text-gray-500">
                          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('de-DE') : ''}
                        </time>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* SECTION 2: INFOBOX (Sidebar) */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h3 className="font-bold text-lg mb-4">Steckbrief</h3>
              <dl className="space-y-3 text-sm">
                {person.birthday && (
                  <>
                    <dt className="text-gray-500">Geboren</dt>
                    <dd className="font-semibold">
                      {new Date(person.birthday).toLocaleDateString('de-DE', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </>
                )}
                
                {person.place_of_birth && (
                  <>
                    <dt className="text-gray-500 mt-4">Geburtsort</dt>
                    <dd className="font-semibold">{person.place_of_birth}</dd>
                  </>
                )}
                
                {tvCredits.length > 0 && (
                  <>
                    <dt className="text-gray-500 mt-4">Bekannt für</dt>
                    <dd className="space-y-1">
                      {tvCredits.slice(0, 3).map((credit, idx) => (
                        <div key={idx} className="text-sm">
                          {credit.name || credit.title}
                        </div>
                      ))}
                    </dd>
                  </>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const tmdbId = parsePersonId(id);
  
  if (!tmdbId) {
    return {
      title: 'Person nicht gefunden'
    };
  }

  const person = await getTMDBPersonDetails(tmdbId, false);
  
  if (!person) {
    return {
      title: 'Person nicht gefunden'
    };
  }

  return {
    title: `${person.name} – Serien, Rollen & aktuelle News`,
    description: `${person.name} in Serien: bekannte Rollen, aktuelle Projekte und alle News auf serien.de`,
    openGraph: {
      title: `${person.name} – Serien, Rollen & News`,
      description: `Alle Informationen zu ${person.name}: Serien-Rollen, Biografie und aktuelle News`,
      images: person.profile_path ? [getTMDBProfileImageUrl(person.profile_path, 'h632')] : []
    }
  };
}
