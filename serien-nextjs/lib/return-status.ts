/**
 * "Wann geht es weiter?" — Evergreen-Status-Resolver
 *
 * Aggregates everything we know about whether a series will return,
 * is over, in production, etc. Pulls from:
 *   • series.status (TMDB-status)
 *   • series.tmdbData.next_episode_to_air (concrete air date when known)
 *   • series.tmdbData.last_episode_to_air
 *   • series.tmdbData.in_production
 *   • series.lastAirDate, numberOfSeasons, lastSeasonNumber
 *
 * Output is purpose-built for the /serie/[slug]/wann-geht-es-weiter page:
 * a single discriminated-union object that the page component renders.
 */
export type ReturnStatusKind =
  | 'RETURNING_WITH_DATE'   // Returning + next_episode_to_air present
  | 'RETURNING_NO_DATE'     // Returning / In Production / Planned without date
  | 'ENDED'                 // Ended / Canceled
  | 'STALE_LIKELY_ENDED'    // status null + lastAirDate older than 2 years
  | 'UNKNOWN';

export interface ReturnStatus {
  kind: ReturnStatusKind;
  // Human-readable headline ("Staffel 23, Folge 11 startet am …")
  headline: string;
  // Short paragraph (≈ 1-2 sentences) explaining the status — used in lead.
  lead: string;
  // Concrete next episode info if we have it
  nextEpisode?: {
    airDate: string;          // ISO YYYY-MM-DD
    airDateLabel: string;     // "Mittwoch, 12. März 2026"
    daysUntil: number;        // negative if past
    seasonNumber: number;
    episodeNumber: number;
    name?: string;
  };
  lastEpisode?: {
    airDate: string;
    airDateLabel: string;
    seasonNumber: number;
    episodeNumber: number;
    name?: string;
  };
  numberOfSeasons?: number;
  lastSeasonNumber?: number;
  inProduction: boolean;
  rawStatus?: string;
  // When we last refreshed the underlying TMDB row (used for "Stand vom …")
  updatedAt: Date;
}

interface TmdbEpisode {
  air_date?: string | null;
  episode_number?: number;
  season_number?: number;
  name?: string | null;
}

interface SeriesInput {
  status?: string | null;
  inProduction?: boolean | null;
  numberOfSeasons?: number | null;
  lastSeasonNumber?: number | null;
  lastAirDate?: Date | null;
  updatedAt: Date;
  name?: string | null;
  title?: string;
  tmdbData?: unknown;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function formatDe(d: Date): string {
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  });
}

function daysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00Z').getTime();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / DAY_MS);
}

