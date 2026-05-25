/**
 * /serie/[slug]/wann-geht-es-weiter
 *
 * Evergreen-Page: "Wann geht [Serie] weiter?"
 *
 * Pulls everything we know from `series` (incl. tmdbData.next_episode_to_air)
 * and renders a structured answer. ISR-cached for 1h; the dedicated cron
 * `/api/cron/backfill-streaming-series` and the existing TMDB sync keep
 * `series.tmdbData` fresh so this page auto-updates with no manual work.
 */
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, Tv, CheckCircle2, AlertCircle, HelpCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import prisma from '@/lib/prisma';
import { resolveReturnStatus } from '@/lib/return-status';
import { generateBreadcrumbSchema } from '@/lib/schema-generator';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 3600; // 1h ISR

async function getSeries(slug: string) {
  // Numeric slug fallback (older TMDB-only seeds).
  const numericId = /^\d+$/.test(slug) ? parseInt(slug, 10) : NaN;
  if (!Number.isNaN(numericId) && numericId > 1000) {
    const byId = await prisma.series.findUnique({
      where: { tmdbId: numericId },
      select: SERIES_SELECT,
    });
    if (byId) return byId;
  }
  return prisma.series.findFirst({
    where: { slug },
    select: SERIES_SELECT,
  });
}

const SERIES_SELECT = {
  tmdbId: true,
  slug: true,
  title: true,
  name: true,
  overview: true,
  posterPath: true,
  posterLocalUrl: true,
  backdropPath: true,
  backdropLocalUrl: true,
  status: true,
  inProduction: true,
  lastAirDate: true,
  firstAirDate: true,
  numberOfSeasons: true,
  lastSeasonNumber: true,
  networks: true,
  tmdbData: true,
  updatedAt: true,
  articles: {
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' as const },
    take: 3,
    select: { slug: true, title: true, excerpt: true, publishedAt: true, heroLocalUrl: true, heroImagePath: true },
  },
} as const;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) return { title: 'Serie nicht gefunden | serien.de' };

  const displayName = series.name || series.title;
  const status = resolveReturnStatus(series);
  const titleSuffix = status.kind === 'RETURNING_WITH_DATE' && status.nextEpisode
    ? `Staffel ${status.nextEpisode.seasonNumber} ab ${status.nextEpisode.airDateLabel.split(',').slice(1).join(',').trim()}`
    : status.kind === 'ENDED'
      ? 'Status, Ende & letzte Staffel'
      : 'Aktueller Status & nächste Staffel';

  const title = `Wann geht ${displayName} weiter? ${titleSuffix} | serien.de`;
  const description = status.lead.length > 155 ? status.lead.slice(0, 152) + '…' : status.lead;
  const canonical = `https://serien.de/serie/${series.slug}/wann-geht-es-weiter`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
      siteName: 'serien.de',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

