import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv } from 'lucide-react';
import { Metadata } from 'next';
import FollowButtonLocal from '@/components/FollowButtonLocal';
import MobileHeroWithVideo from '@/components/MobileHeroWithVideo';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesQA from '@/components/SeriesQA';
import { getSeriesQA } from '@/lib/series-qa-action';
import SeriesOverview from '@/components/SeriesOverview';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeriesCast from '@/components/SeriesCast';
import SeasonsStatus from '@/components/SeasonsStatus';
import RelatedSeries from '@/components/RelatedSeries';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const tmdbId = parseInt(slug.split('-')[0]);
  
  if (isNaN(tmdbId)) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }

  const series = await prisma.series.findUnique({
    where: { tmdbId },
    select: {
      name: true,
      title: true,
      overview: true,
      backdropPath: true,
      tmdbType: true,
    },
  });

  if (!series) {
    return {
      title: 'Serie nicht gefunden | serien.de',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  const seriesName = series.name || series.title;
  const ogImage = `/img/og/${series.tmdbType}/${tmdbId}`;

  return {
    title: `${seriesName} - Alle News, Trailer & Updates | serien.de`,
    description: series.overview || `Alle Neuigkeiten, Trailer und Updates zu ${seriesName}`,
    metadataBase: new URL(baseUrl),
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    alternates: {
      canonical: `/serie/${slug}`,
    },
    openGraph: {
      title: `${seriesName} | serien.de`,
      description: series.overview || `Alle Neuigkeiten zu ${seriesName}`,
      type: 'website',
      url: `/serie/${slug}`,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seriesName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${seriesName} | serien.de`,
      description: series.overview || `Alle Neuigkeiten zu ${seriesName}`,
      images: [ogImage],
    },
  };
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Extract TMDB ID from slug (format: "123456-series-name")
  const tmdbId = parseInt(slug.split('-')[0]);
  
  if (isNaN(tmdbId)) {
    notFound();
  }

  // Fetch series with all details
  const series = await prisma.series.findUnique({
    where: { tmdbId },
    include: {
      articles: {
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 10,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          heroLocalUrl: true,
          cardImageUrl: true,
          authorId: true,
          users: {
            select: { name: true, image: true }
          }
        }
      }
    }
  });

  if (!series) {
    notFound();
  }

  const cast = (series.cast as any[]) || [];
  const crew = (series.crew as any[]) || [];
  const trailers = (series.trailers as any[]) || [];
  const creators = crew.filter(c => c.job === 'Creator' || c.job === 'Executive Producer').slice(0, 3);
  
  // Generate Series Q&A (5 evergreen questions)
  const seasons = series.seasons as any[] || [];
  const seriesQA = await getSeriesQA(
    series.name || series.title,
    series.overview || '',
    series.currentStatus || series.status || 'UNKNOWN',
    seasons.length,
    series.firstAirDate,
    null // TODO: Extract last season date from seasons array
  );

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Mobile: Hero at top */}
      <section className="lg:hidden container mx-auto px-6 py-8" aria-labelledby="series-hero">
        <h1 id="series-hero" className="sr-only">{series.name}</h1>
        <div className="bg-white rounded-xl shadow-xl overflow-hidden">
          {/* Hero Image with Video Player (if trailer exists) */}
          <MobileHeroWithVideo
            backdropPath={series.backdropPath}
            posterPath={series.posterPath}
            seriesName={series.name || ''}
            trailerKey={trailers.length > 0 ? trailers[0].key : null}
          />
          
          {/* Series Info */}
          <div className="pt-6 px-6 pb-6">
            {/* Title First */}
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              {series.name}
            </h1>

            {/* Metadata Row: Rating, Year, Seasons, Status */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {series.voteAverage && (
                <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold text-gray-900 text-sm">{series.voteAverage.toFixed(1)}</span>
                </div>
              )}
              {series.firstAirDate && (
                <div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700">
                  {new Date(series.firstAirDate).getFullYear()}
                </div>
              )}
              {series.numberOfSeasons && (
                <div className="bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700">
                  {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
                </div>
              )}
              {series.status && (
                <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                  series.status === 'Returning Series' || series.status === 'Running'
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {series.status === 'Returning Series' ? 'Läuft' : 
                   series.status === 'Ended' ? 'Beendet' : series.status}
                </div>
              )}
            </div>

            {/* Description */}
            {series.overview && (
              <p className="text-gray-700 leading-relaxed mb-4 text-sm">
                {series.overview}
              </p>
            )}

            {/* Follow Button */}
            <div>
              <FollowButtonLocal 
                tmdbId={series.tmdbId} 
                seriesName={series.name || ''} 
              />
            </div>
          </div>
        </div>

        {/* NEW: Where to Stream Box - Standalone Section */}
        <div className="px-6">
          <section className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200 p-6 mb-6">
            <WhereToStreamBox 
              seriesId={series.tmdbId}
              seriesName={series.name || ''}
              networks={series.networks as string[] | undefined}
              slug={slug}
            />
          </section>
        </div>

        {/* NEW: Quick Facts Box */}
        <div className="px-6">
          <QuickFactsBox
            originalTitle={series.originalName || series.originalTitle}
            firstAirYear={series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null}
            creators={creators.map(c => c.name)}
            mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
            platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
            status={series.status}
          />
        </div>

        {/* NEW: Cast Section */}
        <div className="px-6">
          <SeriesCast 
            seriesName={series.name || series.title}
            cast={cast}
          />
        </div>

        {/* NEW: Seasons & Status */}
        <div className="px-6">
          <SeasonsStatus
            seriesName={series.name || series.title}
            seasons={seasons}
            status={series.status}
            numberOfSeasons={series.numberOfSeasons}
          />
        </div>

        {/* Mobile: News Section */}
        <div className="mt-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4 px-6">
            📰 News zu {series.name}
          </h2>

          {series.primaryArticles && series.primaryArticles.length > 0 ? (
            <div className="space-y-4 px-6">
              {series.primaryArticles.slice(0, 3).map((article) => (
                <Link
                  key={article.slug}
                  href={`/${article.slug}`}
                  className="block group"
                >
                  <article className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all">
                    {(article.heroLocalUrl || article.cardImageUrl) && (
                      <div className="relative h-48 overflow-hidden bg-gray-100">
                        <Image
                          src={article.heroLocalUrl || article.cardImageUrl || ''}
                          alt={article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    
                    <div className="p-4">
                      <p className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </p>
                      
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {article.excerpt}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {article.author?.name && (
                          <span className="font-medium">{article.author.name}</span>
                        )}
                        {article.publishedAt && (
                          <span>
                            {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mx-6">
              <p className="text-gray-500 text-sm">Aktuell liegen noch keine eigenen Artikel zu dieser Serie vor.</p>
            </div>
          )}
        </div>

        {/* NEW: Related Series (Mobile) */}
        <div className="mt-8 px-6">
          <RelatedSeries
            currentSeriesId={series.tmdbId}
            genres={series.genres as string[]}
            networks={series.networks as string[]}
          />
        </div>

        {/* Series Q&A Section (Mobile) */}
        {seriesQA && seriesQA.length > 0 && (
          <div className="mt-8 px-6">
            <SeriesQA questions={seriesQA} seriesName={series.name || series.title} />
          </div>
        )}

        {/* Mobile: Series Info Box (AFTER News) */}
        <section className="mt-8 px-6" aria-labelledby="series-info-mobile">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 id="series-info-mobile" className="text-lg font-bold text-gray-900 mb-6">📊 Serien-Infos</h2>
            <div className="space-y-6">
              {/* Genres */}
              {series.genres && series.genres.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {series.genres.map((genre) => (
                      <span key={genre} className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Removed WhereToStreamBox from here - now standalone */}

              {/* Networks */}
              {series.networks && series.networks.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Sender/Plattform</h3>
                  <div className="flex flex-wrap gap-2">
                    {series.networks.map((network) => (
                      <span key={network} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                        {network}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cast */}
              {cast.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">🎭 Cast</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {cast.slice(0, 6).map((actor) => (
                      <div key={actor.id} className="text-center">
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                          {actor.profile_path ? (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Tv className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-medium text-gray-900 line-clamp-1">{actor.name}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{actor.character}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailers.length > 0 && trailers[0].key && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">🎬 Weiterer Trailer</h3>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <iframe
                      src={`https://www.youtube.com/embed/${trailers[0].key}`}
                      title="Series Trailer"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>

      {/* Desktop: 2-Column Layout */}
      <section className="container mx-auto px-6 py-8 lg:py-12 hidden lg:block" aria-labelledby="series-desktop">
        <h1 id="series-desktop" className="sr-only">{series.name}</h1>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT: News Feed (Main Content) */}
          <div className="lg:col-span-7">
            
            {/* NEW: Where to Stream Box - Standalone Section (Desktop) */}
            <section className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border-2 border-blue-200 p-6 mb-6">
              <WhereToStreamBox 
                seriesId={series.tmdbId}
                seriesName={series.name || ''}
                networks={series.networks as string[] | undefined}
                slug={slug}
              />
            </section>

            {/* NEW: Quick Facts Box (Desktop) */}
            <QuickFactsBox
              originalTitle={series.originalName || series.originalTitle}
              firstAirYear={series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null}
              creators={creators.map(c => c.name)}
              mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
              platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
              status={series.status}
            />

            {/* NEW: Cast Section (Desktop) */}
            <SeriesCast 
              seriesName={series.name || series.title}
              cast={cast}
            />

            {/* NEW: Seasons & Status (Desktop) */}
            <SeasonsStatus
              seriesName={series.name || series.title}
              seasons={seasons}
              status={series.status}
              numberOfSeasons={series.numberOfSeasons}
            />

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                📰 News zu {series.name}
              </h2>
              <p className="text-gray-600 mt-1">
                Alle aktuellen Nachrichten und Updates zur Serie
              </p>
            </div>

            {series.primaryArticles && series.primaryArticles.length > 0 ? (
              <div className="space-y-6">
                {series.primaryArticles.map((article, index) => (
                  <Link
                    key={article.slug}
                    href={`/${article.slug}`}
                    className="block group"
                  >
                    <article className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all ${
                      index === 0 ? 'lg:flex lg:gap-6' : ''
                    }`}>
                      {(article.heroLocalUrl || article.cardImageUrl) && (
                        <div className={`relative overflow-hidden bg-gray-100 ${
                          index === 0 
                            ? 'lg:w-2/5 h-64 lg:h-auto' 
                            : 'h-48'
                        }`}>
                          <Image
                            src={article.heroLocalUrl || article.cardImageUrl || ''}
                            alt={article.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                      )}
                      
                      <div className={`p-6 ${index === 0 ? 'lg:flex-1' : ''}`}>
                        <p className={`font-bold text-gray-900 group-hover:text-cyan-600 transition-colors line-clamp-2 ${
                          index === 0 ? 'text-2xl mb-3' : 'text-lg mb-2'
                        }`}>
                          {article.title}
                        </p>
                        
                        {article.excerpt && (
                          <p className={`text-gray-600 line-clamp-${index === 0 ? '3' : '2'} mb-3`}>
                            {article.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {article.author?.name && (
                            <span className="font-medium">{article.author.name}</span>
                          )}
                          {article.publishedAt && (
                            <span>
                              {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <p className="text-gray-500">Aktuell liegen noch keine eigenen Artikel zu dieser Serie vor.</p>
              </div>
            )}

            {/* NEW: Related Series (Desktop) */}
            <div className="mt-8">
              <RelatedSeries
                currentSeriesId={series.tmdbId}
                genres={series.genres as string[]}
                networks={series.networks as string[]}
              />
            </div>
          </div>

          {/* Series Q&A Section (Desktop) */}
          {seriesQA && seriesQA.length > 0 && (
            <div className="lg:col-span-7 mt-8">
              <SeriesQA questions={seriesQA} seriesName={series.name || series.title} />
            </div>
          )}

          {/* RIGHT: Hero Box (Sticky on Desktop) */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="lg:sticky lg:top-6">
              <div className="bg-white rounded-xl shadow-xl overflow-hidden">
                {/* Hero Image with Poster */}
                <div className="relative w-full aspect-[16/9] bg-gray-900">
                  {series.backdropPath && (
                    <>
                      <Image
                        src={`https://image.tmdb.org/t/p/original${series.backdropPath}`}
                        alt={series.name || ''}
                        fill
                        className="object-cover"
                        priority
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    </>
                  )}
                  
                  {series.posterPath && (
                    <div className="absolute bottom-0 left-6 transform translate-y-1/2">
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${series.posterPath}`}
                        alt={series.name || ''}
                        width={120}
                        height={180}
                        className="rounded-lg shadow-2xl border-4 border-white w-[120px] h-auto"
                      />
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="pt-16 px-6 pb-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-[120px]">
                      <div className="flex flex-col gap-2">
                        {series.voteAverage && (
                          <div className="flex items-center justify-center gap-1 bg-yellow-50 px-2 py-1.5 rounded-lg border border-yellow-200">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-semibold text-gray-900 text-sm">{series.voteAverage.toFixed(1)}</span>
                          </div>
                        )}
                        {series.firstAirDate && (
                          <div className="bg-gray-100 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 text-center">
                            {new Date(series.firstAirDate).getFullYear()}
                          </div>
                        )}
                        {series.numberOfSeasons && (
                          <div className="bg-gray-100 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-700 text-center">
                            {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
                          </div>
                        )}
                        {series.status && (
                          <div className={`px-2 py-1.5 rounded-lg text-xs font-medium text-center ${
                            series.status === 'Returning Series' || series.status === 'Running'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}>
                            {series.status === 'Returning Series' ? 'Läuft' : 
                             series.status === 'Ended' ? 'Beendet' : series.status}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-2xl font-bold text-gray-900 mb-3" aria-label={`Serie: ${series.name}`}>
                        {series.name}
                      </p>
                      {series.overview && (
                        <p className="text-gray-700 leading-relaxed mb-4 text-sm">
                          {series.overview}
                        </p>
                      )}
                      <div>
                        <FollowButtonLocal 
                          tmdbId={series.tmdbId} 
                          seriesName={series.name || ''} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Additional Info */}
                <div className="border-t border-gray-200 p-6 space-y-4">
                  {/* Removed WhereToStreamBox from here - now standalone */}

                  {series.networks && series.networks.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-2 font-medium">Sender/Plattform</div>
                      <div className="flex flex-wrap gap-2">
                        {series.networks.map((network) => (
                          <span key={network} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                            {network}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {series.genres && series.genres.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-2 font-medium">Genres</div>
                      <div className="flex flex-wrap gap-2">
                        {series.genres.map((genre) => (
                          <span key={genre} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Cast */}
              {cast.length > 0 && (
                <div className="bg-white rounded-xl shadow-xl p-6 mt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🎭 Cast</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {cast.slice(0, 6).map((actor) => (
                      <div key={actor.id} className="text-center">
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-2">
                          {actor.profile_path ? (
                            <Image
                              src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                              alt={actor.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <Tv className="h-8 w-8" />
                            </div>
                          )}
                        </div>
                        <div className="text-xs font-medium text-gray-900 line-clamp-1">{actor.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailers.length > 0 && trailers[0].key && (
                <div className="bg-white rounded-xl shadow-xl p-6 mt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">🎬 Trailer</h3>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                    <iframe
                      src={`https://www.youtube.com/embed/${trailers[0].key}`}
                      title="Series Trailer"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