export function resolveReturnStatus(s: SeriesInput): ReturnStatus {
  const seriesName = s.name || s.title || 'Diese Serie';
  const td = (s.tmdbData ?? {}) as { next_episode_to_air?: TmdbEpisode | null; last_episode_to_air?: TmdbEpisode | null };
  const next = td.next_episode_to_air;
  const last = td.last_episode_to_air;

  const lastEpisode = last?.air_date
    ? {
        airDate: last.air_date,
        airDateLabel: formatDe(new Date(last.air_date + 'T00:00:00Z')),
        seasonNumber: last.season_number ?? 0,
        episodeNumber: last.episode_number ?? 0,
        name: last.name || undefined,
      }
    : undefined;

  const baseSeasons = s.numberOfSeasons ?? undefined;
  const baseLastSeason = s.lastSeasonNumber ?? undefined;
  const inProduction = !!s.inProduction;

  // 1) Concrete next-episode date wins everything else.
  if (next?.air_date) {
    const days = daysUntil(next.air_date);
    const seasonNum = next.season_number ?? 0;
    const episodeNum = next.episode_number ?? 0;
    const dateLabel = formatDe(new Date(next.air_date + 'T00:00:00Z'));
    const headline =
      days <= 0
        ? `Staffel ${seasonNum}, Folge ${episodeNum} läuft seit dem ${dateLabel}.`
        : days === 1
          ? `Staffel ${seasonNum}, Folge ${episodeNum} startet morgen, ${dateLabel}.`
          : days <= 7
            ? `Staffel ${seasonNum}, Folge ${episodeNum} startet in ${days} Tagen am ${dateLabel}.`
            : `Staffel ${seasonNum}, Folge ${episodeNum} startet am ${dateLabel}.`;
    const lead =
      days <= 0
        ? `Die nächste Episode von ${seriesName} ist bereits seit ${dateLabel} verfügbar — Staffel ${seasonNum}, Folge ${episodeNum}${next.name ? ` ("${next.name}")` : ''}.`
        : `${seriesName} läuft weiter: Staffel ${seasonNum} setzt mit Folge ${episodeNum}${next.name ? ` ("${next.name}")` : ''} fort. Konkretes Datum laut TMDB: ${dateLabel} — also in ${days} Tag${days === 1 ? '' : 'en'}.`;
    return {
      kind: 'RETURNING_WITH_DATE',
      headline,
      lead,
      nextEpisode: { airDate: next.air_date, airDateLabel: dateLabel, daysUntil: days, seasonNumber: seasonNum, episodeNumber: episodeNum, name: next.name || undefined },
      lastEpisode,
      numberOfSeasons: baseSeasons,
      lastSeasonNumber: baseLastSeason,
      inProduction,
      rawStatus: s.status || undefined,
      updatedAt: s.updatedAt,
    };
  }

  // 2) Returning / In Production / Planned without concrete date
  const returningStatuses = new Set(['Returning Series', 'In Production', 'Planned', 'Pilot']);
  if (s.status && returningStatuses.has(s.status)) {
    const nextSeasonNum = baseSeasons ? baseSeasons + 1 : undefined;
    const lastSeasonHint = baseSeasons ? ` (zuletzt Staffel ${baseSeasons})` : '';
    const headline = nextSeasonNum
      ? `Staffel ${nextSeasonNum} ist offiziell ${s.status === 'Planned' ? 'geplant' : 'in Produktion'} — Termin noch offen.`
      : `Neue Folgen sind ${s.status === 'Planned' ? 'geplant' : 'in Produktion'} — Termin noch offen.`;
    const lead = `${seriesName} läuft weiter${lastSeasonHint}, aber TMDB hat noch keinen bestätigten Starttermin für die nächste Staffel. Sobald ein Datum auftaucht, aktualisieren wir diese Seite automatisch.`;
    return {
      kind: 'RETURNING_NO_DATE',
      headline,
      lead,
      lastEpisode,
      numberOfSeasons: baseSeasons,
      lastSeasonNumber: baseLastSeason,
      inProduction,
      rawStatus: s.status,
      updatedAt: s.updatedAt,
    };
  }

  // 3) Officially ended / canceled
  if (s.status === 'Ended' || s.status === 'Canceled') {
    const verb = s.status === 'Canceled' ? 'wurde abgesetzt' : 'ist abgeschlossen';
    const lastAirLabel = s.lastAirDate ? formatDe(s.lastAirDate) : null;
    const seasonsHint = baseSeasons ? ` nach ${baseSeasons} Staffel${baseSeasons === 1 ? '' : 'n'}` : '';
    const headline = `${seriesName} ${verb}${seasonsHint}.`;
    const lead = lastAirLabel
      ? `Die letzte Folge lief am ${lastAirLabel}${lastEpisode?.seasonNumber ? ` (Staffel ${lastEpisode.seasonNumber}, Folge ${lastEpisode.episodeNumber})` : ''}. Eine Fortsetzung ist laut TMDB nicht geplant.`
      : `Eine Fortsetzung ist laut TMDB nicht geplant.`;
    return {
      kind: 'ENDED',
      headline,
      lead,
      lastEpisode,
      numberOfSeasons: baseSeasons,
      lastSeasonNumber: baseLastSeason,
      inProduction,
      rawStatus: s.status,
      updatedAt: s.updatedAt,
    };
  }

  // 4) Unknown status but very old lastAirDate → likely ended
  if (s.lastAirDate) {
    const ageMs = Date.now() - s.lastAirDate.getTime();
    if (ageMs > 2 * 365 * DAY_MS) {
      const lastLabel = formatDe(s.lastAirDate);
      return {
        kind: 'STALE_LIKELY_ENDED',
        headline: `${seriesName} wurde seit ${lastLabel} nicht mehr verlängert.`,
        lead: `Die letzten Folgen liefen am ${lastLabel}. Offiziell ist die Serie nicht beendet, aber seit über zwei Jahren gibt es keine neuen Episoden — eine Rückkehr gilt als unwahrscheinlich.`,
        lastEpisode,
        numberOfSeasons: baseSeasons,
        lastSeasonNumber: baseLastSeason,
        inProduction,
        rawStatus: s.status || undefined,
        updatedAt: s.updatedAt,
      };
    }
  }

  // 5) Fallback
  return {
    kind: 'UNKNOWN',
    headline: `Aktueller Status von ${seriesName} ist unklar.`,
    lead: `Aktuell liegen uns keine offiziellen Informationen zu einer Fortsetzung vor. Wir aktualisieren diese Seite automatisch, sobald TMDB neue Daten meldet.`,
    lastEpisode,
    numberOfSeasons: baseSeasons,
    lastSeasonNumber: baseLastSeason,
    inProduction,
    rawStatus: s.status || undefined,
    updatedAt: s.updatedAt,
  };
}
