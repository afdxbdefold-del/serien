/**
 * Person/Actor Page - V2
 * Route: /person/[id] where id = {tmdb_id}-{slug}
 * Uses enriched DB data (AI bios, cached TV credits, social links)
 * Tiered indexing: only index persons with sufficient content
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getTMDBPersonDetails, getTMDBProfileImageUrl } from '@/lib/tmdb-person';
import { getPersonImageUrl } from '@/lib/image-utils';
import Image from 'next/image';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

function parsePersonId(id: string): number | null {
  const match = id.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : null;
}

function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function calculateAge(birthDate: Date | string | null, deathDate?: Date | string | null): number | null {
  if (!birthDate) return null;
  const birth = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  const end = deathDate ? (typeof deathDate === 'string' ? new Date(deathDate) : deathDate) : new Date();
  let age = end.getFullYear() - birth.getFullYear();
  const m = end.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--;
  return age;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = parsePersonId(id);
  if (!tmdbId) return { title: 'Person nicht gefunden | serien.de', robots: { index: false, follow: false } };

  const dbPerson = await prisma.persons.findUnique({
    where: { tmdbId },
    select: { name: true, biography: true, enrichedAt: true, profilePath: true }
  });

  if (!dbPerson) return { title: 'Person nicht gefunden | serien.de', robots: { index: false, follow: false } };

  const hasContent = dbPerson.biography && dbPerson.biography.length > 100;
  const title = `${dbPerson.name} – Serien, Filme & News | serien.de`;
  const description = dbPerson.biography
    ? `${dbPerson.biography.slice(0, 150)}...`
    : `Alle Serien und Filme mit ${dbPerson.name}. Entdecke die Karriere, News und mehr bei serien.de.`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';

  return {
    title,
    description,
    robots: {
      index: hasContent,
      follow: true,
      ...(hasContent ? { 'max-image-preview': 'large' as const, 'max-snippet': -1, 'max-video-preview': -1 } : {}),
    },
    openGraph: {
      title, description, type: 'profile',
      images: dbPerson.profilePath ? [`https://image.tmdb.org/t/p/w500${dbPerson.profilePath}`] : undefined,
    },
    alternates: { canonical: `${baseUrl}/person/${id}` },
  };
}

export default async function PersonPage({ params }: PageProps) {
  const { id } = await params;
  const tmdbId = parsePersonId(id);
  if (!tmdbId) notFound();

  // Fetch from DB (enriched data) + TMDB API (for poster images of credits)
  const [dbPerson, tmdbPerson] = await Promise.all([
    prisma.persons.findUnique({
      where: { tmdbId },
      select: {
        tmdbId: true, name: true, slug: true, biography: true, biographyEn: true,
        birthDate: true, deathDate: true, birthPlace: true, knownFor: true,
        popularity: true, socialLinks: true, tvCreditsJson: true,
        profilePath: true, localProfilePath: true,
      }
    }),
    getTMDBPersonDetails(tmdbId, true),
  ]);

  if (!dbPerson) notFound();

  const personImageUrl = getPersonImageUrl(
    dbPerson.localProfilePath, tmdbId,
    dbPerson.profilePath || tmdbPerson?.profile_path
  );

  // Bio paragraphs from DB (AI-generated)
  const bioParagraphs = dbPerson.biography
    ? dbPerson.biography.split('\n\n').filter((p: string) => p.trim().length > 0).slice(0, 4)
    : (tmdbPerson?.biography ? tmdbPerson.biography.split('\n\n').filter((p: string) => p.trim().length > 0).slice(0, 4) : []);

  // TV Credits: use DB cache + TMDB poster images
  const tmdbCreditsMap = new Map<number, string>();
  (tmdbPerson?.combined_credits?.cast || []).forEach((c: any) => {
    if (c.poster_path) tmdbCreditsMap.set(c.id, c.poster_path);
  });

  const tvCredits = (dbPerson.tvCreditsJson as any[] || []).map((c: any) => ({
    ...c,
    poster_path: tmdbCreditsMap.get(c.id) || null,
  }));

  // Fallback to TMDB API credits if DB is empty
  const displayCredits = tvCredits.length > 0 ? tvCredits :
    (tmdbPerson?.combined_credits?.cast || [])
      .filter((c: any) => c.media_type === 'tv')
      .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 20)
      .map((c: any) => ({ id: c.id, name: c.name || c.title, character: c.character, episodes: c.episode_count, year: c.first_air_date?.substring(0, 4), poster_path: c.poster_path }));

  // Related articles from DB
  const relatedArticles = await prisma.articles.findMany({
    where: { article_persons: { some: { persons: { tmdbId } } }, status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 6,
    select: { id: true, title: true, slug: true, publishedAt: true, heroImageUrl: true }
  });

  // Characters on our site
  const playedCharacters = await prisma.characters.findMany({
    where: { actorTmdbId: tmdbId, publishStatus: 'published' },
    take: 6,
    select: { id: true, slug: true, name: true, imageUrl: true, series: { select: { tmdbId: true, name: true, title: true, slug: true } } }
  });

  // Series on our site
  const personSeries = await prisma.series.findMany({
    where: { characters: { some: { actorTmdbId: tmdbId } } },
    take: 12,
    select: { tmdbId: true, name: true, title: true, slug: true, posterPath: true, posterLocalUrl: true, voteAverage: true }
  });

  // Social links
  const social = (dbPerson.socialLinks || {}) as Record<string, string>;
  const age = calculateAge(dbPerson.birthDate, dbPerson.deathDate);
  const birthday = tmdbPerson?.birthday || (dbPerson.birthDate ? dbPerson.birthDate.toISOString().substring(0, 10) : null);
  const birthPlace = dbPerson.birthPlace || tmdbPerson?.place_of_birth;
  const deathday = tmdbPerson?.deathday || (dbPerson.deathDate ? dbPerson.deathDate.toISOString().substring(0, 10) : null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* HERO */}
      <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-8 md:py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <Breadcrumb items={[{ label: 'Schauspieler', href: '/personen' }, { label: dbPerson.name }]} className="mb-6 text-gray-400 [&_a]:text-gray-400 [&_a:hover]:text-white [&_svg]:text-gray-500" />
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 md:gap-8">
            <div className="flex-shrink-0">
              <Image src={personImageUrl} alt={dbPerson.name} width={150} height={225}
                className="rounded-lg shadow-2xl w-[120px] h-[180px] sm:w-[150px] sm:h-[225px] md:w-[200px] md:h-[300px] object-cover" priority />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2 md:mb-3">{dbPerson.name}</h1>
              <p className="text-base md:text-xl text-gray-300">
                {dbPerson.knownFor || tmdbPerson?.known_for_department || 'Schauspieler/in'} · bekannt aus Serien
              </p>
              {/* Quick facts pills */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                {birthday && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    * {new Date(birthday).toLocaleDateString('de-DE', { year: 'numeric' })}{age ? ` (${age} Jahre)` : ''}
                  </span>
                )}
                {deathday && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    † {new Date(deathday).toLocaleDateString('de-DE', { year: 'numeric' })}
                  </span>
                )}
                {birthPlace && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm truncate max-w-[250px]">
                    {birthPlace.split(',').slice(0, 2).join(',')}
                  </span>
                )}
              </div>
              {/* Social Links */}
              {Object.keys(social).length > 0 && (
                <div className="flex gap-3 mt-4 justify-center sm:justify-start">
                  {social.instagram && (
                    <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-sm transition" data-testid="social-instagram">
                      Instagram
                    </a>
                  )}
                  {social.twitter && (
                    <a href={`https://x.com/${social.twitter}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-sm transition" data-testid="social-twitter">
                      X / Twitter
                    </a>
                  )}
                  {social.imdb && (
                    <a href={`https://imdb.com/name/${social.imdb}`} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-sm transition" data-testid="social-imdb">
                      IMDb
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content Column */}
          <div className="md:col-span-2 space-y-10 md:space-y-12">
            {/* BIOGRAPHY (AI-generated) */}
            {bioParagraphs.length > 0 && (
              <section data-testid="person-biography">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Wer ist {dbPerson.name}?
                </h2>
                <div className="prose prose-base md:prose-lg max-w-none space-y-4 dark:prose-invert">
                  {bioParagraphs.map((para: string, idx: number) => (
                    <p key={idx} className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">{para}</p>
                  ))}
                </div>
              </section>
            )}

            {/* SERIES ON OUR SITE */}
            {personSeries.length > 0 && (
              <section data-testid="person-series">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Serien mit {dbPerson.name.split(' ')[0]} bei serien.de
                </h2>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 md:gap-4">
                  {personSeries.map((series) => (
                    <Link key={series.tmdbId} href={`/serie/${series.slug}`} className="group">
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md group-hover:shadow-xl transition bg-gray-200 dark:bg-gray-800">
                        {(series.posterLocalUrl || series.posterPath) ? (
                          <Image src={series.posterLocalUrl || `https://image.tmdb.org/t/p/w342${series.posterPath}`}
                            alt={series.name || series.title || ''} fill sizes="(max-width: 640px) 25vw, 150px" className="object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><span className="text-gray-400 text-xs">Kein Bild</span></div>
                        )}
                        {series.voteAverage && Number(series.voteAverage) > 0 && (
                          <div className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {Number(series.voteAverage).toFixed(1)}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 font-semibold text-xs md:text-sm text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-2">
                        {series.name || series.title}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* CHARACTERS PLAYED */}
            {playedCharacters.length > 0 && (
              <section data-testid="person-characters">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  Rollen von {dbPerson.name.split(' ')[0]}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {playedCharacters.map((char) => (
                    <Link key={char.id} href={`/figur/${char.slug}`}
                      className="group bg-white dark:bg-gray-900 rounded-lg p-3 shadow hover:shadow-md transition">
                      <p className="font-semibold text-gray-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-1">{char.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">in {char.series?.name || char.series?.title || 'Serie'}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* FULL FILMOGRAPHY */}
            {displayCredits.length > 0 && (
              <section data-testid="person-filmography">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  TV-Filmografie
                </h2>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow divide-y divide-gray-100 dark:divide-gray-800">
                  {displayCredits.map((credit: any, idx: number) => (
                    <div key={`${credit.id}-${idx}`} className="flex items-center gap-3 p-3 md:p-4">
                      {credit.poster_path ? (
                        <Image src={`https://image.tmdb.org/t/p/w92${credit.poster_path}`}
                          alt={credit.name || ''} width={40} height={60}
                          className="rounded w-[40px] h-[60px] object-cover flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-[40px] h-[60px] rounded bg-gray-200 dark:bg-gray-800 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm dark:text-white line-clamp-1">{credit.name}</p>
                        {credit.character && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">als {credit.character}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {credit.year && <p className="text-xs text-gray-500 dark:text-gray-400">{credit.year}</p>}
                        {credit.episodes && <p className="text-xs text-gray-400">{credit.episodes} Ep.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RELATED NEWS */}
            {relatedArticles.length > 0 && (
              <section data-testid="person-news">
                <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6 dark:text-white">
                  News zu {dbPerson.name.split(' ')[0]}
                </h2>
                <div className="space-y-3 md:space-y-4">
                  {relatedArticles.map(article => (
                    <a key={article.id} href={`/${article.slug}`}
                      className="flex gap-3 md:gap-4 p-3 md:p-4 bg-white dark:bg-gray-900 rounded-lg shadow hover:shadow-md transition">
                      {article.heroImageUrl && (
                        <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded overflow-hidden">
                          <Image src={article.heroImageUrl} alt={article.title} fill sizes="96px" className="object-cover" loading="lazy" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm md:text-lg mb-1 line-clamp-2 dark:text-white">{article.title}</h3>
                        <time className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('de-DE') : ''}
                        </time>
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="md:col-span-1">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-5 md:p-6 sticky top-8">
              <h3 className="font-bold text-lg mb-4 dark:text-white">Steckbrief</h3>
              <dl className="space-y-3 text-sm">
                {birthday && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Geboren</dt>
                    <dd className="font-semibold dark:text-white">{formatDate(birthday)}{age && !deathday ? ` (${age})` : ''}</dd>
                  </div>
                )}
                {deathday && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Gestorben</dt>
                    <dd className="font-semibold dark:text-white">{formatDate(deathday)}{age ? ` (${age} Jahre)` : ''}</dd>
                  </div>
                )}
                {birthPlace && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Geburtsort</dt>
                    <dd className="font-semibold dark:text-white">{birthPlace}</dd>
                  </div>
                )}
                {displayCredits.length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">TV-Rollen</dt>
                    <dd className="font-semibold dark:text-white">{displayCredits.length} Serien</dd>
                  </div>
                )}
                {personSeries.length > 0 && (
                  <div>
                    <dt className="text-gray-500 dark:text-gray-400">Auf serien.de</dt>
                    <dd className="font-semibold dark:text-white">{personSeries.length} Serien</dd>
                  </div>
                )}
              </dl>

              {/* Social Links in Sidebar */}
              {Object.keys(social).length > 0 && (
                <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
                  <dt className="text-gray-500 dark:text-gray-400 text-sm mb-2">Social Media</dt>
                  <div className="flex flex-wrap gap-2">
                    {social.instagram && (
                      <a href={`https://instagram.com/${social.instagram}`} target="_blank" rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs dark:text-white transition">
                        Instagram
                      </a>
                    )}
                    {social.twitter && (
                      <a href={`https://x.com/${social.twitter}`} target="_blank" rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs dark:text-white transition">
                        X
                      </a>
                    )}
                    {social.imdb && (
                      <a href={`https://imdb.com/name/${social.imdb}`} target="_blank" rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs dark:text-white transition">
                        IMDb
                      </a>
                    )}
                    {social.tiktok && (
                      <a href={`https://tiktok.com/@${social.tiktok}`} target="_blank" rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-xs dark:text-white transition">
                        TikTok
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* JSON-LD Person Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: dbPerson.name,
          image: dbPerson.profilePath ? getTMDBProfileImageUrl(dbPerson.profilePath, 'h632') : undefined,
          birthDate: birthday,
          ...(deathday ? { deathDate: deathday } : {}),
          birthPlace: birthPlace ? { '@type': 'Place', name: birthPlace } : undefined,
          jobTitle: dbPerson.knownFor || 'Schauspieler/in',
          description: dbPerson.biography ? dbPerson.biography.substring(0, 200) + '...' : undefined,
          sameAs: [
            `https://www.themoviedb.org/person/${tmdbId}`,
            social.imdb ? `https://www.imdb.com/name/${social.imdb}` : null,
            social.instagram ? `https://www.instagram.com/${social.instagram}` : null,
            social.twitter ? `https://x.com/${social.twitter}` : null,
            social.wikidata ? `https://www.wikidata.org/wiki/${social.wikidata}` : null,
          ].filter(Boolean),
          url: `https://serien.de/person/${id}`,
          mainEntityOfPage: { '@type': 'WebPage', '@id': `https://serien.de/person/${id}` },
        })
      }} />
    </div>
  );
}
