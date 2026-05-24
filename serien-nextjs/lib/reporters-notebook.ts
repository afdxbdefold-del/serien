/**
 * Reporter's Notebook — E-E-A-T Experience Signal
 *
 * Generates a short, deterministic, fact-based "Aus der Redaktion"-block at
 * the bottom of each article that demonstrates real research:
 *   - Live TMDB status (Returning Series / Ended / In Production)
 *   - Last/next episode dates
 *   - German streamer availability (TMDB Watch Providers DE)
 *   - Series age / seasons count
 *
 * This is NOT another LLM hallucination layer. Every sentence is generated
 * from a verifiable TMDB field. The block shows Google + readers that the
 * article was researched on a specific date with real source data.
 *
 * Output is appended to `contentHtml` inside a clearly marked <aside>, so
 * subsequent pipeline runs can replace the block without breaking the rest
 * of the body.
 */

import { getTVWatchProviders, getProviderDisplayName } from './tmdb-watch-providers';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const NOTEBOOK_OPEN_RE = /<aside[^>]*data-reporters-notebook[^>]*>[\s\S]*?<\/aside>\s*$/i;

const DE_DATE = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});

const DE_SHORT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
});

interface TmdbFacts {
  name: string;
  status: string | null;          // "Returning Series" | "Ended" | "Canceled" | "In Production" | "Pilot"
  inProduction: boolean;
  firstAirDate: string | null;     // "2024-01-15"
  lastAirDate: string | null;
  nextEpisodeDate: string | null;
  nextEpisodeName: string | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  originalLanguage: string | null;
}

interface ProviderFacts {
  flatrate: string[];               // de-localised names ("Netflix", "Disney+")
  freeWithAds: string[];
  rentBuy: string[];
}

/**
 * Fetch the minimal TMDB payload we need. Single request thanks to TMDB's
 * append_to_response. Cached for 24h via Next.js revalidate.
 */
