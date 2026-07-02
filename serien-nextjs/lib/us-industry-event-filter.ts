/**
 * US-Industry-Event Filter
 *
 * Blockt Nachrichten zu US-only Industrie-Awards und Guild-Events, die für
 * DACH-Streaming-Publikum irrelevant sind. Diese Nachrichten haben keine
 * Streaming-relevante Entscheidungsinfo für deutsche Zuschauer — sie sind
 * reines Industry-Insider-Signal.
 *
 * Beispiel-Kills:
 *   - "8. AAFCA TV Honors: Abbott Elementary gehört zu den Gewinnern"
 *   - "PGA Awards 2026: Succession nominiert"
 *   - "DGA Awards Winners announced"
 *   - "SAG Awards Nominees"
 *   - "Peabody Awards Longlist"
 *   - "GLAAD Media Awards TV Nominees"
 *
 * WICHTIG — bewusst NICHT gefiltert:
 *   - Emmy Awards (International Emmy hat DACH-Relevanz + kulturelles Awareness)
 *   - Golden Globes (hohe DACH-Awareness durch Presse)
 *   - Oscars (nicht TV, wird eh nicht klassifiziert als TV-News)
 *
 * Wird VOR dem Classifier ausgeführt → spart LLM-Budget auf offensichtlich
 * irrelevantem Content.
 */

// Award-Bezeichnungen die per Definition US-Industry-only sind und keine
// nennenswerte DACH-Öffentlichkeit haben. Muss als Substring in Title ODER
// als komplettes Akronym (mit Wortgrenzen) matchen um False-Positives zu
// vermeiden (z.B. "PGA" könnte auch "Programmiertes gesundes Altern" o.ä. sein).
const US_INDUSTRY_AWARD_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'AAFCA',        re: /\b(aafca|african american film critics)\b/i },
  { label: 'PGA Awards',   re: /\b(pga awards?|producers guild)\b/i },
  { label: 'DGA Awards',   re: /\b(dga awards?|directors guild)\b/i },
  { label: 'WGA Awards',   re: /\b(wga awards?|writers guild)\b/i },
  { label: 'SAG Awards',   re: /\b(sag awards?|screen actors guild)\b/i },
  { label: 'AFI Awards',   re: /\bafi (awards?|top ten)\b/i },
  { label: 'TCA Awards',   re: /\btca awards?\b/i },
  { label: 'Peabody',      re: /\bpeabody awards?\b/i },
  { label: 'GLAAD',        re: /\bglaad media awards?\b/i },
  { label: 'NAACP',        re: /\bnaacp image awards?\b/i },
  { label: 'ACE Eddie',    re: /\bace eddie awards?\b/i },
  { label: 'ASC',          re: /\basc awards?\b/i },
  { label: 'Cinema Audio', re: /\bcas awards?\b|cinema audio society/i },
  { label: 'Gotham',       re: /\bgotham (independent film )?awards?\b/i },
  { label: 'Spirit Awards',re: /\b(film )?independent spirit awards?\b/i },
  { label: 'Costume Designers', re: /\bcostume designers guild\b/i },
  { label: 'MTV Movie & TV', re: /\bmtv movie (and|&) tv awards?\b/i },
  { label: 'Astra',        re: /\bastra (film|tv) awards?\b/i },
  { label: 'Dorian',       re: /\bdorian awards?\b/i },
];

// Trigger-Wörter im Title die auf ein Award-Event hindeuten. Nur relevant
// wenn ZUSÄTZLICH ein US-Industry-Award-Pattern matched — Awards als solche
// sind nicht das Problem, nur US-Industry-Awards.
const AWARD_EVENT_TRIGGERS = [
  'winner', 'winners', 'gewinner',
  'nominee', 'nominees', 'nomination', 'nominations', 'nominiert', 'nominierung',
  'honoree', 'honorees', 'honors', 'honored', 'ausgezeichnet',
  'longlist', 'shortlist', 'longliste', 'shortliste',
  'ceremony', 'gala', 'preisverleihung',
];

export interface UsIndustryEventResult {
  blocked: boolean;
  reason?: string;
  matchedAward?: string;
  signals: {
    awardMatched: string[];
    eventTriggerHits: string[];
  };
}

export function checkUsIndustryEvent(input: {
  headline: string;
  sourceTitle?: string;
  body?: string;
}): UsIndustryEventResult {
  // Nur Titel (Headline + optional Source-Titel) — Body ist zu breit,
  // könnte Award-Erwähnungen als Nebensatz enthalten ohne Award-News zu sein.
  const scanText = [input.headline, input.sourceTitle ?? ''].filter(Boolean).join(' | ');

  const awardMatched: string[] = [];
  for (const p of US_INDUSTRY_AWARD_PATTERNS) {
    if (p.re.test(scanText)) awardMatched.push(p.label);
  }
  if (awardMatched.length === 0) {
    return { blocked: false, signals: { awardMatched: [], eventTriggerHits: [] } };
  }

  const lower = scanText.toLowerCase();
  const eventTriggerHits = AWARD_EVENT_TRIGGERS.filter((t) => lower.includes(t));

  // Award-Name allein reicht nicht — er muss im Kontext eines Events auftauchen
  // (Nominierung / Gewinner / Verleihung). Sonst blocken wir womöglich einen
  // Kontext-Nebensatz wie "in der Rolle die ihm später den SAG einbrachte".
  if (eventTriggerHits.length === 0) {
    return { blocked: false, signals: { awardMatched, eventTriggerHits: [] } };
  }

  return {
    blocked: true,
    reason: `US-Industry-Event ohne DACH-Relevanz: ${awardMatched.join(', ')} (Trigger: ${eventTriggerHits.slice(0, 3).join(', ')})`,
    matchedAward: awardMatched[0],
    signals: { awardMatched, eventTriggerHits },
  };
}
