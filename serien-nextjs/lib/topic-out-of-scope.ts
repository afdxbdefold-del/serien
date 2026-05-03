/**
 * TOPIC OUT-OF-SCOPE FILTER (Phase B Feb 2026)
 *
 * Ergänzt den Genre-Filter (`lib/genre-filter.ts`): Selbst wenn die Serie
 * in-scope ist (z.B. "Heated Rivalry" = Drama), kann das ARTIKEL-TOPIC
 * irrelevant für DACH sein:
 *   - US-Late-Night-Auftritte (SNL, Tonight Show, Late Show …)
 *   - US-Daytime-Talk (The View, GMA, Today Show, Ellen)
 *   - Red-Carpet-Klatsch / Mode (Denim-Outfits, "what she wore")
 *   - US-Award-Backstage-Drama ohne Sieger-Bezug
 *
 * Erkennung: Source-Title + Lead enthalten ≥1 Talkshow-/Boulevard-Phrase
 * UND nichts, was eindeutig Story-News markiert (Renewal, Cast, Trailer,
 * Premiere, Death-of-Character, Plot-Reveal, Showrunner-Interview).
 */

const US_TALKSHOW_PATTERNS: RegExp[] = [
  /\bsaturday\s+night\s+live\b/i,
  /\bsnl(?:[\s\W:-]|$)/i,
  /\b(?:the\s+)?tonight\s+show\b/i,
  /\bjimmy\s+fallon\b/i,
  /\bjimmy\s+kimmel(?:\s+live)?\b/i,
  /\b(?:the\s+)?late\s+show\b/i,
  /\bstephen\s+colbert\b/i,
  /\bseth\s+meyers\b/i,
  /\b(?:the\s+)?late\s+late\s+show\b/i,
  /\bjames\s+corden\b/i,
  /\bwatch\s+what\s+happens\s+live\b/i,
  /\bandy\s+cohen\b/i,
  /\b(?:the\s+)?daily\s+show\b/i,
  /\bjon\s+stewart\b/i,
  /\btrevor\s+noah\b/i,
  /\b(?:the\s+)?ellen(?:\s+(?:degeneres|show))?\b/i,
  /\b(?:the\s+)?view\b(?!\s+(?:from|of))/i, // "The View" als Talkshow, nicht "view from", "view of"
  /\b(?:the\s+)?today\s+show\b/i,
  /\bgma\b|\bgood\s+morning\s+america\b/i,
  /\bdrew\s+barrymore\s+show\b/i,
  /\b(?:the\s+)?kelly\s+clarkson\s+show\b/i,
  /\bhot\s+ones\b/i,
  /\bcarpool\s+karaoke\b/i,
];

const US_BOULEVARD_PATTERNS: RegExp[] = [
  /\bmet\s+gala\b/i,
  /\bred\s+carpet\b(?!\s+(?:premiere))/i,        // pure red-carpet-klatsch, nicht "red carpet premiere" of a series
  /\bvanity\s+fair\s+oscar\s+party\b/i,
  /\b(?:was|is)\s+wearing\b/i,                   // "what she was wearing"
  /\bdenim\s+outfit\b/i,
  /\bin\s+a\s+(?:plunging|sheer|see-through|bedazzled)\s+/i,
  /\bsteamy\s+kiss\b/i,
  /\bpda\s+at\b/i,
  /\bcosied?\s+up\b/i,
  /\bspotted\s+(?:together|holding\s+hands)\b/i,
];

/**
 * Story-News-Marker: wenn diese Phrasen vorkommen, ist der Artikel
 * trotz Talkshow-Erwähnung wahrscheinlich legitim (z.B. Cast-Interview
 * BEI Colbert über Plot der eigenen Serie).
 */
const LEGITIMATE_STORY_PATTERNS: RegExp[] = [
  /\b(season|staffel)\s*\d+\s+(renewed|cancelled|canceled|abgesetzt|verlängert)\b/i,
  /\b(renewed|cancelled|canceled)\s+for\s+(season|staffel)/i,
  /\b(absetzung|verlängerung|fortsetzung|abgesetzt)\b/i,
  /\b(showrunner|executive\s+producer)\s+(announces|confirms|reveals|teases)/i,
  /\b(trailer|teaser)\s+(?:released|drops|reveals|premieres)/i,
  /\b(plot|finale|opener|ending|cliffhanger|twist)\s+(reveal|explained|breakdown)/i,
  /\b(cast|casting)\s+(announcement|news|update|adds|joins)/i,
  /\b(killed|killed\s+off|dies|exits|leaves|departure)\s+(?:from|in)\s+(?:the\s+)?(?:show|series|series\s+finale)/i,
  /\b(premiere|series\s+premiere|midseason|finale)\s+(date|reveal)/i,
  /\b(spinoff|prequel|sequel|reboot|revival)\b/i,
  /\bemmy|golden\s+globe|sag\s+award/i,
];

export interface TopicScopeCheck {
  skip: boolean;
  reason?: string;
  hit?: string;
}

/**
 * Prüft, ob der Artikel ein US-Talkshow-/Boulevard-Topic ist.
 * Aufruf NACH Klassifikation, VOR Content-Generation.
 *
 * @param title  Quell-Titel (Englisch oder Deutsch)
 * @param leadText Erste 500-1000 Zeichen des Quell-Artikels (mehr braucht's nicht)
 */
export function checkTopicOutOfScope(title: string, leadText: string): TopicScopeCheck {
  const combined = `${title} ${leadText}`;

  // 1. Talkshow- oder Boulevard-Pattern Hit?
  let hit: string | null = null;
  let category: 'talkshow' | 'boulevard' | null = null;
  for (const p of US_TALKSHOW_PATTERNS) {
    const m = combined.match(p);
    if (m) { hit = m[0]; category = 'talkshow'; break; }
  }
  if (!hit) {
    for (const p of US_BOULEVARD_PATTERNS) {
      const m = combined.match(p);
      if (m) { hit = m[0]; category = 'boulevard'; break; }
    }
  }
  if (!hit) return { skip: false };

  // 2. Gibt es einen Story-News-Marker, der den Artikel legitimiert?
  const hasLegitimateAngle = LEGITIMATE_STORY_PATTERNS.some(p => p.test(combined));
  if (hasLegitimateAngle) return { skip: false };

  // 3. Skip — pure Talkshow/Boulevard ohne Story-Hook.
  return {
    skip: true,
    reason: category === 'talkshow'
      ? `US-Talkshow-Topic ohne Story-Hook (Cast-Auftritt-Klatsch, kein Renewal/Cast/Plot)`
      : `Boulevard-/Klatsch-Topic ohne Story-Hook`,
    hit,
  };
}
