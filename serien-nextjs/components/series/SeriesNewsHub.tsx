import Link from 'next/link';
import Image from 'next/image';

type Article = {
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  heroLocalUrl?: string | null;
  heroImageUrl?: string | null;
  cardImageUrl?: string | null;
  users?: { name?: string | null; image?: string | null } | null;
};

interface Props {
  seriesName: string;
  tmdbId: number;
  tmdbType: string | null;
  primaryNetwork: string | null;
  status: string | null;
  startYear?: number;
  endYear?: number;
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  genres: string[];
  voteAverage?: number | null;
  articles: Article[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function statusLabel(s: string | null): string {
  if (!s) return '—';
  const map: Record<string, string> = {
    'Returning Series': 'Laufend',
    'Ended': 'Beendet',
    'Canceled': 'Abgesetzt',
    'In Production': 'In Produktion',
    'Planned': 'Geplant',
    'Pilot': 'Pilot',
  };
  return map[s] || s;
}

export default function SeriesNewsHub({
  seriesName,
  tmdbId,
  tmdbType,
  primaryNetwork,
  status,
  startYear,
  endYear,
  numberOfSeasons,
  numberOfEpisodes,
  genres,
  voteAverage,
  articles,
}: Props) {
  const yearLine =
    startYear && endYear && endYear !== startYear
      ? `${startYear}–${endYear}`
      : startYear
      ? String(startYear)
      : '—';

  return (
    <div className="container mx-auto px-4 md:px-6 py-6 max-w-3xl lg:max-w-[1000px]">
      {/* Headline */}
      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
          {seriesName}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Alle News zur Serie
        </p>
      </header>

      {/* Info-Box (kompakt) */}
      <section
        aria-label="Serien-Info"
        className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1d24] p-4 md:p-5 mb-8"
        data-testid="series-infobox"
      >
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Anbieter</dt>
            <dd className="text-gray-900 dark:text-white font-medium mt-0.5">
              {primaryNetwork || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Status</dt>
            <dd className="text-gray-900 dark:text-white font-medium mt-0.5">
              {statusLabel(status)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Laufzeit</dt>
            <dd className="text-gray-900 dark:text-white font-medium mt-0.5">{yearLine}</dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Staffeln</dt>
            <dd className="text-gray-900 dark:text-white font-medium mt-0.5">
              {numberOfSeasons ?? '—'}
              {numberOfEpisodes ? (
                <span className="text-gray-500 dark:text-gray-400 font-normal">
                  {' '}· {numberOfEpisodes} Folgen
                </span>
              ) : null}
            </dd>
          </div>
          {genres.length > 0 && (
            <div className="col-span-2 md:col-span-4">
              <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Genre</dt>
              <dd className="text-gray-900 dark:text-white font-medium mt-0.5">
                {genres.slice(0, 4).join(', ')}
              </dd>
            </div>
          )}
          {voteAverage && voteAverage > 0 && (
            <div>
              <dt className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">TMDB</dt>
              <dd className="text-gray-900 dark:text-white font-medium mt-0.5">
                {voteAverage.toFixed(1)} / 10
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* News-Feed */}
      <section aria-label="News zur Serie" data-testid="series-news-feed">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          News zu {seriesName}
        </h2>

        {articles.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1d24] p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
            Zu dieser Serie sind aktuell keine News verfügbar.
          </div>
        ) : (
          <ul className="space-y-4">
            {articles.map((a) => {
              const img = a.heroLocalUrl || a.heroImageUrl || a.cardImageUrl || null;
              return (
                <li
                  key={a.slug}
                  className="group rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1d24] overflow-hidden transition-colors hover:border-cyan-500/40"
                >
                  <Link
                    href={`/${a.slug}`}
                    className="flex flex-col sm:flex-row gap-0 sm:gap-4"
                    data-testid={`news-item-${a.slug}`}
                  >
                    {img && (
                      <div className="relative w-full sm:w-48 aspect-video sm:aspect-[16/10] sm:h-auto shrink-0 bg-gray-100 dark:bg-gray-800">
                        <Image
                          src={img}
                          alt={a.title}
                          fill
                          sizes="(max-width: 640px) 100vw, 192px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 p-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors">
                        {a.title}
                      </h3>
                      {a.excerpt && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {a.excerpt}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                        {a.users?.name && <span>{a.users.name}</span>}
                        {a.users?.name && a.publishedAt && <span>·</span>}
                        {a.publishedAt && <time dateTime={a.publishedAt}>{formatDate(a.publishedAt)}</time>}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* SEO-Kontext: TMDB-Link bewusst weggelassen (kein Outbound zu Content-Mirror).
          Referenz Backend-DB via tmdbId + tmdbType wird über generateMetadata ausgeliefert. */}
      <div className="sr-only" aria-hidden="true">
        Serie <span>{seriesName}</span> — TMDB-Referenz <span>{tmdbType}/{tmdbId}</span>
      </div>
    </div>
  );
}
