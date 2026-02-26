import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { Star, Tv } from 'lucide-react';
import FollowButtonLocal from '@/components/FollowButtonLocal';

interface PageProps {
  params: Promise<{ slug: string }>;
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
      primaryArticles: {
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
          author: {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Hero Section */}
      <div className="relative h-[40vh] min-h-[300px] bg-gradient-to-br from-slate-100 to-gray-100 overflow-hidden">
        {series.backdropPath && (
          <>
            <Image
              src={`https://image.tmdb.org/t/p/original${series.backdropPath}`}
              alt={series.name || ''}
              fill
              className="object-cover opacity-20"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/60 to-transparent" />
          </>
        )}
        
        <div className="relative container mx-auto px-6 h-full flex items-end pb-8">
          <div className="w-full">
            <div className="flex items-end gap-6">
              {/* Poster - Hidden on mobile */}
              {series.posterPath && (
                <div className="hidden md:block flex-shrink-0">
                  <Image
                    src={`https://image.tmdb.org/t/p/w500${series.posterPath}`}
                    alt={series.name || ''}
                    width={120}
                    height={180}
                    className="rounded-lg shadow-xl border-2 border-white"
                  />
                </div>
              )}
              
              {/* Title & Quick Meta */}
              <div className="flex-1">
                <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-3">
                  {series.name}
                </h1>
                
                {/* Meta Row */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  {series.voteAverage && (
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-semibold text-gray-900">{series.voteAverage.toFixed(1)}</span>
                    </div>
                  )}
                  
                  {series.firstAirDate && (
                    <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200 text-sm font-medium text-gray-700">
                      {new Date(series.firstAirDate).getFullYear()}
                    </div>
                  )}
                  
                  {series.numberOfSeasons && (
                    <div className="bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200 text-sm font-medium text-gray-700">
                      {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
                    </div>
                  )}
                  
                  {series.status && (
                    <div className={`px-3 py-1.5 rounded-full shadow-sm border text-sm font-medium ${
                      series.status === 'Returning Series' || series.status === 'Running'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}>
                      {series.status === 'Returning Series' ? 'Läuft' : 
                       series.status === 'Ended' ? 'Beendet' : series.status}
                    </div>
                  )}
                </div>
                
                {/* Follow Button */}
                <div>
                  <FollowButtonLocal 
                    tmdbId={series.tmdbId} 
                    seriesName={series.name || ''} 
                  />
                </div>
              </div>
            </div>
            
            {/* Overview - Critical Info */}
            {series.overview && (
              <div className="mt-8 max-w-4xl">
                <p className="text-gray-700 text-lg leading-relaxed">
                  {series.overview}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content: 2-Column Layout */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: News Feed (Main Focus) */}
          <div className="lg:col-span-8">
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
                      {/* Image */}
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
                      
                      {/* Content */}
                      <div className={`p-6 ${index === 0 ? 'lg:flex-1' : ''}`}>
                        <h3 className={`font-bold text-gray-900 group-hover:text-cyan-600 transition-colors line-clamp-2 ${
                          index === 0 ? 'text-2xl mb-3' : 'text-lg mb-2'
                        }`}>
                          {article.title}
                        </h3>
                        
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
                <p className="text-gray-500">Noch keine News zu dieser Serie verfügbar.</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Sidebar with Critical Info */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-6 space-y-6">
              
              {/* Critical Info Card */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Serie-Informationen</h3>
                
                <div className="space-y-3">
                  {series.status && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Status</div>
                      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        series.status === 'Returning Series' || series.status === 'Running'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {series.status === 'Returning Series' ? 'Läuft' : 
                         series.status === 'Ended' ? 'Beendet' : series.status}
                      </div>
                    </div>
                  )}
                  
                  {series.voteAverage && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Bewertung</div>
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        <span className="font-bold text-gray-900">{series.voteAverage.toFixed(1)}</span>
                        <span className="text-gray-500 text-sm">von 10</span>
                      </div>
                    </div>
                  )}
                  
                  {series.numberOfSeasons && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Staffeln</div>
                      <div className="font-semibold text-gray-900">{series.numberOfSeasons}</div>
                    </div>
                  )}
                  
                  {series.networks && series.networks.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Sender und Plattform</div>
                      <div className="flex flex-wrap gap-2">
                        {series.networks.map((network) => (
                          <span key={network} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm font-medium">
                            {network}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {series.genres && series.genres.length > 0 && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Genres</div>
                      <div className="flex flex-wrap gap-2">
                        {series.genres.map((genre) => (
                          <span key={genre} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
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
                <div className="bg-white rounded-xl border border-gray-200 p-6">
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
                        <div className="text-xs text-gray-500 line-clamp-1">{actor.character}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Trailer */}
              {trailers.length > 0 && trailers[0].key && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
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
      </div>
    </div>
  );
}
