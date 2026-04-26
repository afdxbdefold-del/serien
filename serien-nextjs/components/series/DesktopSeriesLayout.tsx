import Image from 'next/image';
import Link from 'next/link';
import { Tv } from 'lucide-react';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesOverview from '@/components/SeriesOverview';
import { DiscoverIntro, DiscoverStatus, DiscoverNewsContext, MiniQA } from '@/components/DiscoverContent';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeasonsStatus from '@/components/SeasonsStatus';
import RelatedSeries from '@/components/RelatedSeries';
import SeriesQA from '@/components/SeriesQA';
import RatingWithContext from '@/components/RatingWithContext';
import R2VideoPlayer from '@/components/R2VideoPlayer';
import Breadcrumb from '@/components/Breadcrumb';
import SeriesAuthorBox from '@/components/series/SeriesAuthorBox';

interface DesktopSeriesLayoutProps {
  series: any;
  cast: any[];
  creators: any[];
  seasons: any[];
  trailers: any[];
  localTrailerUrl: string | null;
  relevanceContext: any;
  statusContext: any;
  seriesQA: any[];
  slug: string;
  characters: any[];
  topSeriesAuthor?: {
    name: string;
    image: string | null;
    fullBio: string | null;
    expertise: string[];
    articleCount: number;
  } | null;
}

