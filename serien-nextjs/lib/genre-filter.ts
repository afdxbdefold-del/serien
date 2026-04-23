/**
 * GENRE SKIP-FILTER
 *
 * serien.de is a German streaming/series publication. The English-language
 * TV trade press (TVInsider, Deadline, Variety) floods our RSS feeds with
 * coverage of US late-night talk shows, SNL, game shows, daily court
 * shows etc. These are irrelevant to a German audience and produce no
 * Discover traffic — so we skip them at the pipeline level, BEFORE the
 * LLM content-generation spend is committed.
 *
 * TMDB genres we treat as "out-of-scope":
 *   - Talk         → late-night, daytime talk (Colbert, Kimmel, Fallon, …)
 *   - News         → newsmagazines (SNL is tagged News + Comedy)
 *   - Reality      → competition / daytime (The Price Is Right)
 *   - Game-Show    → Wheel of Fortune, Jeopardy!, Family Feud
 *   - Soap         → daily soaps (Days of Our Lives etc.)
 *
 * The check is "skip if ALL remaining genres are in the skip-list, OR if
 * the show has zero genres AND ≥ 30 seasons" (the long-running stripped
 * US format signature). That protects mixed-genre shows like a comedy
 * panel that happens to be labelled Talk+Comedy — we never skip if at
 * least one genre signals narrative fiction.
 */

const OUT_OF_SCOPE_GENRES = new Set([
  'talk',
  'talk show',
  'news',
  'reality',
  'game-show',
  'game show',
  'soap',
]);

/**
 * A genre is "in-scope" for serien.de if it signals scripted narrative
 * content (Drama, Comedy, Sci-Fi, Mystery, Crime, Action, Adventure,
 * Fantasy, Animation, Kids, Family, War, Western, etc.). Anything NOT
 * in our skip-list counts as in-scope.
 */
function isOutOfScope(genre: string): boolean {
  return OUT_OF_SCOPE_GENRES.has(genre.trim().toLowerCase());
}

export interface GenreSkipCheck {
  skip: boolean;
  reason?: string;
  genres: string[];
}

export function shouldSkipByGenre(
  genres: string[] | null | undefined,
  seasons?: number | null,
): GenreSkipCheck {
  const list = (genres || []).map((g) => String(g || '').trim()).filter(Boolean);

  // Fallback heuristic: no genres known but ≥ 30 seasons = long-running
  // stripped US format (Wheel of Fortune has genres=[] in our DB but 43
  // seasons). Skip rather than publish uncontrolled.
  if (list.length === 0) {
    if ((seasons || 0) >= 30) {
      return {
        skip: true,
        reason: `no-genres + ${seasons} seasons (stripped US format signature)`,
        genres: [],
      };
    }
    return { skip: false, genres: [] };
  }

  // Skip only when EVERY genre is out of scope. "Comedy, Talk" → keep
  // (Comedy is in scope). "Reality, Game-Show" → skip.
  const allOutOfScope = list.every(isOutOfScope);
  if (allOutOfScope) {
    return {
      skip: true,
      reason: `all genres out-of-scope: ${list.join(', ')}`,
      genres: list,
    };
  }

  // Special case: SNL/Colbert are "Comedy, News" / "Comedy, Talk" — "Comedy"
  // alone would be in-scope, but paired with a topical-TV genre it is the
  // same US late-night format problem. If the ONLY in-scope genre is
  // Comedy and it is paired with News or Talk, treat as out-of-scope.
  const nonSkip = list.filter((g) => !isOutOfScope(g));
  const pairedWithTopical = list.some((g) => {
    const n = g.toLowerCase();
    return n === 'news' || n === 'talk' || n === 'talk show';
  });
  if (pairedWithTopical && nonSkip.length === 1 && nonSkip[0].toLowerCase() === 'comedy') {
    return {
      skip: true,
      reason: `late-night/topical signature: ${list.join(', ')}`,
      genres: list,
    };
  }

  return { skip: false, genres: list };
}
