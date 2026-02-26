import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, Film, Star, Play } from 'lucide-react';
import FollowButton from '@/components/FollowButton';
import { SeriesStatusBox } from '@/components/SeriesStatusBox';
import { SeriesHubArticles } from '@/components/SeriesHubArticles';

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
        take: 6,
        select: {
          slug: true,
          title: true,
          excerpt: true,
          publishedAt: true,
          heroImageUrl: true,
          author: {
            select: { name: true }
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
  const seasons = (series.seasons as any[]) || [];
  const trailers = (series.trailers as any[]) || [];
  const keywords = (series.keywords as string[]) || [];

  // Get creator/showrunner from crew
  const creators = crew.filter(c => c.job === 'Creator' || c.job === 'Executive Producer').slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section with Backdrop */}
      <div className="relative h-96 bg-gradient-to-b from-black to-gray-900">
        {series.backdropPath && (
          <Image
            src={`https://image.tmdb.org/t/p/original${series.backdropPath}`}
            alt={series.name || ''}
            fill
            className="object-cover opacity-40"
            priority
          />
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-gray-50 via-transparent to-transparent" />
        
        <div className="relative container mx-auto px-6 h-full flex items-end pb-12">
          <div className="flex gap-8 items-end">
            {/* Poster */}
            {series.posterPath && (
              <div className="hidden md:block flex-shrink-0">
                <Image
                  src={`https://image.tmdb.org/t/p/w500${series.posterPath}`}
                  alt={series.name || ''}
                  width={200}
                  height={300}
                  className="rounded-xl shadow-2xl border-4 border-white"
                />
              </div>
            )}
            
            {/* Title & Meta */}
            <div className="text-white pb-4">
              <h1 className="text-4xl md:text-6xl font-bold mb-4">
                {series.name}
              </h1>
              
              {series.tagline && (
                <p className="text-xl text-gray-300 italic mb-4">
                  "{series.tagline}"
                </p>
              )}
              
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
