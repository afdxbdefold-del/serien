import Image from 'next/image';
import Link from 'next/link';
import MobileHeroWithVideo from '@/components/MobileHeroWithVideo';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesOverview from '@/components/SeriesOverview';
import { DiscoverIntro, DiscoverStatus, DiscoverNewsContext, MiniQA, StatusContext } from '@/components/DiscoverContent';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeasonsStatus from '@/components/SeasonsStatus';
import RelatedSeries from '@/components/RelatedSeries';
import SeriesQA from '@/components/SeriesQA';
import RatingWithContext from '@/components/RatingWithContext';
import Breadcrumb from '@/components/Breadcrumb';
import SeriesAuthorBox from '@/components/series/SeriesAuthorBox';

interface MobileSeriesLayoutProps {
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

export default function MobileSeriesLayout({
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
}: MobileSeriesLayoutProps) {
  return (
    <section className="lg:hidden container mx-auto px-6 py-8" aria-labelledby="series-hero">
      <Breadcrumb items={[{ label: 'Serien', href: '/trending' }, { label: series.name || series.title }]} className="mb-4" />
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden mb-6">
        <MobileHeroWithVideo
          backdropPath={series.backdropPath}
          posterPath={series.posterPath}
          seriesName={series.name || ''}
          trailerKey={trailers.length > 0 ? trailers[0].key : null}
          localTrailerUrl={localTrailerUrl}
          fallbackHeroUrl={!series.backdropPath ? `/img/hero/${series.tmdbType || 'tv'}/${series.tmdbId}` : undefined}
        />
        
        <div className="pt-6 px-6 pb-6">
          <h1 id="series-hero" className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {series.name}
          </h1>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {series.voteAverage && (
              <RatingWithContext 
                rating={series.voteAverage} 
                voteCount={series.voteCount || undefined}
              />
            )}
            {series.firstAirDate && (
              <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300">
                {new Date(series.firstAirDate).getFullYear()}
              </div>
            )}
            {series.numberOfSeasons && (
              <div className="bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300">
                {series.numberOfSeasons} {series.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}
              </div>
            )}
            {series.status && (
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                series.status === 'Returning Series' || series.status === 'Running'
                  ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
              }`}>
                {series.status === 'Returning Series' ? 'Läuft' : 
                 series.status === 'Ended' ? 'Beendet' : series.status}
              </div>
            )}
          </div>

          {series.overview && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-sm">
              {series.overview}
            </p>
          )}
        </div>
      </div>

      {relevanceContext?.text && (
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl border border-blue-200 dark:border-blue-800 shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <span>Warum relevant</span>
          </h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            {relevanceContext.text}
          </p>
        </section>
      )}

      {series.articles && series.articles.length > 0 && (
        <div className="lg:hidden mb-6">
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md p-5">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">📰</span>
              <span>Aktuelle News zu {series.name || series.title}</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
              Bestätigte Updates, Einordnungen und zentrale Fakten rund um {series.name || series.title}.
            </p>
            <div className="grid grid-cols-1 gap-4">
              {series.articles.slice(0, 4).map((article: any) => {
                const img = article.heroLocalUrl || article.cardImageUrl || article.heroImageUrl;
                return (
                  <Link
                    key={article.slug}
                    href={`/${article.slug}`}
                    className="group block overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-cyan-300 dark:hover:border-cyan-600 hover:shadow-lg transition-all"
                  >
                    <div className="relative aspect-video bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {img ? (
                        <Image
                          src={img}
                          alt={article.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <span className="text-4xl">📰</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors line-clamp-2 mb-1.5">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {article.excerpt}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {article.users?.name && <span className="font-medium">{article.users.name}</span>}
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
        </div>
      )}

      <DiscoverIntro 
        seriesName={series.name || series.title}
        content={series.discoverIntro || series.extendedOverview || series.overview || ''}
        hasExtendedOverview={!!series.extendedOverview}
      />

      <div className="mb-6">
        <WhereToStreamBox 
          seriesId={series.tmdbId}
          seriesName={series.name || ''}
          networks={series.networks as string[] | undefined}
          slug={slug}
        />
      </div>

      <SeriesOverview
        seriesName={series.name || series.title}
        extendedOverview={series.extendedOverview}
        shortOverview={series.overview}
      />

      <div className="mb-6">
        <QuickFactsBox
          originalTitle={series.originalName || series.originalTitle}
          firstAirYear={series.firstAirDate ? new Date(series.firstAirDate).getFullYear() : null}
          creators={(creators || []).map(c => c?.name).filter(Boolean)}
          mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
          platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
          status={series.status}
        />
      </div>

      <div className="mb-6">
        {cast && cast.length > 0 && (
          <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow p-6">
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
      </div>

      {/* Topical Cluster: Characters Section - Links to Character Pages */}
      {characters && characters.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Figuren
            </h2>
            <Link 
              href={`/figuren?serie=${series.tmdbId}`}
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Alle →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {characters.slice(0, 6).map((character: any) => (
              <Link
                key={character.id}
                href={`/figur/${character.slug}`}
                className="group"
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mb-1.5 shadow-sm">
                  {character.imageUrl ? (
                    <Image
                      src={character.imageUrl}
                      alt={character.name}
                      fill
                      sizes="33vw"
                      className="object-cover"
                    />
                  ) : character.persons?.profilePath ? (
                    <Image
                      src={`/img/tmdb/w185${character.persons.profilePath}`}
                      alt={character.name}
                      fill
                      sizes="33vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-white line-clamp-1 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                  {character.name}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6">
        <SeasonsStatus
          seriesName={series.name || series.title}
          seasons={seasons}
          status={series.status}
          numberOfSeasons={series.numberOfSeasons}
        />
        {statusContext && <StatusContext context={statusContext} />}
      </div>

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
    </section>
  );
}
