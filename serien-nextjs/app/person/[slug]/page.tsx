import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, MapPin, TrendingUp } from 'lucide-react';
import prisma from '@/lib/prisma';
import { getTMDBProfileImageUrl } from '@/lib/tmdb-person';

interface PersonPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PersonPageProps): Promise<Metadata> {
  const { slug } = await params;
  const person = await prisma.person.findUnique({
    where: { slug },
  });

  if (!person) {
    return {
      title: 'Person nicht gefunden',
    };
  }

  const description = person.biography
    ? person.biography.substring(0, 160) + '...'
    : `Alle Infos zu ${person.name} – Serien, Biografie und mehr.`;

  return {
    title: `${person.name} – Serien & Biografie`,
    description,
    openGraph: {
      title: `${person.name}`,
      description,
      type: 'profile',
      images: person.profilePath
        ? [getTMDBProfileImageUrl(person.profilePath, 'w500')]
        : [],
    },
  };
}

export default async function PersonPage({ params }: PersonPageProps) {
  const { slug } = await params;
  const person = await prisma.person.findUnique({
    where: { slug },
    include: {
      articles: {
        include: {
          article: {
            include: {
              primarySeries: true,
            },
          },
        },
        take: 10,
        orderBy: {
          article: {
            publishedAt: 'desc',
          },
        },
      },
    },
  });

  if (!person) {
    notFound();
  }

  const profileImageUrl = getTMDBProfileImageUrl(person.profilePath, 'w500');

  // Format dates
  const birthYear = person.birthDate ? new Date(person.birthDate).getFullYear() : null;
  const birthDateFormatted = person.birthDate
    ? new Date(person.birthDate).toLocaleDateString('de-DE', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Get unique series
  const relatedSeries = Array.from(
    new Map(
      person.articles.map((ap) => [
        ap.article.primarySeries.tmdbId,
        ap.article.primarySeries,
      ])
    ).values()
  ).slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Profile Image */}
            <div className="flex-shrink-0">
              <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl overflow-hidden bg-gray-700 shadow-2xl">
                <Image
                  src={profileImageUrl}
                  alt={person.name}
                  width={256}
                  height={256}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">
                Bild: TMDB
              </p>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                {person.name}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap gap-4 text-gray-300 mb-6">
                {birthDateFormatted && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span>{birthDateFormatted}</span>
                  </div>
                )}
                {person.birthPlace && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    <span>{person.birthPlace}</span>
                  </div>
                )}
                {person.popularity && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <span>Beliebtheit: {person.popularity.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Biography */}
              {person.biography && (
                <div className="prose prose-invert max-w-none">
                  <p className="text-gray-200 leading-relaxed">
                    {person.biography.length > 500
                      ? person.biography.substring(0, 500) + '...'
                      : person.biography}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Bekannt aus Section */}
        {relatedSeries.length > 0 && (
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 text-gray-900">
              Bekannt aus
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {relatedSeries.map((series) => (
                <Link
                  key={series.id}
                  href={`/serie/${series.slug}`}
                  className="group"
                >
                  <div className="aspect-[2/3] rounded-lg overflow-hidden bg-gray-200 mb-2 shadow-md group-hover:shadow-xl transition-shadow">
                    {series.posterPath && (
                      <Image
                        src={`https://image.tmdb.org/t/p/w342${series.posterPath}`}
                        alt={series.title || series.name}
                        width={342}
                        height={513}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                      />
                    )}
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 group-hover:text-blue-600 transition-colors">
                    {series.title || series.name}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Related Articles */}
        {person.articles.length > 0 && (
          <section>
            <h2 className="text-3xl font-bold mb-6 text-gray-900">
              Aktuelle Artikel
            </h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {person.articles.map(({ article }) => (
                <Link
                  key={article.id}
                  href={`/${article.slug}`}
                  className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
                >
                  {article.heroImageUrl && (
                    <div className="aspect-video bg-gray-200 overflow-hidden">
                      <Image
                        src={article.heroImageUrl}
                        alt={article.title}
                        width={600}
                        height={338}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="font-bold text-lg mb-2 text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {article.primarySeries.title || article.primarySeries.name}
                    </p>
                    {article.publishedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(article.publishedAt).toLocaleDateString(
                          'de-DE',
                          {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          }
                        )}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: person.name,
            image: person.profilePath
              ? getTMDBProfileImageUrl(person.profilePath, 'w500')
              : undefined,
            birthDate: person.birthDate?.toISOString().split('T')[0],
            birthPlace: person.birthPlace || undefined,
            sameAs: `https://www.themoviedb.org/person/${person.tmdbId}`,
          }),
        }}
      />
    </div>
  );
}
