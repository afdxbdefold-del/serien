import Image from 'next/image';
import Link from 'next/link';
import FollowButtonLocal from '@/components/FollowButtonLocal';
import MobileHeroWithVideo from '@/components/MobileHeroWithVideo';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesOverview from '@/components/SeriesOverview';
import { DiscoverIntro, DiscoverStatus, DiscoverNewsContext, MiniQA, StatusContext } from '@/components/DiscoverContent';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeasonsStatus from '@/components/SeasonsStatus';
import RelatedSeries from '@/components/RelatedSeries';
import SeriesQA from '@/components/SeriesQA';
import RatingWithContext from '@/components/RatingWithContext';

interface MobileSeriesLayoutProps {
  series: any;
  cast: any[];
  creators: any[];
  seasons: any[];
  trailers: any[];
  relevanceContext: any;
  statusContext: any;
  seriesQA: any[];
  slug: string;
  characters: any[];
}

export default function MobileSeriesLayout({
  series,
  cast,
  creators,
  seasons,
  trailers,
  relevanceContext,
  statusContext,
  seriesQA,
  slug,
  characters,
}: MobileSeriesLayoutProps) {
  return (
    <section className="lg:hidden container mx-auto px-6 py-8" aria-labelledby="series-hero">
      <h1 id="series-hero" className="sr-only">{series.name}</h1>
      <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-6">
        <MobileHeroWithVideo
          backdropPath={series.backdropPath}
          posterPath={series.posterPath}
          seriesName={series.name || ''}
          trailerKey={trailers.length > 0 ? trailers[0].key : null}
        />
        
        <div className="pt-6 px-6 pb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
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

      {relevanceContext?.text && (
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-md p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <span>Warum relevant</span>
          </h2>
          <p className="text-gray-700 leading-relaxed">
            {relevanceContext.text}
          </p>
        </section>
      )}

      {series.articles && series.articles.length > 0 && (
        <div className="lg:hidden mb-6">
          <section className="bg-white rounded-xl border border-gray-200 shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📰</span>
              <span>Aktuelle News zu {series.name || series.title}</span>
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              In diesem Bereich werden relevante Meldungen und neue Entwicklungen rund um {series.name || series.title} gebündelt. 
              Dazu zählen bestätigte Updates zur Serie, Einordnungen zu Veröffentlichungen sowie zentrale Fakten, sobald sie offiziell vorliegen.
            </p>
            <div className="space-y-4">
              {series.articles.slice(0, 3).map((article: any) => (
                <Link
                  key={article.slug}
                  href={`/${article.slug}`}
                  className="block group"
                >
                  <div className="border border-gray-100 rounded-lg p-4 hover:border-cyan-300 hover:bg-cyan-50/30 transition-all">
                    {article.cardImageUrl && (
                      <div className="relative h-40 mb-3 rounded-lg overflow-hidden bg-gray-100">
                        <Image
                          src={article.cardImageUrl}
                          alt={article.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors line-clamp-2 mb-2">
                      {article.title}
                    </h3>
                    {article.excerpt && (
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {article.excerpt}
                      </p>
                    )}
                    {article.publishedAt && (
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {article.users?.name && (
                          <span>{article.users.name}</span>
                        )}
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString('de-DE', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
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
          creators={creators.map(c => c.name)}
          mainGenre={series.genres && series.genres.length > 0 ? series.genres[0] : null}
          platform={series.networks && series.networks.length > 0 ? series.networks[0] : null}
          status={series.status}
        />
      </div>

      <div className="mb-6">
        {cast && cast.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
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
      </div>

      <div className="mb-6">
        {characters && characters.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Fiktive Charaktere aus {series.name || series.title}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {characters.map((character: any) => (
                <Link
                  key={character.slug}
                  href={`/figur/${character.slug}`}
                  className="group"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-100 mb-2 shadow-sm">
                    {character.imageUrl ? (
                      <Image
                        src={character.imageUrl}
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
                    <p className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {character.name}
                    </p>
                    {character.actor && (
                      <p className="text-xs text-gray-600 line-clamp-1 mt-1">
                        gespielt von {character.actor.name}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

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
    </section>
  );
}
