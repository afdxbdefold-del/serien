/**
 * SHOW-AGE CUTOFF (Feb 2026)
 *
 * Hartes Skip für Serien, deren Story-Zentrum so lange her ist, dass keine
 * sinnvolle DACH-Discover-Story mehr möglich ist (z. B. "Happy Days nach
 * 42 Jahren — Cast trifft sich noch zum Plausch"). Solche Boulevard-Tage
 * binden LLM-Tokens, ohne das eigentliche Site-Ziel ("Was schaue ich heute?")
 * zu bedienen.
 *
 * Regel:
 *   • Serie ist `Ended`/`Canceled` UND `lastAirDate` älter als 10 Jahre →  SKIP
 *   • AUSNAHME: Source-Title oder Lead enthalten Reboot-/Revival-/Death-/
 *     Reunion-Premiere-Keywords (echtes News-Material trotz Altsystem) → PASS
 *
 * Ergebnis-Format folgt `topic-out-of-scope.ts` für Konsistenz mit
 * Pipeline-Logger.
 */

const REVIVAL_KEYWORDS: RegExp[] = [
  // Reboot / Revival
  /\breboot(?:ed|ing)?\b/i,
  /\brevival\b/i,
  /\bre[\W_]?launch(?:ed|ing)?\b/i,
  /\bneuauflage\b/i,
  /\bneu[\W_]?aufgelegt\b/i,
  /\bcomeback\b/i,
  /\bkehrt[\W_]+zur(?:ü|ue)ck\b/i,
  /\breturns? (?:to|with|after|for)\b/i,
  /\bback for (?:season|a new)\b/i,
  /\bwiederbelebt\b/i,

  // Tod / Trauer (newsworthy)
  /\b(?:has\s+)?died(?:\s+(?:at|aged))?\b/i,
  /\bdies at\s+\d{2}\b/i,
  /\bgestorben\b/i,
  /\bverstorben\b/i,
  /\btot[\W_]+aufgefunden\b/i,
  /\bpasses?\s+away\b/i,

  // Reunion-Premiere mit Sendetermin (nicht: "Cast trifft sich zum Lunch")
  /\breunion\s+(?:special|episode|movie|series)\b/i,
  /\bcast[\W_]+reunites?\s+(?:for|in)\s+(?:netflix|apple|prime|disney|hbo|hulu|paramount|peacock)\b/i,

  // Spinoff / Prequel (oft echter News-Anlass)
  /\bspin[\W_]?off\b/i,
  /\bprequel\b/i,
  /\bsequel[\W_]+series\b/i,
  /\bnachfolge[\W_]?serie\b/i,

  // Streaming-Premiere / Re-Release
  /\b(?:erstmals|jetzt|ab\s+\w+)\s+(?:auf|bei|streaming)\s+(?:netflix|disney\+|prime|wow|paramount\+|apple\s*tv\+|joyn|sky|magenta\s*tv)\b/i,
  /\bstreaming[\W_]+debut\b/i,
];

export interface ShowAgeCutoffResult {
  skip: boolean;
  reason?: string;
  ageYears?: number;
}

/**
 * Prüft ob eine Serie nach der Age-Cutoff-Regel hart geblockt werden soll.
 *
 * @param series  TMDB-aufgelöste Serie aus DB
 * @param sourceTitle  RSS-Source-Title (für Revival-Override)
 * @param sourceLead   Erste 500 Zeichen Source-Body (optional, präziser)
 * @param maxAgeYears  Default 10 Jahre — alles davor ist „too old"
 */
export function checkShowAgeCutoff(
  series: {
    name?: string | null;
    lastAirDate?: Date | null;
    firstAirDate?: Date | null;
    status?: string | null;
    inProduction?: boolean | null;
  },
  sourceTitle: string | null | undefined,
  sourceLead?: string | null | undefined,
  maxAgeYears: number = 10,
): ShowAgeCutoffResult {
  // Wenn Serie noch in Produktion ist → niemals skippen.
  if (series.inProduction === true) return { skip: false };

  // Status: TMDB-States = "Returning Series", "Planned", "In Production", "Ended", "Canceled", "Pilot"
  const statusLower = (series.status || '').toLowerCase();
  const isEnded = statusLower === 'ended' || statusLower === 'canceled' || statusLower === 'cancelled';
  if (!isEnded) return { skip: false };

  // Ohne lastAirDate können wir nicht zuverlässig altersbestimmen.
  const last = series.lastAirDate ? new Date(series.lastAirDate) : null;
  if (!last || isNaN(last.getTime())) return { skip: false };

  const now = Date.now();
  const ageYears = (now - last.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageYears < maxAgeYears) return { skip: false };

  // Override: echtes News-Material trotz alter Serie?
  const haystack = `${sourceTitle || ''}\n${sourceLead || ''}`;
  for (const rx of REVIVAL_KEYWORDS) {
    if (rx.test(haystack)) {
      return { skip: false };
    }
  }

  return {
    skip: true,
    ageYears: Math.round(ageYears * 10) / 10,
    reason: `${series.name || 'Series'} endete vor ${Math.round(ageYears)} Jahren (${last.getFullYear()}) ohne Reboot-/Revival-/Death-Trigger im Source.`,
  };
}
