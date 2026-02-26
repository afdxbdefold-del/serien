import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Film, Star, Play, Clock, Tv } from 'lucide-react';
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
                        <span className="text-gray-500 text-sm">/ 10</span>
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
                      <div className="text-sm text-gray-600 mb-1">Sender/Plattform</div>
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

              {/* Overview */}
              {series.overview && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">📝 Über die Serie</h3>
                  <p className="text-gray-700 leading-relaxed">
                    {series.overview}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
              
              <div className="flex flex-wrap gap-4 text-sm">
                {series.voteAverage && (
                  <div className="flex items-center gap-2 bg-yellow-500 text-black px-3 py-1 rounded-full font-bold">
                    <Star className="w-4 h-4 fill-current" />
                    {series.voteAverage.toFixed(1)}
                  </div>
                )}
                {series.firstAirDate && (
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <Calendar className="w-4 h-4" />
                    {new Date(series.firstAirDate).getFullYear()}
                  </div>
                )}
                {series.numberOfSeasons && (
                  <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
                    <Film className="w-4 h-4" />
                    {series.numberOfSeasons} Staffel{series.numberOfSeasons > 1 ? 'n' : ''}
                  </div>
                )}
                {series.status && (
                  <div className="bg-white/20 px-3 py-1 rounded-full">
                    {series.status}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container mx-auto px-6 py-12 max-w-7xl">
        {/* Series Status Box */}
        <div className="mb-8">
          <SeriesStatusBox 
            seriesId={series.tmdbId.toString()} 
            seriesName={series.name || ''} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-12">
            {/* Overview */}
            {series.overview && (
              <section>
                <h2 className="text-2xl font-bold mb-4">Über die Serie</h2>
                <p className="text-gray-700 leading-relaxed text-lg">
                  {series.overview}
                </p>
              </section>
            )}

            {/* Trailers */}
            {trailers.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Trailer</h2>
                <div className="grid grid-cols-1 gap-6">
                  {trailers.map((trailer: any, index: number) => (
                    <div key={index} className="aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        src={`https://www.youtube.com/embed/${trailer.key}`}
                        title={trailer.name}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Cast</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                  {cast.slice(0, 12).map((member: any, index: number) => (
                    <div key={index} className="text-center">
                      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden mb-3 bg-gray-200">
                        {member.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${member.profile_path}`}
                            alt={member.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-4xl">{member.name[0]}</span>
                          </div>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm">{member.name}</h3>
                      <p className="text-xs text-gray-600">{member.character}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Seasons */}
            {seasons.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-6">Staffeln</h2>
                <div className="space-y-4">
                  {seasons
                    .filter((s: any) => s.season_number > 0)
                    .map((season: any) => (
                      <div key={season.season_number} className="flex gap-4 p-4 bg-white rounded-xl border border-gray-200">
                        {season.poster_path && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${season.poster_path}`}
                            alt={season.name}
                            width={60}
                            height={90}
                            className="rounded-lg"
                          />
                        )}
                        <div>
                          <h3 className="font-bold">{season.name}</h3>
                          <p className="text-sm text-gray-600">
                            {season.episode_count} Episode{season.episode_count > 1 ? 'n' : ''}
                            {season.air_date && ` • ${new Date(season.air_date).getFullYear()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Recent Articles - Using SeriesHubArticles component */}
            <section>
              <SeriesHubArticles seriesId={series.tmdbId.toString()} limit={7} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Creators */}
            {creators.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold mb-4">Creator{creators.length > 1 ? 's' : ''}</h3>
                <div className="space-y-3">
                  {creators.map((creator: any, index: number) => (
                    <div key={index}>
                      <p className="font-medium">{creator.name}</p>
                      <p className="text-sm text-gray-600">{creator.job}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Networks */}
            {series.networks && series.networks.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold mb-4">Sender/Plattform</h3>
                <div className="flex flex-wrap gap-2">
                  {series.networks.map((network: string, index: number) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                      {network}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Genres */}
            {series.genres && series.genres.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold mb-4">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {series.genres.map((genre: string, index: number) => (
                    <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold mb-4">Schlagwörter</h3>
                <div className="flex flex-wrap gap-2">
                  {keywords.slice(0, 15).map((keyword: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related Articles */}
        {series.primaryArticles.length > 0 && (
          <section className="mt-16">
            <h2 className="text-3xl font-bold mb-8">News zu {series.name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {series.primaryArticles.map((article: any) => (
                <Link
                  key={article.slug}
                  href={`/${article.slug}`}
                  className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all"
                >
                  {article.heroImageUrl && (
                    <div className="relative h-48 bg-gray-200">
                      <Image
                        src={article.heroImageUrl}
                        alt={article.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <h3 className="font-bold text-lg mb-2 group-hover:text-blue-600 transition-colors">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                        {article.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{article.author.name}</span>
                      <span>•</span>
                      <span>{new Date(article.publishedAt).toLocaleDateString('de-DE')}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
