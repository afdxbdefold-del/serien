/**
 * "True Story / Wo sind sie jetzt" Headline Format Enforcement
 *
 * Eigene Content-Kategorie für Artikel, die hinter einer Doku/Drama-Serie
 * den realen Hintergrund recherchieren ("real story behind", "where are they
 * now?", "basiert auf wahrer geschichte"). Headline soll nah am Original
 * bleiben und in eine von zwei Pflicht-Formeln gegossen werden:
 *
 *   Pattern A (Serie BASIERT auf wahren Ereignissen, klar bestätigt):
 *     "Die wahre Geschichte hinter <Serie>. Wie ging es weiter?"
 *
 *   Pattern B (Unklar/Frage als Hook):
 *     "Basiert <Serie> auf einer wahren Geschichte? Wie ging es weiter?"
 *
 * Erkennung:
 *   - URL/Source enthält Trigger ("true story", "real story", "where are they
 *     now", "wahre geschichte", "basiert auf wahrer", "real-life", "based on")
 *   - ODER Serie ist als True-Crime/Documentary klassifiziert (Genres 99/10764)
 *
 * Pattern-Wahl (A vs B):
 *   - A wenn Source explizit "true story", "real story" oder die Serie als
 *     "Documentary" (Genre 99) klassifiziert ist → Klarheit erlaubt Aussage.
 *   - B wenn nur Spekulations-Trigger ("based on a true story?", "is it real",
 *     "fact or fiction") → Frage als Hook.
 */

export const TRUE_STORY_PATTERN_A_REGEX =
  /^die\s+wahre\s+geschichte\s+hinter\s+.+?\.\s+wie\s+ging\s+es\s+weiter\?/i;
export const TRUE_STORY_PATTERN_B_REGEX =
  /^basiert\s+.+?\s+auf\s+einer\s+wahren\s+geschichte\?\s+wie\s+ging\s+es\s+weiter\?/i;

export type TrueStoryCertainty = 'confirmed' | 'uncertain';

export interface EnforceTrueStoryInput {
  headline: string;
  seriesTitle: string;
  certainty: TrueStoryCertainty;
}

/**
 * Erzwingt eines der beiden Pflicht-Pattern. Idempotent: ein bereits
 * konformer Headline bleibt unverändert. Behandelt korrekt Series-Titel,
 * die selbst auf Satzzeichen (?,!,.) enden — kein doppeltes Zeichen.
 */
export function enforceTrueStoryFormat(input: EnforceTrueStoryInput): string {
  const { headline, seriesTitle, certainty } = input;

  const rawTitle = (seriesTitle || '').trim();
  // Series-Titel mit endendem Satzzeichen (Should I Marry A Murderer?) brauchen
  // im Pattern A keinen zusätzlichen Punkt. Pattern B nutzt eh ein "?" als
  // Verbindung — da ein Series-Titel-? perfekt aufgeht.
  const titleEndsInPunct = /[?!.]$/.test(rawTitle);
  const cleanTitle = rawTitle.replace(/[?!.]+$/, '');

  if (certainty === 'confirmed') {
    // Pattern A: "Die wahre Geschichte hinter <Title>. Wie ging es weiter?"
    // Wenn rawTitle auf "?" endet → "Die wahre Geschichte hinter <Title> Wie ging es weiter?"
    const expected = titleEndsInPunct
      ? `Die wahre Geschichte hinter ${rawTitle} Wie ging es weiter?`
      : `Die wahre Geschichte hinter ${cleanTitle}. Wie ging es weiter?`;
    if (headline === expected) return headline;
    if (TRUE_STORY_PATTERN_A_REGEX.test(headline)) {
      // Konform aber nicht exakt → normalize, damit kein "?." entsteht.
      return expected;
    }
    return expected;
  }

  // Pattern B: "Basiert <Title> auf einer wahren Geschichte? Wie ging es weiter?"
  // rawTitle bleibt im Satz (auch wenn er auf "?" endet, Lesefluss bleibt natürlich).
  const expected = `Basiert ${cleanTitle} auf einer wahren Geschichte? Wie ging es weiter?`;
  if (headline === expected) return headline;
  if (TRUE_STORY_PATTERN_B_REGEX.test(headline)) return expected;
  return expected;
}

