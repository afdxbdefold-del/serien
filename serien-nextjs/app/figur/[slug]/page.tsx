/**
 * Character Page - Figuren-Seiten
 * URL: /figur/{slug}
 * Discover-optimized authority pages for fictional TV characters
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/lib/prisma';

interface CharacterPageProps {
  params: {
    slug: string;
  };
}

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const character = await prisma.characters.findUnique({
    where: { slug: params.slug },
    select: {
      metaTitle: true,
      metaDescription: true,
      name: true,
    },
  });

  if (!character) {
    return {
      title: 'Figur nicht gefunden',
    };
  }

  return {
    title: character.metaTitle || `${character.name} - Serienfigur`,
    description: character.metaDescription || undefined,
  };
}

export default async function CharacterPage({ params }: CharacterPageProps) {
  // Fetch character with all relations
  const character = await prisma.characters.findUnique({
    where: { slug: params.slug },
    include: {
      series: {
        select: {
          tmdbId: true,
          name: true,
          title: true,
          posterPath: true,
        },
      },
      actor: {
        select: {
          tmdbId: true,
          name: true,
          slug: true,
          profilePath: true,
        },
      },
    },
  });

  if (!character || character.publishStatus !== 'published') {
    notFound();
  }

  // Fetch related articles mentioning this character
  const relatedArticles = await prisma.article.findMany({
    where: {
      status: 'published',
      primarySeriesId: character.seriesTmdbId,
    },
    orderBy: {
      publishedAt: 'desc',
    },
    take: 10,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      publishedAt: true,
      cardImageUrl: true,
    },
  });

  const qa = character.qaContent as Array<{ question: string; answer: string }> | null;
  const seriesName = character.series.name || character.series.title;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            {character.name}
          </h1>
          {character.shortDescription && (
            <p className="text-lg text-gray-600 leading-relaxed">
              {character.shortDescription}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Infobox */}
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">
                Figuren-Infos
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Serie:</span>
                  <Link
                    href={`/serie/${character.seriesTmdbId}`}
                    className="ml-2 text-blue-600 hover:underline font-medium"
                  >
                    {seriesName}
                  </Link>
                </div>
                {character.actor && (
                  <div>
                    <span className="text-sm text-gray-500">Gespielt von:</span>
                    <Link
                      href={`/person/${character.actor.slug}`}
                      className="ml-2 text-blue-600 hover:underline font-medium"
                    >
                      {character.actor.name}
                    </Link>
                  </div>
                )}
                {character.status && (
                  <div>
                    <span className="text-sm text-gray-500">Status:</span>
                    <span className="ml-2 font-medium">{character.status}</span>
                  </div>
                )}
                {character.firstAppearance && (
                  <div>
                    <span className="text-sm text-gray-500">Erstauftritt:</span>
                    <span className="ml-2">{character.firstAppearance}</span>
                  </div>
                )}
                {character.seasons && (
                  <div>
                    <span className="text-sm text-gray-500">Staffel(n):</span>
                    <span className="ml-2">{character.seasons}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Wer ist {Name}? */}
            {character.whoIsContent && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Wer ist {character.name}?
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {character.whoIsContent}
                </div>
              </section>
            )}

            {/* Bedeutung für die Handlung */}
            {character.importanceContent && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Bedeutung für die Handlung
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {character.importanceContent}
                </div>
              </section>
            )}

            {/* Rolle in der Serie */}
            {character.roleInSeriesContent && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Rolle in der Serie
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {character.roleInSeriesContent}
                </div>
              </section>
            )}

            {/* Wichtige Auftritte & Wendepunkte */}
            {character.appearancesContent && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Wichtige Auftritte & Wendepunkte
                </h2>
                <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                  {character.appearancesContent}
                </div>
              </section>
            )}

            {/* Darsteller & Besetzung */}
            {character.actor && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Darsteller & Besetzung
                </h2>
                <div className="flex items-start gap-4">
                  {character.actor.profilePath && (
                    <Link href={`/person/${character.actor.slug}`}>
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${character.actor.profilePath}`}
                        alt={character.actor.name}
                        width={80}
                        height={120}
                        className="rounded-lg shadow-md hover:shadow-lg transition-shadow"
                      />
                    </Link>
                  )}
                  <div>
                    <Link
                      href={`/person/${character.actor.slug}`}
                      className="text-lg font-semibold text-blue-600 hover:underline"
                    >
                      {character.actor.name}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      spielt {character.name} in {seriesName}.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Q&A */}
            {qa && qa.length > 0 && (
              <section className="bg-gray-50 rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  💡 Häufige Fragen
                </h2>
                <div className="space-y-4">
                  {qa.map((item, index) => (
                    <div key={index} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        {item.question}
                      </h3>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Related Articles */}
            {relatedArticles.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  📰 Aktuelle News zu {character.name}
                </h2>
                <div className="space-y-4">
                  {relatedArticles.map((article) => (
                    <Link
                      key={article.id}
                      href={`/${article.slug}`}
                      className="block hover:bg-gray-50 p-3 rounded-lg transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900 mb-1 hover:text-blue-600">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString('de-DE')
                          : ''}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Series Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm sticky top-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Zur Serie
              </h3>
              <Link
                href={`/serie/${character.seriesTmdbId}`}
                className="block hover:opacity-80 transition-opacity"
              >
                {character.series.posterPath && (
                  <Image
                    src={`https://image.tmdb.org/t/p/w300${character.series.posterPath}`}
                    alt={seriesName}
                    width={300}
                    height={450}
                    className="rounded-lg shadow-md w-full mb-3"
                  />
                )}
                <p className="font-semibold text-gray-900 hover:text-blue-600">
                  {seriesName}
                </p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