const KIND_BADGE: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  RETURNING_WITH_DATE: { label: 'Neue Folge bestätigt', icon: CheckCircle2, color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  RETURNING_NO_DATE:   { label: 'Geht weiter — kein Datum',  icon: Clock,         color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  ENDED:               { label: 'Beendet',                   icon: AlertCircle,   color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  STALE_LIKELY_ENDED:  { label: 'Wahrscheinlich beendet',    icon: AlertCircle,   color: 'bg-rose-500/10 text-rose-200 border-rose-500/20' },
  UNKNOWN:             { label: 'Status unklar',             icon: HelpCircle,    color: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
};

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const series = await getSeries(slug);
  if (!series) notFound();

  const displayName = series.name || series.title;
  const status = resolveReturnStatus(series);
  const badge = KIND_BADGE[status.kind];
  const BadgeIcon = badge.icon;

  const heroImage = series.backdropLocalUrl
    || (series.backdropPath ? `https://image.tmdb.org/t/p/original${series.backdropPath}` : null);
  const posterImage = series.posterLocalUrl
    || (series.posterPath ? `https://image.tmdb.org/t/p/w500${series.posterPath}` : null);

  const breadcrumb = generateBreadcrumbSchema([
    { name: 'Start', url: '/' },
    { name: displayName, url: `/serie/${series.slug}` },
    { name: 'Wann geht es weiter', url: `/serie/${series.slug}/wann-geht-es-weiter` },
  ]);

  const stand = status.updatedAt.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <main className="min-h-screen bg-slate-950 text-white" data-testid="wgew-page">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-white/5">
          {heroImage && (
            <div className="absolute inset-0">
              <Image src={heroImage} alt="" fill className="object-cover opacity-30" priority sizes="100vw" />
              <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/70 to-slate-950" />
            </div>
          )}
          <div className="relative mx-auto max-w-5xl px-4 py-12 sm:py-16">
            <Link
              href={`/serie/${series.slug}`}
              className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition"
              data-testid="wgew-back-link"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück zu {displayName}
            </Link>

            <div className="mt-6 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badge.color}`} data-testid="wgew-status-badge">
                <BadgeIcon className="h-3.5 w-3.5" />
                {badge.label}
              </span>
              <span className="text-xs text-white/40">Stand: {stand}</span>
            </div>

            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
              Wann geht <span className="text-amber-300">{displayName}</span> weiter?
            </h1>

            <p className="mt-4 text-lg sm:text-xl text-white/85 max-w-3xl" data-testid="wgew-headline">
              {status.headline}
            </p>
          </div>
        </section>

        {/* Body */}
        <section className="mx-auto max-w-5xl px-4 py-10 sm:py-14 grid gap-10 lg:grid-cols-[1fr_280px]">
          <article className="space-y-8">
            {/* Lead */}
            <div>
              <p className="text-lg leading-relaxed text-white/80" data-testid="wgew-lead">{status.lead}</p>
            </div>

            {/* Concrete next-episode card */}
            {status.nextEpisode && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6" data-testid="wgew-next-episode">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-300 text-sm font-medium">
                      <Calendar className="h-4 w-4" />
                      Nächste Folge
                    </div>
                    <div className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
                      Staffel {status.nextEpisode.seasonNumber} · Folge {status.nextEpisode.episodeNumber}
                    </div>
                    {status.nextEpisode.name && (
                      <div className="mt-1 text-white/70">„{status.nextEpisode.name}"</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-3xl sm:text-4xl font-bold text-emerald-300 tabular-nums">
                      {status.nextEpisode.daysUntil <= 0 ? 'läuft' : status.nextEpisode.daysUntil === 1 ? 'morgen' : `${status.nextEpisode.daysUntil}`}
                    </div>
                    {status.nextEpisode.daysUntil > 1 && (
                      <div className="text-xs text-white/50 uppercase tracking-wider">Tage</div>
                    )}
                  </div>
                </div>
                <div className="mt-4 text-sm text-white/60">{status.nextEpisode.airDateLabel}</div>
              </div>
            )}

            {/* Last-episode card */}
            {status.lastEpisode && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6" data-testid="wgew-last-episode">
                <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
                  <Tv className="h-4 w-4" />
                  Letzte ausgestrahlte Folge
                </div>
                <div className="mt-2 text-xl font-semibold">
                  Staffel {status.lastEpisode.seasonNumber} · Folge {status.lastEpisode.episodeNumber}
                  {status.lastEpisode.name && <span className="text-white/60 font-normal"> · „{status.lastEpisode.name}"</span>}
                </div>
                <div className="mt-1 text-sm text-white/50">{status.lastEpisode.airDateLabel}</div>
              </div>
            )}

            {/* Series facts */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold mb-4">Fakten zur Serie</h2>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                {status.numberOfSeasons != null && (
                  <div>
                    <dt className="text-white/50">Bisher Staffeln</dt>
                    <dd className="text-white text-lg font-semibold">{status.numberOfSeasons}</dd>
                  </div>
                )}
                {status.rawStatus && (
                  <div>
                    <dt className="text-white/50">TMDB-Status</dt>
                    <dd className="text-white text-lg font-semibold">{translateStatus(status.rawStatus)}</dd>
                  </div>
                )}
                {status.inProduction && (
                  <div>
                    <dt className="text-white/50">Produktion</dt>
                    <dd className="text-emerald-300 text-lg font-semibold">Aktiv</dd>
                  </div>
                )}
                {series.networks && series.networks.length > 0 && (
                  <div className="col-span-2">
                    <dt className="text-white/50">Senderkette / Streamer</dt>
                    <dd className="text-white">{series.networks.slice(0, 4).join(', ')}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Latest articles */}
            {series.articles && series.articles.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Aktuelle News zu {displayName}</h2>
                <div className="space-y-3">
                  {series.articles.map((a) => (
                    <Link
                      key={a.slug}
                      href={`/${a.slug}`}
                      className="block rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
                      data-testid={`wgew-article-${a.slug}`}
                    >
                      <div className="font-medium text-white group-hover:text-amber-300">{a.title}</div>
                      {a.excerpt && (
                        <p className="mt-1 text-sm text-white/60 line-clamp-2">{a.excerpt}</p>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1 text-xs text-amber-300">
                        Artikel lesen <ExternalLink className="h-3 w-3" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {posterImage && (
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <Image
                  src={posterImage}
                  alt={`Poster von ${displayName}`}
                  width={500}
                  height={750}
                  className="w-full h-auto"
                  sizes="(max-width: 1024px) 100vw, 280px"
                  data-testid="wgew-poster"
                />
              </div>
            )}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-sm font-medium text-white/60 mb-2">Auf Auto-Pilot</h3>
              <p className="text-sm text-white/80">
                Diese Seite wird automatisch aktualisiert, sobald TMDB ein neues Startdatum oder einen Status-Wechsel meldet — meist innerhalb von 24 Stunden.
              </p>
            </div>
          </aside>
        </section>
      </main>
    </>
  );
}

function translateStatus(s: string): string {
  switch (s) {
    case 'Returning Series': return 'Wird fortgesetzt';
    case 'Ended': return 'Beendet';
    case 'Canceled': return 'Abgesetzt';
    case 'In Production': return 'In Produktion';
    case 'Planned': return 'Geplant';
    case 'Pilot': return 'Pilot';
    default: return s;
  }
}
