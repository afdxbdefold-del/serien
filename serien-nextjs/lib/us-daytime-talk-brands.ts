/**
 * US-DAYTIME / LATE-NIGHT TALK-SHOW BRANDS (Feb 2026)
 *
 * Hartes Skip auf Series-Name-Ebene für US-Daytime- und Late-Night-Talkshow-
 * Marken. Diese landen NIEMALS auf einem DACH-Streamer (Netflix DE, Disney+,
 * Prime, WOW/Sky, Paramount+, Joyn, RTL+ etc.) — egal welches "News"-Topic
 * gerade trendet (Cast-Klatsch, Co-Host-Gerüchte, Family-Instagram-Posts).
 *
 * Warum eine eigene Lib?
 * - `genre-filter.ts` greift nicht, weil TMDB für viele dieser Shows leere
 *   `genres: []` liefert (gleicher Bug wie Wheel of Fortune).
 * - `dach-availability.ts` blockt NBC/ABC/CBS pauschal NICHT mehr (Phase A
 *   Feb 2026), weil Scripted-Drama dieser Sender via Sky/Disney+/Paramount+
 *   in DACH läuft. Daytime/Late-Night ist die Ausnahme — die laufen rein
 *   linear in den USA.
 * - `topic-out-of-scope.ts` matcht das Topic im Source-Text, nicht den
 *   Series-Namen. Hier prüfen wir die TMDB-aufgelöste Serie selbst.
 *
 * Match-Logik: Lowercase-Substring-Match auf `series.name` ODER
 * `series.originalName`. Defensive Wortgrenzen für sehr kurze Marken
 * ("snl", "gma"), damit nichts fälschlich getroffen wird.
 */

interface BrandPattern {
  label: string;
  regex: RegExp;
}

const US_DAYTIME_TALK_BRANDS: BrandPattern[] = [
  // ─── NBC Today franchise ────────────────────────────────────────────────
  { label: 'Today (NBC daytime)',                regex: /^(?:nbc\s+)?today(?:\s+show)?$/i },
  { label: 'Today with Jenna & Sheinelle',       regex: /\btoday\s+with\s+jenna\b/i },
  { label: '3rd Hour of Today',                  regex: /\b3rd\s+hour\s+of\s+today\b/i },
  { label: 'Hoda & Jenna',                       regex: /\bhoda\s+(?:&|and)\s+jenna\b/i },
  { label: 'Today All Day',                      regex: /\btoday\s+all\s+day\b/i },

  // ─── ABC GMA franchise ──────────────────────────────────────────────────
  { label: 'Good Morning America',               regex: /\bgood\s+morning\s+america\b/i },
  { label: 'GMA3',                               regex: /\bgma3\b/i },

  // ─── Daytime panels & solo hosts ────────────────────────────────────────
  { label: 'The View (ABC)',                     regex: /^the\s+view$/i },
  { label: 'The Talk (CBS)',                     regex: /^the\s+talk$/i },
  { label: 'The Real (talk show)',               regex: /^the\s+real$/i },
  { label: 'The Drew Barrymore Show',            regex: /\bdrew\s+barrymore\s+show\b/i },
  { label: 'The Kelly Clarkson Show',            regex: /\bkelly\s+clarkson\s+show\b/i },
  { label: 'The Jennifer Hudson Show',           regex: /\bjennifer\s+hudson\s+show\b/i },
  { label: 'Tamron Hall',                        regex: /^tamron\s+hall$/i },
  { label: 'Sherri (Shepherd)',                  regex: /^sherri$/i },
  { label: 'LIVE with Kelly and Mark/Ryan',      regex: /\blive\s+with\s+kelly\b/i },
  { label: 'Rachael Ray (Show)',                 regex: /\brachael\s+ray(?:\s+show)?$/i },
  { label: 'Wendy Williams Show',                regex: /\bwendy\s+williams\b/i },
  { label: 'Steve Harvey (talk)',                regex: /^steve\s+harvey$/i },
  { label: 'The Chew',                           regex: /^the\s+chew$/i },
  { label: 'The Doctors',                        regex: /^the\s+doctors$/i },
  { label: 'Dr. Phil',                           regex: /^dr\.?\s+phil(?:\s+(?:show|primetime))?$/i },
  { label: 'Maury',                              regex: /^maury$/i },
  { label: 'Jerry Springer Show',                regex: /\bjerry\s+springer\b/i },
  { label: 'Ellen DeGeneres Show',               regex: /\bellen\s+degeneres\s+show\b|^the\s+ellen\s+show$/i },

  // ─── US Late-Night ──────────────────────────────────────────────────────
  { label: 'The Tonight Show (Fallon)',          regex: /\btonight\s+show\s+(?:starring|with)\b/i },
  { label: 'The Late Show (Colbert)',            regex: /\blate\s+show\s+(?:with|starring)\s+stephen\s+colbert\b/i },
  { label: 'Jimmy Kimmel Live',                  regex: /\bjimmy\s+kimmel\s+live\b/i },
  { label: 'Late Night with Seth Meyers',        regex: /\blate\s+night\s+with\s+seth\s+meyers\b/i },
  { label: 'The Late Late Show',                 regex: /\b(?:the\s+)?late\s+late\s+show\b/i },
  { label: 'The Daily Show',                     regex: /^the\s+daily\s+show(?:\s+with\s+\w+)?$/i },
  { label: 'Last Week Tonight',                  regex: /\blast\s+week\s+tonight\b/i },
  { label: 'After Midnight',                     regex: /^after\s+midnight$/i },

  // ─── SNL family ────────────────────────────────────────────────────────
  { label: 'Saturday Night Live',                regex: /^saturday\s+night\s+live(?:\s+(?:uk|korea|weekend\s+update))?$/i },
  { label: 'SNL Korea',                          regex: /\bsnl\s*코리아\b|\bsnl\s+korea\b/i },
];

export interface DaytimeBrandResult {
  blocked: boolean;
  brand?: string;
  reason?: string;
}

/**
 * Prüft ob die TMDB-aufgelöste Serie eine US-Daytime/Late-Night/SNL-Marke ist.
 * Match auf `series.name` ODER `series.originalName`.
 */
export function checkUsDaytimeTalkBrand(
  seriesName: string | null | undefined,
  originalName?: string | null | undefined,
): DaytimeBrandResult {
  const candidates = [seriesName, originalName].filter(Boolean) as string[];
  for (const c of candidates) {
    const trimmed = c.trim();
    for (const b of US_DAYTIME_TALK_BRANDS) {
      if (b.regex.test(trimmed)) {
        return {
          blocked: true,
          brand: b.label,
          reason: `Series "${trimmed}" ist US-Daytime/Late-Night-Talkshow ("${b.label}") — landet nie auf DACH-Streamer.`,
        };
      }
    }
  }
  return { blocked: false };
}