export default function DesktopSeriesLayout({
  series,
  cast,
  creators,
  seasons,
  trailers,
  localTrailerUrl,
  relevanceContext,
  statusContext,
  seriesQA,
  slug,
  characters,
  topSeriesAuthor,
}: DesktopSeriesLayoutProps) {
  // Prioritize R2 local trailer, fallback to YouTube embed
  const trailerKey = trailers.length > 0 && trailers[0]?.key ? trailers[0].key : null;
  
  return (
    <section className="hidden lg:block" aria-labelledby="series-desktop">
      {/* HERO SECTION mit Video/Backdrop - FULL WIDTH oben */}
      <div className="relative w-full aspect-[21/9] max-h-[500px] bg-gray-900 overflow-hidden">
        {localTrailerUrl ? (
          <R2VideoPlayer
            src={localTrailerUrl}
            poster={series.backdropPath ? `/img/tmdb/w780${series.backdropPath}` : `/img/hero/${series.tmdbType || 'tv'}/${series.tmdbId}`}
          />
        ) : trailerKey ? (
          <iframe
            src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1&autoplay=0`}
            title={`${series.name || series.title} Trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <>
            <Image
              src={series.backdropPath ? `/img/tmdb/original${series.backdropPath}` : `/img/hero/${series.tmdbType || 'tv'}/${series.tmdbId}`}
              alt={series.name || ''}
              fill
              className="object-cover"
              priority
              unoptimized={!series.backdropPath}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/40 to-transparent" />
          </>
        )}
        
        {/* Series Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-gray-950 via-gray-950/80 to-transparent">
          <div className="container mx-auto px-6">
            <div className="flex items-end gap-6">
              {series.posterPath && (
                <Image
                  src={`/img/tmdb/w500${series.posterPath}`}
                  alt={series.name || ''}
                  width={140}
                  height={210}
                  className="rounded-lg shadow-2xl border-2 border-white/20 hidden xl:block"
                />
              )}
              <div className="flex-1">
                <h2 id="series-desktop" className="text-4xl font-bold text-white mb-3">{series.name}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  {series.voteAverage && (
                    <RatingWithContext 
                      rating={series.voteAverage} 
                      voteCount={series.voteCount || undefined}
                    />
                  )}
                  {series.firstAirDate && (
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-sm text-white">
                      {new Date(series.firstAirDate).getFullYear()}
                    </span>
                  )}
                  {series.numberOfSeasons && (
                    <span className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg text-sm text-white">
                      {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
                    </span>
                  )}
                  {series.status && (
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${
                      series.status === 'Returning Series' || series.status === 'Running'
                        ? 'bg-green-500/80 text-white'
                        : 'bg-white/20 text-white'
                    }`}>
                      {series.status === 'Returning Series' ? 'Läuft' : 
                       series.status === 'Ended' ? 'Beendet' : series.status}
                    </span>
                  )}
                </div>
                {series.overview && (
                  <p className="text-gray-200 mt-3 line-clamp-2 max-w-3xl">
                    {series.overview}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* CONTENT SECTION - Grid darunter */}
      <div className="container mx-auto px-6 py-8">
        <Breadcrumb items={[{ label: 'Serien', href: '/trending' }, { label: series.name || series.title }]} className="mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            
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
            creators={(creators || []).map(c => c?.name).filter(Boolean)}
            mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
            platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
            status={series.status}
          />

          {cast && cast.length > 0 && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                Besetzung von {series.name || series.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {cast.map((actor: any) => {
                  const ActorCard = (
                    <div className="group cursor-pointer">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2 shadow-sm">
                        {actor.profile_path ? (
                          <Image
                            src={`/img/tmdb/w185${actor.profile_path}`}
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
                        <p className="font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {actor.name}
                        </p>
                        {actor.character && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-1">
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

          {/* Topical Cluster: Characters Section - Links to Character Pages */}
          {characters && characters.length > 0 && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Figuren aus {series.name || series.title}
                </h2>
                <Link 
                  href={`/figuren?serie=${series.tmdbId}`}
                  className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Alle Figuren →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {characters.map((character: any) => (
                  <Link
                    key={character.id}
                    href={`/figur/${character.slug}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2 shadow-sm">
                      {character.imageUrl ? (
                        <Image
                          src={character.imageUrl}
                          alt={character.name}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 200px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : character.persons?.profilePath ? (
                        <Image
                          src={`/img/tmdb/w185${character.persons.profilePath}`}
                          alt={character.name}
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
                      <p className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {character.name}
                      </p>
                      {character.persons?.name && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mt-0.5">
                          {character.persons.name}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
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
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <span className="text-2xl">📰</span>
                <span>Aktuelle News zu {series.name || series.title}</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                Bestätigte Updates, Einordnungen und zentrale Fakten rund um {series.name || series.title}.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {series.articles.map((article) => {
                  const img = article.heroLocalUrl || article.cardImageUrl || article.heroImageUrl;
                  return (
                    <Link
                      key={article.slug}
                      href={`/${article.slug}`}
                      className="group block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all"
                    >
                      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        {img ? (
                          <Image
                            src={img}
                            alt={article.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 33vw"
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-5xl">📰</span>
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2 mb-2">
                          {article.title}
                        </h3>
                        {article.excerpt && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {article.excerpt}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {article.users?.name && (
                            <span className="font-medium">{article.users.name}</span>
                          )}
                          {article.users?.name && article.publishedAt && <span>·</span>}
                          {article.publishedAt && (
                            <span>
                              {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                                timeZone: 'Europe/Berlin',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">Aktuell liegen noch keine eigenen Artikel zu dieser Serie vor.</p>
            </div>
          )}

          <div className="mt-8">
            <RelatedSeries
              currentSeriesId={series.tmdbId}
              genres={series.genres as string[]}
              networks={series.networks as string[]}
            />
          </div>

          {seriesQA && seriesQA.length > 0 && (
            <div className="mt-8">
              <SeriesQA questions={seriesQA} seriesName={series.name || series.title} />
            </div>
          )}

          <DiscoverStatus
            seriesName={series.name || series.title}
            content={series.discoverStatus || ''}
          />

          <MiniQA qa={series.discoverQA as any || []} />

          {topSeriesAuthor && (
            <div className="mt-8">
              <SeriesAuthorBox
                author={topSeriesAuthor}
                seriesName={series.name || series.title}
              />
            </div>
          )}
        </div>

        {/* Rechte Sidebar */}
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-6 space-y-6">
            
            {/* Networks & Genres Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              {series.networks && series.networks.length > 0 && (
                <div className="mb-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Sender/Plattform</div>
                  <div className="flex flex-wrap gap-2">
                    {series.networks.map((network: string) => (
                      <span key={network} className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg text-sm font-medium">
                        {network}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {series.genres && series.genres.length > 0 && (
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">Genres</div>
                  <div className="flex flex-wrap gap-2">
                    {(series.genres as any[]).map((genre: any) => (
                      <span key={typeof genre === 'string' ? genre : genre.name} className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg text-sm">
                        {typeof genre === 'string' ? genre : genre.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Cast Preview */}
            {cast.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Besetzung</h3>
                <div className="grid grid-cols-3 gap-3">
                  {cast.slice(0, 6).map((actor: any) => (
                    <div key={actor.id || actor.name} className="text-center">
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mb-2">
                        {actor.profile_path ? (
                          <Image
                            src={`/img/tmdb/w185${actor.profile_path}`}
                            alt={actor.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <Tv className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-gray-900 dark:text-white line-clamp-1">{actor.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}
