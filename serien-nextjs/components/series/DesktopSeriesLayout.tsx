import Image from 'next/image';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import FollowButtonLocal from '@/components/FollowButtonLocal';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesOverview from '@/components/SeriesOverview';
import { DiscoverIntro, DiscoverStatus, DiscoverNewsContext, MiniQA } from '@/components/DiscoverContent';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeasonsStatus from '@/components/SeasonsStatus';
import RelatedSeries from '@/components/RelatedSeries';
import SeriesQA from '@/components/SeriesQA';
import RatingWithContext from '@/components/RatingWithContext';

interface DesktopSeriesLayoutProps {
  series: any;
  cast: any[];
  creators: any[];
  seasons: any[];
  trailers: any[];
  seriesQA: any[];
  slug: string;
}

export default function DesktopSeriesLayout({
  series,
  cast,
  creators,
  seasons,
  trailers,
  seriesQA,
  slug,
}: DesktopSeriesLayoutProps) {
  return (
    <section className="container mx-auto px-6 py-8 lg:py-12 hidden lg:block" aria-labelledby="series-desktop">
      <h1 id="series-desktop" className="sr-only">{series.name}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-7">
          
          <DiscoverIntro 
            seriesName={series.name || series.title}
            content={series.discoverIntro || ''}
            hasExtendedOverview={!!series.extendedOverview}
          />

          <WhereToStreamBox 
            seriesId={series.tmdbId}
            seriesName={series.name || ''}
            networks={series.networks as string[] | undefined}
            slug={slug}
          />

          <SeriesOverview
            seriesName={series.name || series.title}
            extendedOverview={series.extendedOverview}
            shortOverview={series.overview}
          />

          <QuickFactsBox
            originalTitle={series.originalName || series.originalTitle}
            firstAirYear={series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null}
            creators={creators.map(c => c.name)}
            mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
            platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
            status={series.status}
          />

          {cast && cast.length > 0 && (
            <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Besetzung von {series.name || series.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {cast.map((actor: any) => {
                  const ActorCard = (
                    <div className="group cursor-pointer">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-2 shadow-sm">
                        {actor.profile_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                            alt={actor.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px"
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                          {actor.name}
                        </p>
                        {actor.character && (
                          <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                            als {actor.character}
                          </p>
                        )}
                      </div>
                    </div>
                  );

                  return actor.personSlug ? (
                    <Link key={actor.id || actor.name} href={`/person/${actor.personSlug}`}>
                      {ActorCard}
                    </Link>
                  ) : (
                    <div key={actor.id || actor.name}>
                      {ActorCard}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <SeasonsStatus
            seriesName={series.name || series.title}
            seasons={seasons}
            status={series.status}
            numberOfSeasons={series.numberOfSeasons}
          />

          <div className="mb-6">
            <DiscoverNewsContext
              seriesName={series.name || series.title}
              content={series.discoverNewsContext || ''}
            />
          </div>

          {series.articles && series.articles.length > 0 ? (
            <div className="space-y-6">
              {series.articles.map((article, index) => (
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
                        {article.users?.name && (
                          <span className="font-medium">{article.users.name}</span>
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

          <div className="mt-8">
            <RelatedSeries
              currentSeriesId={series.tmdbId}
              genres={series.genres as string[]}
              networks={series.networks as string[]}
            />
          </div>
        </div>

        {seriesQA && seriesQA.length > 0 && (
          <div className="lg:col-span-7 mt-8">
            <SeriesQA questions={seriesQA} seriesName={series.name || series.title} />
          </div>
        )}

        <div className="lg:col-span-7">
          <DiscoverStatus
            seriesName={series.name || series.title}
            content={series.discoverStatus || ''}
          />
        </div>

        <div className="lg:col-span-7">
          <MiniQA qa={series.discoverQA as any || []} />
        </div>

        <div className="hidden lg:block lg:col-span-5">
          <div className="lg:sticky lg:top-6">
            <div className="bg-white rounded-xl shadow-xl overflow-hidden">
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
              
              <div className="pt-16 px-6 pb-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-[120px]">
                    <div className="flex flex-col gap-2">
                      {series.voteAverage && (
                        <RatingWithContext 
                          rating={series.voteAverage} 
                          voteCount={series.voteCount || undefined}
                          className="w-full"
                        />
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
              
              <div className="border-t border-gray-200 p-6 space-y-4">
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
  );
}