async function fetchSeriesFacts(tmdbId: number): Promise<TmdbFacts | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${apiKey}&language=de-DE`;
    const r = await fetch(url, { next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const data = await r.json();

    return {
      name: data.name || data.original_name,
      status: data.status ?? null,
      inProduction: Boolean(data.in_production),
      firstAirDate: data.first_air_date || null,
      lastAirDate: data.last_air_date || null,
      nextEpisodeDate: data.next_episode_to_air?.air_date || null,
      nextEpisodeName: data.next_episode_to_air?.name || null,
      numberOfSeasons: data.number_of_seasons ?? null,
      numberOfEpisodes: data.number_of_episodes ?? null,
      originalLanguage: data.original_language ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchProviderFacts(tmdbId: number): Promise<ProviderFacts> {
  const empty: ProviderFacts = { flatrate: [], freeWithAds: [], rentBuy: [] };
  try {
    const p = await getTVWatchProviders(tmdbId);
    if (!p) return empty;

    const norm = (list?: { provider_name: string }[]) =>
      (list || [])
        .map((x) => getProviderDisplayName(x.provider_name))
        // Drop "Channel"-style virtual providers (Amazon Prime Video with Ads
        // sub-channels etc.) by deduping case-insensitively
        .filter((v, i, arr) => arr.findIndex((y) => y.toLowerCase() === v.toLowerCase()) === i);

    return {
      flatrate: norm(p.flatrate),
      freeWithAds: norm(p.ads),
      rentBuy: [...norm(p.rent), ...norm(p.buy)].filter(
        (v, i, arr) => arr.findIndex((y) => y.toLowerCase() === v.toLowerCase()) === i
      ),
    };
  } catch {
    return empty;
  }
}

/**
 * Human-friendly German status label.
 */
function statusLabel(status: string | null, inProduction: boolean): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === 'returning series') return 'laufend';
  if (s === 'ended') return 'abgeschlossen';
  if (s === 'canceled' || s === 'cancelled') return 'abgesetzt';
  if (s === 'in production') return 'in Produktion';
  if (s === 'pilot') return 'Pilotfolge';
  if (s === 'planned') return 'geplant';
  return inProduction ? 'in Produktion' : status;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return DE_DATE.format(d);
}

function fmtDateLong(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return DE_SHORT.format(d);
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * Build 2-3 short, factual German sentences from the raw data.
 *
 * Style rules:
 *   - No marketing language, no "Spannend ist…"
 *   - Numbers and dates always concrete
 *   - Short sentences (≤14 words) for stylistic burstiness contrast
 *   - Always carry a "Datenstand"-footer for transparency
 */
function buildNotebookSentences(facts: TmdbFacts, providers: ProviderFacts, today: Date): string[] {
  const out: string[] = [];

  // Sentence 1 — Status + Produktion
  const sLabel = statusLabel(facts.status, facts.inProduction);
  if (sLabel) {
    if (facts.numberOfSeasons && facts.numberOfSeasons > 0) {
      out.push(
        `TMDB-Sync: Serienstatus \u201E${sLabel}\u201C bei aktuell ${facts.numberOfSeasons} ${facts.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}` +
          (facts.numberOfEpisodes ? ` und ${facts.numberOfEpisodes} Episoden insgesamt.` : '.')
      );
    } else {
      out.push(`TMDB-Sync: Serienstatus \u201E${sLabel}\u201C.`);
    }
  }

  // Sentence 2 — Letzte/Nächste Folge
  const lastDate = fmtDateLong(facts.lastAirDate);
  const nextDate = fmtDateLong(facts.nextEpisodeDate);
  if (nextDate) {
    out.push(`Nächste Episode laut TMDB: ${nextDate}.`);
  } else if (lastDate && facts.lastAirDate) {
    const days = daysBetween(today, new Date(facts.lastAirDate));
    if (days >= 0 && days < 3650) {
      if (days < 30) {
        out.push(`Letzte ausgestrahlte Folge: ${lastDate} — noch kein neuer Sendetermin in der TMDB-Datenbank hinterlegt.`);
      } else {
        out.push(`Letzte ausgestrahlte Folge: ${lastDate}. Aktuell ist kein Folgetermin eingetragen.`);
      }
    }
  }

  // Sentence 3 — Streamer-Verfügbarkeit in DE
  if (providers.flatrate.length > 0) {
    const list = providers.flatrate.slice(0, 4);
    if (list.length === 1) {
      out.push(`Streamer-Check Deutschland: aktuell im Flatrate-Abo bei ${list[0]}.`);
    } else {
      const last = list.pop()!;
      out.push(`Streamer-Check Deutschland: aktuell im Flatrate-Abo bei ${list.join(', ')} und ${last}.`);
    }
  } else if (providers.freeWithAds.length > 0) {
    out.push(`Streamer-Check Deutschland: kostenfrei mit Werbung bei ${providers.freeWithAds.slice(0, 2).join(' und ')}.`);
  } else if (providers.rentBuy.length > 0) {
    out.push(`Streamer-Check Deutschland: kein Flatrate-Abo eingetragen, Leihfassung bei ${providers.rentBuy.slice(0, 2).join(' und ')}.`);
  } else {
    out.push(`Streamer-Check Deutschland: keine offiziellen Anbieter in der TMDB-Datenbank gelistet.`);
  }

  return out.slice(0, 3);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the final <aside> HTML block.
 * The `data-reporters-notebook` attribute is the identifier for replacement
 * during pipeline re-runs.
 */
function renderNotebookHtml(sentences: string[], today: Date): string {
  if (sentences.length === 0) return '';
  const body = sentences.map((s) => `<p>${escapeHtml(s)}</p>`).join('');
  const stamp = DE_DATE.format(today);
  return `\n<aside data-reporters-notebook="true" class="reporters-notebook not-prose my-8 rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-gray-800 dark:border-amber-400 p-5 shadow-sm">