const TRUE_STORY_TRIGGERS_TITLE: RegExp[] = [
  /\btrue\s+story\b/i,
  /\breal\s+story\b/i,
  /\breal-?life\b/i,
  /\breal\s+(?:case|events|crime|people)\b/i,
  /\bwhere\s+are\s+they\s+now\b/i,
  /\bbased\s+on\s+(?:a\s+)?true\b/i,
  /\bfact\s+or\s+fiction\b/i,
  // German triggers
  /\bwahre\s+(?:geschichte|begebenheit|story)\b/i,
  /\bbasiert\s+auf\s+(?:einer\s+)?wahren\b/i,
  /\bnach\s+wahren\s+begebenheiten\b/i,
  /\bechte\s+(?:fall|menschen|personen|geschichte)\b/i,
  /\bwo\s+sind\s+sie\s+(?:jetzt|heute)\b/i,
];

const TRUE_STORY_TRIGGERS_URL: RegExp[] = [
  /\btrue-story\b/i,
  /\breal-story\b/i,
  /\bwhere-are-they-now\b/i,
  /\bbased-on-(?:a-)?true\b/i,
  /\bwahre-geschichte\b/i,
];

/**
 * Wird der Source-URL oder -Title als True-Story-Explainer erkannt?
 */
export function isTrueStorySource(url?: string | null, title?: string | null): boolean {
  if (url) {
    for (const rx of TRUE_STORY_TRIGGERS_URL) if (rx.test(url)) return true;
  }
  if (title) {
    for (const rx of TRUE_STORY_TRIGGERS_TITLE) if (rx.test(title)) return true;
  }
  return false;
}

/**
 * Bestimme aus Source-Title + Series-Genres ob Pattern A (confirmed) oder
 * Pattern B (uncertain) anzuwenden ist.
 *
 * Confirmed-Signale:
 *   - "true story", "real story" (Aussage, kein Fragezeichen)
 *   - Serie hat TMDB Genre Documentary (99) oder ist als True-Crime markiert
 *   - "where are they now" (impliziert reale Personen)
 *
 * Uncertain-Signale:
 *   - "based on a true story?" (mit Fragezeichen)
 *   - "fact or fiction"
 *   - "is X real"
 *   - keiner der Confirmed-Trigger UND nur generische Drama-Genres
 */
export function assessTrueStoryCertainty(
  sourceTitle: string | null | undefined,
  sourceText: string | null | undefined,
  seriesGenres: string[] | null | undefined,
): TrueStoryCertainty {
  const haystack = `${sourceTitle || ''}\n${(sourceText || '').slice(0, 500)}`.toLowerCase();
  const genres = (seriesGenres || []).map((g) => g.toLowerCase());

  // Confirmed-Signale prüfen
  const isDocumentary = genres.includes('documentary') || genres.includes('dokumentarfilm');
  // "true story" in einer Frage ("is X based on a true story?") zählt NICHT als
  // Confirmed — das Fragezeichen signalisiert genau das Gegenteil.
  const inQuestionForm =
    /\bis\s+\w[\w\s]*?\s+(?:a\s+)?true\s+story\?/i.test(haystack) ||
    /\bbased\s+on\s+(?:a\s+)?true\s+story\?/i.test(haystack);
  const hasTrueStoryAssertion = !inQuestionForm && (
    /\bthe\s+true\s+story\b/i.test(haystack) ||
    /\breal\s+story\b/i.test(haystack) ||
    /\bnach\s+wahren\s+begebenheiten\b/i.test(haystack) ||
    /\bdie\s+wahre\s+geschichte\b/i.test(haystack)
  );
  const hasWhereAreTheyNow = /\bwhere\s+are\s+they\s+now\b/i.test(haystack) ||
    /\bwo\s+sind\s+sie\s+(?:jetzt|heute)\b/i.test(haystack);

  if (isDocumentary || hasTrueStoryAssertion || hasWhereAreTheyNow) return 'confirmed';

  // Uncertain-Signale → explizite Fragezeichen-Marker
  const hasUncertainTrigger =
    /\bbased\s+on\s+(?:a\s+)?true\s+story\??/i.test(haystack) ||
    /\bfact\s+or\s+fiction\b/i.test(haystack) ||
    /\bis\s+\w+\s+real\b/i.test(haystack);
  if (hasUncertainTrigger) return 'uncertain';

  // Default: bei generic Drama mit "based on" → uncertain (Frage öffnet Hook)
  return 'uncertain';
}
