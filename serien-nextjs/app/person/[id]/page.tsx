/**
 * Person/Actor Page
 * Route: /person/[id] where id = {tmdb_id}-{slug}
 * Example: /person/287-brad-pitt
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTMDBPersonDetails, getTMDBProfileImageUrl } from '@/lib/tmdb-person';
import Image from 'next/image';
import Link from 'next/link';

// ISR - Revalidate every 5 minutes
export const revalidate = 300;


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

/**
 * Generate SEO Metadata for person pages
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = parsePersonId(id);
  
  if (!tmdbId) {
    return {
      title: 'Person nicht gefunden | serien.de',
      robots: { index: false, follow: false }
    };
  }
  
  const person = await getTMDBPersonDetails(tmdbId, false);
  
  if (!person) {
    return {
      title: 'Person nicht gefunden | serien.de',
      robots: { index: false, follow: false }
    };
  }
  
  const title = `${person.name} – Serien, Filme & News | serien.de`;
  const description = person.biography 
    ? `${person.biography.slice(0, 150)}...`
    : `Alle Serien und Filme mit ${person.name}. Entdecke die Karriere, News und mehr bei serien.de.`;
  
  return {
    title,
    description,
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    openGraph: {
      title,
      description,
      type: 'profile',
      images: person.profile_path 
        ? [`https://image.tmdb.org/t/p/w500${person.profile_path}`]
        : undefined,
    },
    alternates: {
      canonical: `/person/${id}`,
    },
  };
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

  // Topical Cluster: Get characters played by this person
  const playedCharacters = await prisma.characters.findMany({
    where: {
      actorTmdbId: tmdbId,
      publishStatus: 'published',
    },
    take: 6,
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      series: {
        select: {
          tmdbId: true,
          name: true,
          title: true,
          slug: true,
        }
      }
    }
  });

  // Topical Cluster: Get series this person appears in (from our DB)
  const personSeries = await prisma.series.findMany({
    where: {
      characters: {
        some: {
          actorTmdbId: tmdbId,
        }
      }
    },
    take: 6,
    select: {
      tmdbId: true,
      name: true,
      title: true,
      slug: true,
      posterPath: true,
    }
  });

  // Format biography into 2-4 paragraphs
  const bioParagraphs = person.biography
    ? person.biography.split('\n\n').filter(p => p.trim().length > 0).slice(0, 4)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* SECTION 1: HERO - Mobile optimized */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-8 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <Image
                src={getTMDBProfileImageUrl(person.profile_path, 'h632')}
                alt={person.name}
                width={150}
                height={225}
                className="rounded-lg shadow-2xl w-[120px] h-[180px] sm:w-[150px] sm:h-[225px] md:w-[200px] md:h-[300px] object-cover"
                priority
              />
            </div>

            {/* Name & Subline */}
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2 md:mb-3">{person.name}</h1>
              <p className="text-base md:text-xl text-gray-300">
                {person.known_for_department} · bekannt aus Serien
              </p>
              
              {/* Mobile Infobox - Key facts inline */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center sm:justify-start sm:hidden">
                {person.birthday && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    * {new Date(person.birthday).toLocaleDateString('de-DE', { year: 'numeric' })}
                  </span>
                )}
                {person.place_of_birth && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm truncate max-w-[200px]">
                    {person.place_of_birth.split(',')[0]}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        {/* Mobile: Infobox first, then content */}
        <div className="sm:hidden mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-5">
            <h3 className="font-bold text-lg mb-4 dark:text-white">Steckbrief</h3>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              {person.birthday && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Geboren</dt>
                  <dd className="font-semibold dark:text-white">
                    {new Date(person.birthday).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </dd>
                </div>
              )}
              {person.place_of_birth && (
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Geburtsort</dt>
                  <dd className="font-semibold dark:text-white text-sm">{person.place_of_birth}</dd>
                </div>
              )}
            </dl>
            {tvCredits.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <dt className="text-gray-500 dark:text-gray-400 text-sm mb-2">Bekannt für</dt>
                <div className="flex flex-wrap gap-2">
                  {tvCredits.slice(0, 3).map((credit, idx) => (
                    <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs dark:text-white">
                      {credit.name || credit.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-10 md:space-y-12">
            {/* SECTION 3: BIOGRAPHY */}
            {bioParagraphs.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">Biografie</h2>
                <div className="prose prose-base md:prose-lg max-w-none space-y-4 dark:prose-invert">
                  {bioParagraphs.map((para, idx) => (
                    <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">
                      {para}
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* Topical Cluster: Characters played by this person */}
            {playedCharacters.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Rollen von {person.name.split(' ')[0]}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {playedCharacters.map((char) => (
                    <Link
                      key={char.id}
                      href={`/figur/${char.slug}`}
                      className="group bg-white dark:bg-gray-900 rounded-lg p-3 shadow hover:shadow-md transition"
                    >
                      <p className="font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-1">
                        {char.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        in {char.series?.name || char.series?.title || 'Serie'}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Topical Cluster: Series this person appears in (linked) */}
            {personSeries.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Serien bei serien.de
                </h2>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {personSeries.map((series) => (
                    <Link
                      key={series.tmdbId}
                      href={`/serie/${series.tmdbId}-${series.slug}`}
                      className="group"
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition bg-gray-200 dark:bg-gray-800">
                        {series.posterPath ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${series.posterPath}`}
                            alt={series.name || series.title || ''}
                            fill
                            sizes="(max-width: 640px) 33vw, 200px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400 text-xs">Kein Bild</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 font-semibold text-xs md:text-sm text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-2">
                        {series.name || series.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 4: SERIES CREDITS */}
            {tvCredits.length > 0 && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Serien mit {person.name.split(' ')[0]}
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 md:gap-6">
                  {tvCredits.map((credit, idx) => (
                    <div key={`${credit.id}-${idx}`} className="group">
                      <div className="relative aspect-[2/3] mb-2 md:mb-3 rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition bg-gray-200 dark:bg-gray-800">
                        {credit.poster_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w342${credit.poster_path}`}
                            alt={credit.name || credit.title || ''}
                            fill
                            sizes="(max-width: 640px) 33vw, (max-width: 768px) 33vw, 200px"
                            className="object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-gray-400 text-xs">Kein Bild</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-xs md:text-sm line-clamp-2 dark:text-white">
                        {credit.name || credit.title}
                      </h3>
                      {credit.character && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
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
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  News zu {person.name.split(' ')[0]}
                </h2>
                <div className="space-y-3 md:space-y-4">
                  {relatedArticles.map(article => (
                    <a
                      key={article.id}
                      href={`/${article.slug}`}
                      className="flex gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-md transition"
                    >
                      {article.heroImageUrl && (
                        <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded overflow-hidden">
                          <Image
                            src={article.heroImageUrl}
                            alt={article.title}
                            fill
                            sizes="96px"
                            className="object-cover"
                            loading="lazy"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm md:text-lg mb-1 line-clamp-2 dark:text-white">
                          {article.title}
                        </h3>
                        <time className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('de-DE') : ''}
                        </time>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* SECTION 2: INFOBOX (Sidebar) - Hidden on mobile, shown on desktop */}
          <aside className="hidden sm:block md:col-span-1">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 sticky top-8">
              <h3 className="font-bold text-lg mb-4 dark:text-white">Steckbrief</h3>
              <dl className="space-y-3 text-sm">
                {person.birthday && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">Geboren</dt>
                    <dd className="font-semibold dark:text-white">
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
                    <dt className="text-gray-500 dark:text-gray-400 mt-4">Geburtsort</dt>
                    <dd className="font-semibold dark:text-white">{person.place_of_birth}</dd>
                  </>
                )}
                
                {tvCredits.length > 0 && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400 mt-4">Bekannt für</dt>
                    <dd className="space-y-1">
                      {tvCredits.slice(0, 3).map((credit, idx) => (
                        <div key={idx} className="text-sm dark:text-white">
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

      {/* Schema.org Person Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: person.name,
            image: person.profile_path ? getTMDBProfileImageUrl(person.profile_path, 'h632') : undefined,
            birthDate: person.birthday,
            birthPlace: person.place_of_birth,
            jobTitle: person.known_for_department,
            description: person.biography ? person.biography.substring(0, 200) + '...' : undefined,
            sameAs: `https://www.themoviedb.org/person/${tmdbId}`,
            url: `https://serien.de/person/${id}`,
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://serien.de/person/${id}`
            }
          })
        }}
      />
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
