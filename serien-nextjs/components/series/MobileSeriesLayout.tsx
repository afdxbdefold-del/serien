import Image from 'next/image';
import Link from 'next/link';
import FollowButtonLocal from '@/components/FollowButtonLocal';
import MobileHeroWithVideo from '@/components/MobileHeroWithVideo';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import SeriesOverview from '@/components/SeriesOverview';
import { DiscoverIntro, DiscoverStatus, DiscoverNewsContext, MiniQA, StatusContext } from '@/components/DiscoverContent';
import QuickFactsBox from '@/components/QuickFactsBox';
import SeriesCast from '@/components/SeriesCast';
import SeriesCharacters from '@/components/SeriesCharacters';
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

      {relevanceContext && (
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
        <SeriesCast 
          seriesName={series.name || series.title}
          cast={cast}
        />
      </div>

      <div className="mb-6">
        <SeriesCharacters 
          seriesTmdbId={series.tmdbId}
          seriesName={series.name || series.title}
        />
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