<p class="rn-title font-semibold text-amber-900 dark:text-amber-300 mb-3 text-sm uppercase tracking-wide flex items-center gap-2"><span aria-hidden="true">📝</span>Aus der Redaktion · Datenstand ${stamp}</p>
<div class="rn-body space-y-2 text-[15px] leading-relaxed text-gray-800 dark:text-gray-100">${body}</div>
<p class="rn-source mt-3 text-xs text-gray-600 dark:text-gray-400 italic">Quelle: TMDB API (Region DE, Watch Providers + Series Status)</p>
</aside>`.trim();
}

/**
 * Strip a previously-inserted notebook block (idempotent re-runs).
 */
export function stripNotebookBlock(html: string): string {
  // Remove any <aside data-reporters-notebook> ... </aside> anywhere in the
  // document (not only at the end) and trim trailing whitespace.
  return html
    .replace(/<aside[^>]*data-reporters-notebook[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/\s+$/g, '');
}

export interface NotebookFacts {
  status: string | null;       // "laufend" | "abgeschlossen" | …
  statusRaw: string | null;    // raw TMDB status
  inProduction: boolean;
  firstAirDate: string | null;
  lastAirDate: string | null;
  nextEpisodeDate: string | null;
  nextEpisodeName: string | null;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  streamersDE: string[];
}

/**
 * Internal-use helper. Returns the same TMDB-derived facts that powered the
 * (now removed) visible "Aus der Redaktion"-block. Used as fact-grounding
 * input for the Faithful Translator — never rendered to readers.
 */
export async function fetchNotebookFacts(tmdbId: number): Promise<NotebookFacts | null> {
  if (!tmdbId || tmdbId <= 0) return null;
  const [facts, providers] = await Promise.all([
    fetchSeriesFacts(tmdbId),
    fetchProviderFacts(tmdbId),
  ]);
  if (!facts) return null;
  return {
    status: statusLabel(facts.status, facts.inProduction),
    statusRaw: facts.status,
    inProduction: facts.inProduction,
    firstAirDate: facts.firstAirDate,
    lastAirDate: facts.lastAirDate,
    nextEpisodeDate: facts.nextEpisodeDate,
    nextEpisodeName: facts.nextEpisodeName,
    numberOfSeasons: facts.numberOfSeasons,
    numberOfEpisodes: facts.numberOfEpisodes,
    streamersDE: providers.flatrate,
  };
}

export interface NotebookBuildResult {
  html: string | null;
  sentenceCount: number;
  skipped?: string;
}

/**
 * Build the notebook HTML for a series. Returns `null` if there is not
 * enough data to justify the block (don't ship empty E-E-A-T fluff).
 */
export async function buildReportersNotebook(
  tmdbId: number,
  options: { today?: Date } = {}
): Promise<NotebookBuildResult> {
  if (!tmdbId || tmdbId <= 0) {
    return { html: null, sentenceCount: 0, skipped: 'no tmdb id' };
  }

  const today = options.today ?? new Date();

  const [facts, providers] = await Promise.all([
    fetchSeriesFacts(tmdbId),
    fetchProviderFacts(tmdbId),
  ]);

  if (!facts) {
    return { html: null, sentenceCount: 0, skipped: 'tmdb fetch failed' };
  }

  const sentences = buildNotebookSentences(facts, providers, today);
  if (sentences.length < 2) {
    return { html: null, sentenceCount: sentences.length, skipped: 'not enough facts' };
  }

  return {
    html: renderNotebookHtml(sentences, today),
    sentenceCount: sentences.length,
  };
}

/**
 * Replace (or insert) the notebook block at the END of `contentHtml`.
 * Pure string operation — no DB.
 */
export function applyNotebookToContent(contentHtml: string, notebookHtml: string): string {
  if (!notebookHtml) return contentHtml;
  const stripped = stripNotebookBlock(contentHtml).trimEnd();
  return `${stripped}\n\n${notebookHtml}\n`;
}
