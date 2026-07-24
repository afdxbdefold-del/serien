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
import { unstable_cache } from 'next/cache';
import Breadcrumb from '@/components/Breadcrumb';
import ClientAdSlot from '@/components/ClientAdSlot';

// ISR - Revalidate every 5 minutes
export const revalidate = 300;


interface CharacterPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: CharacterPageProps): Promise<Metadata> {
  const { slug } = await params;
  const character = await prisma.characters.findUnique({
    where: { slug },
    select: {
      metaTitle: true,
      metaDescription: true,
      name: true,
      slug: true,
      shortDescription: true,
      series: {
        select: { tmdbId: true, tmdbType: true, name: true, title: true },
      },
    },
  });

  if (!character) {
    return {
      title: 'Figur nicht gefunden',
      robots: { index: false, follow: true },
    };
  }

  const baseUrl = 'https://serien.de';
  const seriesName = character.series?.name || character.series?.title || '';
  const title = character.metaTitle || `${character.name} (${seriesName}) - Serienfigur | serien.de`;
  const description = character.metaDescription || character.shortDescription || `Alles zur Serienfigur ${character.name} aus ${seriesName}.`;
  
  // Use series backdrop as OG image (best available large image)
  const ogImage = character.series?.tmdbId && character.series?.tmdbType
    ? `${baseUrl}/img/og/${character.series.tmdbType}/${character.series.tmdbId}`
    : `${baseUrl}/og-image.png`;

  return {
    title,
    description,
    // Feb 2026 (User-Direktive): noindex,follow — Figuren-Seiten nicht
    // indiziert, aber Links intern werden weiter verfolgt.
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: `${baseUrl}/figur/${character.slug}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${baseUrl}/figur/${character.slug}`,
      siteName: 'serien.de',
      locale: 'de_DE',
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${character.name} - ${seriesName}` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
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
          slug: true,
          posterPath: true,
        },
      },
      persons: {
        select: {
          tmdbId: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (!character || character.publishStatus !== 'published') {
    notFound();
  }

  // Topical Cluster: Fetch related characters from the same series
  const relatedCharacters = await prisma.characters.findMany({
    where: {
      seriesTmdbId: character.seriesTmdbId,
      publishStatus: 'published',
      id: { not: character.id },
    },
    take: 4,
    orderBy: { orderIndex: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      persons: {
        select: {
          name: true,
          tmdbId: true,
        }
      }
    }
  });

  // Fetch related articles mentioning this character
  const relatedArticles = await prisma.articles.findMany({
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
      heroImageUrl: true,
      heroImagePath: true,
      cardImageUrl: true,
    },
  });

  // Parse qaContent safely (handles both string and JSON)
  let qa: Array<{ question: string; answer: string }> | null = null;
  
  if (character.qaContent) {
    try {
      if (typeof character.qaContent === 'string') {
        // Try to parse as JSON if it's a string
        qa = JSON.parse(character.qaContent);
      } else if (Array.isArray(character.qaContent)) {
        // Already an array
        qa = character.qaContent as Array<{ question: string; answer: string }>;
      }
    } catch (error) {
      console.error('Failed to parse qaContent:', error);
      qa = null;
    }
  }
  
  const seriesName = character.series.name || character.series.title;
  const baseUrl = 'https://serien.de';

  // JSON-LD Structured Data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: character.metaTitle || `${character.name} (${seriesName})`,
    description: character.metaDescription || character.shortDescription || '',
    url: `${baseUrl}/figur/${character.slug}`,
    author: { '@id': 'https://serien.de#organization' },
    publisher: { '@id': 'https://serien.de#organization' },
    about: {
      '@type': 'FictionalCharacter',
      name: character.name,
      description: character.shortDescription || '',
      ...(character.persons && {
        actor: {
          '@type': 'Person',
          name: character.persons.name,
          url: `${baseUrl}/person/${character.persons.slug}`,
        },
      }),
    },
    ...(qa && qa.length > 0 && {
      mainEntity: qa.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    }),
  };

  // FAQPage schema for Q&A
  const faqJsonLd = qa && qa.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qa.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      )}

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-blue-50 to-white py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <Breadcrumb items={[{ label: 'Figuren', href: '/figuren' }, { label: seriesName, href: `/serie/${character.series.slug || character.seriesTmdbId}` }, { label: character.name }]} className="mb-6" />
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
                    href={`/serie/${character.series.slug || character.seriesTmdbId}`}
                    className="ml-2 text-blue-600 hover:underline font-medium"
                  >
                    {seriesName}
                  </Link>
                </div>
                {character.persons && (
                  <div>
                    <span className="text-sm text-gray-500">Gespielt von:</span>
                    <Link
                      href={`/person/${character.persons.slug}`}
                      className="ml-2 text-blue-600 hover:underline font-medium"
                    >
                      {character.persons.name}
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
            {character.persons && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Darsteller & Besetzung
                </h2>
                {/* Schauspieler-Foto site-wide entfernt (Juni 2026, Bildrechte). */}
                <Link
                  href={`/person/${character.persons.slug}`}
                  className="text-lg font-semibold text-blue-600 hover:underline"
                >
                  {character.persons.name}
                </Link>
                <p className="text-sm text-gray-600 mt-1">
                  spielt {character.name} in {seriesName}.
                </p>
              </section>
            )}

            {/* Topical Cluster: Related Characters from same series */}
            {relatedCharacters.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Weitere Figuren aus {seriesName}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {relatedCharacters.map((relChar) => (
                    <Link
                      key={relChar.id}
                      href={`/figur/${relChar.slug}`}
                      className="group bg-gray-50 hover:bg-blue-50 rounded-lg p-3 transition-colors"
                    >
                      {/* Charakter-/Schauspieler-Fotos site-wide entfernt (Juni 2026, Bildrechte). */}
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2">
                        {relChar.name}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Mid-Content Ad zwischen Related Characters und Q&A. */}
            <div className="hidden md:flex justify-center empty:hidden">
              <ClientAdSlot position="in_content" />
            </div>

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
                          ? new Date(article.publishedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })
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
                href={`/serie/${character.series.slug || character.seriesTmdbId}`}
                className="block hover:opacity-80 transition-opacity"
              >
                {character.series.posterPath && (
                  <Image
                    src={`/img/tmdb/w300${character.series.posterPath}`}
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
