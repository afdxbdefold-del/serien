/**
 * UNRELEASED-PROJECT FILTER (Feb 2026)
 *
 * Hartes Skip für TMDB-Einträge, die reine Industrie-Platzhalter sind:
 *   - Serie heißt "Untitled <X> (Project|Series|Drama|Movie|Comedy|Show)"
 *   - status: Planned / Pilot / In Development / null
 *   - kein firstAirDate
 *
 * Solche Stubs sind keine Serien für DACH-Discover, sondern Trade-Press-Memos
 * über noch-nicht-existente Produktionen ("Oscar Isaac signs for Untitled Las
 * Vegas Casino Series"). Headlines bleiben unsuchbar ("Untitled X Series"),
 * Bouncerate ist nahe 100%, LLM-Tokens werden verbrannt.
 *
 * Whitelist: Serien mit status="In Production" werden durchgelassen, weil
 * der Production-Codename oft als realer Titel weiterläuft (Beispiel:
 * "Untitled Berlin Noir Series" → Artikel hat working-title "Berlin Noir"
 * im Slug).
 *
 * Override: News-Source enthält explizites Series-Branding-Keyword
 * ("officially titled", "now titled", "renamed to") → PASS, da die
 * Story die Titelbenennung selbst meldet.
 *
 * Ergebnis-Format folgt `show-age-cutoff.ts` für Konsistenz mit dem
 * Pipeline-Logger.
 */

const UNTITLED_SERIES_NAME_PATTERNS: RegExp[] = [
  // "Untitled X Series/Project/Drama/Movie/Comedy/Thriller/Show"
  /^untitled\b/i,
  // "X Untitled Project"
  /\buntitled\s+(?:project|series|drama|movie|film|comedy|thriller|show|pilot|spinoff|spin-?off)\b/i,
  // Generic placeholder names
  /\b(?:tba|tbd|tbc)\b\s+(?:project|series|drama|movie|show)/i,
];

const PLANNED_STATUSES: ReadonlyArray<string> = [
  'Planned',
  'Pilot',
  'In Development',
  'Rumored',
  'Pre-Production',
];

const TITLE_REVEAL_KEYWORDS: RegExp[] = [
  /\bofficially\s+titled\b/i,
  /\bnow\s+titled\b/i,
  /\brenamed\s+to\b/i,
  /\btitled\s+["'„]/i,
  /\btitel\s+(?:lautet|verraten|enth[üu]llt|bekannt)\b/i,
  /\bheißt\s+offiziell\b/i,
];

export interface UnreleasedProjectCheck {
  skip: boolean;
  reason?: string;
  hit?: string;
}

interface SeriesShape {
  name?: string | null;
  title?: string | null;
  originalName?: string | null;
  status?: string | null;
  firstAirDate?: Date | string | null;
  inProduction?: boolean | null;
}

/**
 * Prüft, ob die TMDB-Serie ein noch-nicht-existentes Industrie-Stub ist.
 * Aufruf NACH TMDB-Resolution + DACH-Gate, VOR Content-Generation.
 *
 * @param series  Series-Record (DB oder TMDB-on-the-fly)
 * @param sourceTitle  Quell-Headline (für Override-Check)
 * @param sourceLead   Erste 500-1000 Zeichen des Artikel-Texts (für Override)
 */
export function checkUnreleasedProject(
  series: SeriesShape,
  sourceTitle: string,
  sourceLead: string,
): UnreleasedProjectCheck {
  const candidateNames = [series.name, series.title, series.originalName]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  if (candidateNames.length === 0) return { skip: false };

  // 1. Pattern-Match auf Series-Name?
  let hit: string | null = null;
  for (const name of candidateNames) {
    for (const p of UNTITLED_SERIES_NAME_PATTERNS) {
      const m = name.match(p);
      if (m) {
        hit = `${name} (${m[0]})`;
        break;
      }
    }
    if (hit) break;
  }
  if (!hit) return { skip: false };

  // 2. Whitelist: "In Production" oder bereits fertig produziert (firstAirDate gesetzt)
  if (series.inProduction === true) return { skip: false };
  if (series.firstAirDate) return { skip: false };

  // 3. Status muss leer / planned-ähnlich sein
  const status = (series.status || '').trim();
  if (status && !PLANNED_STATUSES.includes(status)) {
    // z.B. "Returning Series", "Ended" — kein klassisches Stub
    return { skip: false };
  }

  // 4. Override: News meldet Titelbenennung selbst?
  const combinedSource = `${sourceTitle} ${sourceLead}`;
  if (TITLE_REVEAL_KEYWORDS.some((p) => p.test(combinedSource))) {
    return { skip: false };
  }

  // 5. Skip — Untitled-Stub ohne Veröffentlichungssignal.
  return {
    skip: true,
    reason: `Untitled-Stub ohne Release-Daten (status=${status || 'null'}, firstAirDate=null)`,
    hit,
  };
}
