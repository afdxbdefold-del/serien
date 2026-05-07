/**
 * SAMMEL-RECAP DETECTOR (Feb 2026)
 *
 * TVInsider, Decider und Co. publizieren regelmäßig „Multi-Show-Roundups":
 * eine URL listet 3+ Serien auf, die am gleichen Wochenende ihre Season
 * Premieres / Finales / Recaps haben. Beispiel:
 *   /9-1-1-greys-anatomy-the-hunting-party-season-finales-the-terror-season-premiere/
 *
 * Problem: Der LLM-Classifier wählt aus solchen URLs gerne die letzte oder
 * prominenteste Serie als `primary_series` und routed den Artikel als
 * `SINGLE_SERIES_NEWS` durch — der `MULTI_SERIES_EDITORIAL`-Filter
 * (mit DEATH/PLATFORM/AWARD-Override) greift dann gar nicht mehr.
 *
 * Lösung: deterministische Pattern-Erkennung am URL+Titel BEVOR der
 * LLM-Classifier läuft. Spart Tokens + verhindert Bypass.
 *
 * Detection-Signale:
 *   1. Plural-Marker im Titel/URL: "Season Finales", "Season Premieres",
 *      "Series Premieres", "Recaps", "Episodes Recap".
 *   2. 3+ Komma-/Ampersand-getrennte Show-Tokens im Titel.
 *   3. URL-Pattern mit `-season-(finales|premieres)-` (PLURAL!).
 *   4. Roundup-Branding-Phrasen: "Tonight's TV", "What's on tonight",
 *      "Weekend roundup", "Recap of the week".
 *
 * Override: Sammel-Recaps werden NICHT durchgelassen — auch nicht via
 * DEATH/PLATFORM/AWARD-Triggers. Wer eine Award-Nacht oder einen
 * Strike-Story als Sammel-Recap verpackt, soll lieber separate Artikel
 * pro Serie machen. Hard-Skip ohne Ausnahme.
 */

const ROUNDUP_PLURAL_PATTERNS: RegExp[] = [
  // "Season Finales" / "Season Premieres" — Plural ist der starke Marker.
  // Singular ("Season Finale", "Season Premiere") fängt Single-Show-News.
  /\bseason[\s-]+(?:finales|premieres)\b/i,
  /\bseries[\s-]+premieres\b/i,
  /\bmidseason[\s-]+(?:finales|premieres)\b/i,
  /\bepisode[\s-]+recaps\b/i,
  /\b(?:weekend|weekly)[\s-]+(?:recap|roundup|wrap[\s-]?up)\b/i,
  /\brecap[\s-]+of[\s-]+the[\s-]+week\b/i,
  /\btonight['']s[\s-]+tv\b/i,
  /\bwhat['']s[\s-]+on[\s-]+(?:tv[\s-]+)?tonight\b/i,
  /\bnew[\s-]+(?:shows?|series)[\s-]+this[\s-]+week\b/i,
  // German Plural-Marker
  /\bstaffel[\s-]+(?:finalen|premieren)\b/i,
  /\bwochenend[\s-]?(?:rückblick|recap)\b/i,
];

/**
 * Heuristische Erkennung von 3+ Show-Tokens in einem Titel via
 * Komma- + Ampersand-Splits.
 *
 * Beispiel-Title:
 *   "9-1-1, Grey's Anatomy, The Hunting Party Season Finales & The Terror Season Premiere"
 *
 * Naive Split an `,` und `&` ergibt 4 Segmente → ≥3 → Match.
 *
 * Schutz gegen False-Positives:
 *   - Nur wenn Title-Length > 40 Zeichen (kurze Single-Show-Titles nicht).
 *   - Nicht wenn nur ein Komma + ein Ampersand bei Cast-Listen drin sind
 *     ("Brad Pitt, Margot Robbie & Tom Cruise") — dann sind es Personen.
 *     Workaround: das ist genau der Sammel-Recap-Pattern, also lassen.
 */
function hasMultipleShowTokens(title: string): boolean {
  if (!title || title.length < 40) return false;
  // Split an `,` und `&` (auch `und` zwischen letzten beiden), aber
  // nur wenn Großbuchstabe folgt (Show-Namen sind capitalized).
  const segments = title
    .split(/\s*(?:,|&|\bund\b)\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);
  if (segments.length < 3) return false;
  // Mindestens 3 Segmente müssen mit Großbuchstabe / Ziffer beginnen
  // (Show-Titel-Form). Filtert "lowercase, lowercase, lowercase" Listen.
  const capStarts = segments.filter((s) => /^[A-Z0-9]/.test(s)).length;
  return capStarts >= 3;
}

export interface SammelRecapCheck {
  isSammelRecap: boolean;
  reason?: string;
  hit?: string;
}

/**
 * Aufruf VOR dem LLM-Classifier (spart Tokens). Liefert deterministisches
 * Skip-Signal, wenn URL/Titel auf Sammel-Recap hinweisen.
 */
export function detectSammelRecap(title: string, url: string): SammelRecapCheck {
  const combined = `${title || ''}\n${url || ''}`;

  for (const p of ROUNDUP_PLURAL_PATTERNS) {
    const m = combined.match(p);
    if (m) {
      return {
        isSammelRecap: true,
        reason: 'Multi-Show-Roundup-Plural-Marker',
        hit: m[0],
      };
    }
  }

  if (hasMultipleShowTokens(title || '')) {
    return {
      isSammelRecap: true,
      reason: '3+ Komma-/Ampersand-getrennte Show-Tokens im Titel',
      hit: title.slice(0, 80),
    };
  }

  return { isSammelRecap: false };
}
