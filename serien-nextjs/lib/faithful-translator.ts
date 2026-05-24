/**
 * FAITHFUL TRANSLATOR
 *
 * Translates the FULL source article text into German while preserving the
 * original journalist's voice, sentence rhythm, paragraph structure, and
 * quotes. NOT a "rewrite from facts" approach. NOT a "restructure for SEO"
 * approach. Just an accurate translation with a targeted editorial diff
 * applied on top for DACH localization.
 *
 * Pipeline:
 *   1. translate()        → Claude does a faithful 1:1 paragraph translation
 *   2. dachLocalize()     → swap US networks for DACH streamers, USD→EUR,
 *                           US date formats → DE, deletions for inapplicable
 *                           pieces (e.g. "Hulu shows in Canada" → cut)
 *   3. buildHtml()        → wrap paragraphs in <p>, add 1–2 H2 headings ONLY
 *                           if the source already had them
 *
 * Output is a `FaithfulArticle` object matching the rest of the pipeline's
 * expected shape (headline, lead, contentHtml, metaDescription).
 *
 * NOTE on copyright: per user direction, takedown risk is accepted. We do
 * lightly paraphrase the first 2 sentences of the lead to vary the opening
 * (helps with Google duplicate-content + gives serien.de a distinctive lede)
 * — everything else stays as close to the source as German grammar allows.
 */

import { createLLMClient, getLLMConfig, parseLLMJson } from './llm-config';

const MAX_SOURCE_CHARS = 12000;
const TARGET_WORDS_MIN = 350;
const TARGET_WORDS_MAX = 900;

export interface DachLocalizationContext {
  /** Streamer names from TMDB /watch/providers (region=DE). */
  streamersDE?: string[];
  /** TMDB series name in German if available. */
  seriesNameDE?: string;
  /** Today's date in `Europe/Berlin` for grounding. */
  todayIso?: string;
  /** TMDB series status in German (laufend / abgeschlossen / abgesetzt). */
  seriesStatusDE?: string | null;
  /** ISO date of the last aired episode. */
  lastEpisodeDate?: string | null;
  /** ISO date of the next scheduled episode (if any). */
  nextEpisodeDate?: string | null;
  /** Total number of seasons aired. */
  numberOfSeasons?: number | null;
}

export interface AdditionalSource {
  /** URL of the corroborating source (for citation in footer). */
  url: string;
  /** Plain-text article body. */
  text: string;
  /** Original (English) headline of this source. */
  headline?: string;
  /** Hostname used in the footer ("variety.com" → "Variety"). */
  publisher?: string;
}

export interface FaithfulTranslatorInput {
  sourceText: string;
  sourceHeadline: string;
  sourceUrl: string;
  seriesName: string;
  dach?: DachLocalizationContext;
  /**
   * Optional corroborating sources. When ≥1 is supplied, the translator
   * switches to Multi-Source Synthesis mode: primary source is the
   * structural backbone; additional sources contribute extra quotes and
   * cross-validated facts only.
   */
  additionalSources?: AdditionalSource[];
}

export interface FaithfulArticle {
  headline: string;
  metaDescription: string;
  leadParagraph: string;
  contentHtml: string;
  wordCount: number;
  paragraphCount: number;
  quotesPreserved: number;
  notes: string[];
  /** Set when ≥1 additionalSources was used and the synthesis succeeded. */
  multiSource?: {
    sourceCount: number;
    publishers: string[];
    crossValidatedFacts: number;
    contradictionsFlagged: number;
  };
}

const SYSTEM_PROMPT =
  'Du bist ein erfahrener deutscher Übersetzer und TV-Magazin-Redakteur für ' +
  'serien.de. Deine EINZIGE Aufgabe: einen englischen Quellartikel TREU ' +
  'ins Deutsche übersetzen. Du erfindest NICHTS dazu. Du kürzt nicht. Du ' +
  'änderst die Absatzstruktur nicht. Du fügst keine SEO-H2-Überschriften ' +
  'hinzu, die im Original nicht waren. Du behältst Quotes 1:1 (auf Deutsch). ' +
  'Antworte ausschließlich mit validem JSON, ohne Markdown-Codeblöcke.';

function publisherFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const root = host.split('.')[0];
    // Title-case the publisher root (variety → Variety, tvinsider → TVInsider)
    const known: Record<string, string> = {
      tvinsider: 'TVInsider',
      tvline: 'TVLine',
      variety: 'Variety',
      deadline: 'Deadline',
      hollywoodreporter: 'The Hollywood Reporter',
      thr: 'The Hollywood Reporter',
      screenrant: 'ScreenRant',
      ew: 'Entertainment Weekly',
      collider: 'Collider',
      indiewire: 'IndieWire',
      vulture: 'Vulture',
      decider: 'Decider',
      ign: 'IGN',
      gamespot: 'GameSpot',
    };
    if (known[root]) return known[root];
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    return 'Quelle';
  }
}

function buildPrompt(input: FaithfulTranslatorInput): string {
  const { sourceText, sourceHeadline, sourceUrl, seriesName, dach, additionalSources } = input;
  const today = dach?.todayIso ?? new Date().toISOString().slice(0, 10);
  const isMultiSource = Boolean(additionalSources && additionalSources.length > 0);
  const streamerHint = dach?.streamersDE?.length
    ? `Auf serien.de relevante deutsche Streaming-Plattformen für „${seriesName}": ${dach.streamersDE.join(', ')}. Wenn der Quelltext US-Sender erwähnt (ABC, NBC, CBS, Fox, The CW, Hulu), ersetze sie durch die passenden DACH-Streamer, falls die Serie dort verfügbar ist. Wenn keine DACH-Verfügbarkeit bekannt ist, schreibe „in Deutschland aktuell nicht verfügbar" oder lasse den Empfangshinweis weg.`
    : `Falls der Quelltext US-Sender (ABC, NBC, CBS, Fox, The CW, Hulu) als Empfangshinweis erwähnt: ersetze sie durch „beim jeweiligen Streaming-Anbieter" oder „aktuell nicht in Deutschland verfügbar". US-Sender dürfen nur als Produktionshintergrund stehen.`;

  // Build the internal "Fact-Grounding"-block from TMDB data. Used by the
  // LLM as guard-rails against hallucinated season counts / air dates /
  // streaming availability. NOT rendered to readers.
  const groundingLines: string[] = [];
  if (dach?.seriesStatusDE) groundingLines.push(`- Serienstatus (TMDB, ${today}): ${dach.seriesStatusDE}`);
  if (dach?.numberOfSeasons) groundingLines.push(`- Aktuell ${dach.numberOfSeasons} ${dach.numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'} ausgestrahlt`);
  if (dach?.lastEpisodeDate) groundingLines.push(`- Letzte ausgestrahlte Folge: ${dach.lastEpisodeDate}`);
  if (dach?.nextEpisodeDate) groundingLines.push(`- Nächste Folge laut TMDB: ${dach.nextEpisodeDate}`);
  if (dach?.streamersDE?.length) groundingLines.push(`- In Deutschland aktuell im Flatrate-Abo bei: ${dach.streamersDE.join(', ')}`);
  const groundingBlock = groundingLines.length
    ? `\nINTERNE FAKTEN-GRUNDLAGE (NICHT in den Body kopieren, nur als Korrektiv nutzen — Quellen-Inhalt hat Vorrang, aber widerspricht der Quelltext einem dieser Fakten, korrigiere stillschweigend):\n${groundingLines.join('\n')}\n`
    : '';

  // Build the additional-source blocks (only first 3 to bound prompt size)
  const additionalBlocks =
    isMultiSource && additionalSources
      ? additionalSources
          .slice(0, 3)
          .map((s, idx) => {
            const pub = s.publisher || publisherFromUrl(s.url);
            const trimmed = s.text.slice(0, 4000);
            return `\nZUSATZQUELLE ${idx + 1} (${pub}, ${s.url}):\nORIGINAL-HEADLINE: "${s.headline || ''}"\n"""\n${trimmed}\n"""`;
          })
          .join('\n')
      : '';

  const multiSourceRules = isMultiSource
    ? `

MULTI-SOURCE-SYNTHESE-MODUS AKTIV (${additionalSources!.length} Zusatzquelle${additionalSources!.length === 1 ? '' : 'n'}):
A. PRIMÄRQUELLE = STRUKTURELLER BACKBONE: Übernimm Absatzstruktur, Reihenfolge der Themen und Erzählfluss aus der Primärquelle.
B. ZUSATZQUELLEN = NUR ERGÄNZUNG: Nutze sie ausschließlich für:
   1) Zusätzliche Direktzitate (O-Töne aus anderen Interviews), die in der Primärquelle fehlen — füge sie an thematisch passender Stelle als zusätzlichen Satz in den bestehenden Absatz ein.
   2) Bestätigung von Fakten (cross-validated facts): Wenn zwei Quellen denselben Fakt nennen, übernimm ihn ohne Hedge.
   3) Marginale faktische Lücken füllen (z. B. wenn nur Zusatzquelle das Premieren-Datum nennt).
C. WIDERSPRÜCHE: Wenn Zusatzquelle einer Primärquellen-Aussage WIDERSPRICHT, übernimm die Primärquelle und liste den Widerspruch im JSON-Feld "crossValidation.contradictions" — schreibe ihn NICHT in den Body.
D. KEINE NEUEN ABSCHNITTE: Du baust den Artikel NICHT umfangreicher. Maximal +20 % Wortzahl gegenüber Primärquelle.
E. ATTRIBUTION von Direktzitaten: Übernimm Name + Funktion ("sagte Showrunner Dan Erickson zu Variety") — Quellnamen dürfen genannt werden, das ist standard journalistische Attribution.`
    : '';

  const primaryBlock = `
PRIMÄRQUELLE: ${sourceUrl}
SERIE: ${seriesName}
ORIGINAL-HEADLINE (Englisch): "${sourceHeadline}"
HEUTE: ${today}

PRIMÄRTEXT (übersetze diesen als strukturellen Backbone):
"""
${sourceText.slice(0, MAX_SOURCE_CHARS)}
"""`;

  const outputFormat = `OUTPUT-FORMAT (striktes JSON):
{
  "headline": "Deutsche Headline, 40–70 Zeichen, treue Übersetzung des Originals, keine Click-Bait-Floskeln",
  "metaDescription": "Deutsche Meta-Description, max 155 Zeichen, fasst Kern zusammen",
  "leadParagraph": "Erster Absatz — maximal 2 kurze Sätze, KEINE 3-Satz-Wand. Pointierte Story-Hook im News-Stil, kein Plot-Recap.",
  "bodyParagraphs": [
    "Zweiter deutscher Absatz — direkt mit Quote, konkreten Zahlen oder spezifischer Szenenbeschreibung einsteigen. KEINE Wiederholung der Lead-Aussage in anderen Worten. KEIN „Diese Miniserie begleitet …", KEIN „Diese Serie erzählt …", KEIN abstraktes Plot-Resümee. Wenn das Original abstrakt einsteigt, überspringe den abstrakten Quell-Absatz und starte direkt mit dem ersten konkreten Sach-Absatz des Quelltexts.",
    "Dritter deutscher Absatz (treue Übersetzung)",
    "..."
  ],
  "h2Headings": [
    { "afterParagraph": 2, "text": "Deutsche H2-Überschrift, 4–8 Wörter" },
    { "afterParagraph": 5, "text": "Zweite deutsche H2-Überschrift" }
  ]${
    isMultiSource
      ? `,
  "crossValidation": {
    "factsCorroborated": [ "Kurzbeschreibung Fakt 1, der von Primärquelle UND Zusatzquelle bestätigt wird" ],
    "factsSecondaryOnly": [ "Kurzbeschreibung Fakt 2, der nur in der Zusatzquelle steht und ergänzt wurde" ],
    "contradictions": [ "Beschreibung Widerspruch zwischen Primär- und Zusatzquelle (NICHT in Body übernommen)" ]
  }`
      : ''
  }
}

WICHTIG zu h2Headings:
- IMMER 2-3 Einträge. NIE 0 oder 1. "afterParagraph" = Index des Absatzes (1-basiert), NACH dem die H2 eingefügt wird.
- Verteile gleichmäßig: erste H2 nach Absatz 2-3, zweite nach Absatz 5-6, optional dritte nach Absatz 8-9.
- KEINE H2 am Ende (also nicht nach dem allerletzten Absatz). Letzter Absatz bleibt immer Closure ohne darauffolgende Section.`;

  return `Übersetze den folgenden englischen Artikel TREU ins Deutsche für das deutsche Serien-Magazin serien.de.
${primaryBlock}

ABSOLUTE REGELN:
1. STRUKTUR ERHALTEN: Übernimm die Absatzstruktur des Originals 1:1. Wenn das Original 5 Absätze hat, übersetzt du 5 Absätze. Keine neuen Abschnitte, keine zusammengefassten Absätze.
2. STIMME ERHALTEN: Wenn das Original kurze, knackige Sätze hat → kurze deutsche Sätze. Wenn das Original lange Schachtelsätze hat → lange deutsche Sätze. Du imitierst den Rhythmus.
3. ZITATE 1:1: Direktzitate ("...") werden treu übersetzt und behalten die Attribution. Erfinde keine neuen Zitate.
4. H2-PFLICHT: Generiere IMMER 2 bis 3 H2-Sub-Headlines, die echte Lesefluss-Brüche markieren (auch wenn das Original keine hat). H2-Texte sind 4–8 deutsche Wörter, kein Click-Bait, keine Floskeln. Verteile sie gleichmäßig: H2 nach Absatz 2-3, H2 nach Absatz 5-6, optional H2 nach Absatz 8-9. KEINE H2 nach dem letzten Absatz (das ist immer Closure).
5. KEIN AI-DEUTSCH: Verboten sind „genau diese/das", „wirklich", „schlicht", „letztlich", „unmissverständlich", „trotz dieses vermeintlichen", „im Schnitt verschwand", „sorgt für". Schreibe natürliches Magazin-Deutsch.
6. NUR PARAPHRASIERE: Den ALLERERSTEN Satz darfst (und solltest) du leicht paraphrasieren, damit der Lead nicht 1:1 mit dem Original übereinstimmt. Alle anderen Sätze: möglichst wortgetreu.
6a. KEIN DOPPEL-INTRO: Der leadParagraph ist der einzige Intro-/Framing-Block. Der ERSTE Eintrag in bodyParagraphs MUSS direkt mit konkreten Fakten, Quotes oder Details einsteigen — KEIN „Bevor es … wurde, begann …", KEIN „Ein populäres Franchise zu besitzen …", KEIN abstraktes Setup, KEIN Wiederholen des Lead-Themas. Wenn der englische Quelltext zwei Intro-Absätze hat, fasse sie im leadParagraph zusammen und starte bodyParagraphs[0] mit dem ersten konkreten Sach-Absatz.
7. ENGLISCH KOMPLETT WEG: Kein einziges englisches Wort im Output. Ausnahmen: Eigennamen (Personennamen, Seriennamen, Streamernamen wie "Netflix", "Disney+", "Prime Video").
8. KEINE GEDANKENSTRICHE: Keine em-dashes (—) oder en-dashes (–) — nutze Komma, Doppelpunkt oder Punkt. ZITATE: nutze im JSON-Output IMMER SINGLE QUOTES (') für Direktzitate, NIEMALS doppelte Anführungszeichen — sonst bricht das JSON. Beispiel: 'Ich war so: Dan! Oh mein Gott.' (mit Apostroph).
9. BOLD EMPHASIS: Markiere im JSON-Output 2-4 zentrale Schlüssel-Begriffe (Premieren-Daten, Streamer-Name, Hauptfigur, wichtige Zahl) mit **doppelten Sternchen** für Markdown-Bold im finalen Artikel. Nicht übertreiben — max. 1x pro Absatz.

DACH-LOKALISIERUNG:
${streamerHint}
- US-Dollar-Beträge: in Euro umrechnen (×0,92), auf runde Zahlen runden, NUR Euro angeben.
- US-Datumsformate (Tuesday, May 5) → DE-Format ("am 5. Mai" oder "am 5. Mai 2026").
- US-Industrie-Slang (showrunner deal, first-look deal, pickup, pilot order): inhaltlich übersetzen.
- US-Network-Empfangshinweise: nur als Produktionsfakt einmalig, nicht als Schaut-dort-Empfehlung.
${groundingBlock}${multiSourceRules}
${additionalBlocks}

${outputFormat}`;
}

/**
 * Editorial diff layer — gets the LLM-translated paragraphs and applies
 * additional deterministic cleanups that we don't want the LLM to handle
 * (it gets distracted by them in long prompts).
 */
function applyEditorialDiff(paragraph: string, dach?: DachLocalizationContext): string {
  let p = paragraph;

  // Dollar amounts → Euro (only catches obvious patterns; LLM handles most)
  p = p.replace(/(\$|US-?Dollar\s*)(\d+(?:[.,]\d+)?)\s*(Millionen|Milliarden|Million|Milliarde|Mio\.?|Mrd\.?)/gi, (_, _sym, num, unit) => {
    const n = parseFloat(num.replace(',', '.'));
    const eur = Math.round(n * 0.92 * 10) / 10;
    return `${eur.toString().replace('.', ',')} ${unit} Euro`;
  });

  // En-/em-dashes → colon or comma
  p = p.replace(/\s+[—–]\s+/g, ': ');
  p = p.replace(/\b—\b/g, ', ');

  // US weekday-month-day → DE format (best-effort)
  const months: Record<string, string> = {
    January: 'Januar', February: 'Februar', March: 'März', April: 'April',
    May: 'Mai', June: 'Juni', July: 'Juli', August: 'August',
    September: 'September', October: 'Oktober', November: 'November', December: 'Dezember',
  };
  Object.entries(months).forEach(([en, de]) => {
    p = p.replace(new RegExp(`\\b${en}\\s+(\\d{1,2})(st|nd|rd|th)?\\b`, 'g'), (_, day) => `${day}. ${de}`);
    p = p.replace(new RegExp(`\\b${en}\\b`, 'g'), de);
  });

  // Drop leftover English filler sometimes left in by Claude
  p = p.replace(/\bzum Beispiel,\b/g, 'zum Beispiel');
  p = p.replace(/\s+,/g, ',').replace(/\s+\./g, '.');

  // Optional: hint about DACH streamers if paragraph mentions US network only
  if (dach?.streamersDE?.length) {
    const usNet = /\b(ABC|NBC|CBS|Fox|The CW|Hulu)\b/;
    if (usNet.test(p) && !new RegExp(dach.streamersDE.join('|'), 'i').test(p)) {
      // Append a soft DACH-note at the end of the paragraph (rare safety net)
      const suffix = ` In Deutschland ist die Serie aktuell bei ${dach.streamersDE[0]} verfügbar.`;
      // Only if the paragraph doesn't already mention DACH availability
      if (!/in Deutschland|deutsche Zuschauer|hierzulande/i.test(p)) p = p.trimEnd() + suffix;
    }
  }

  return p.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Replace ASCII single quotes (used in LLM JSON output for direct quotes)
 * with proper German typographic quotes „…" — applied AFTER JSON parsing,
 * AFTER escapeHtml, so we don't break either step.
 */
function applyGermanQuotes(s: string): string {
  // Apostrophes inside words (don't, it's) → keep as is
  // Direct quotes: 'Some sentence.' → „Some sentence."
  // We pair greedily: every odd ' becomes „, every even ' becomes "
  let toggle = false;
  return s.replace(/'/g, () => {
    toggle = !toggle;
    return toggle ? '\u201E' : '\u201C';
  });
}

interface LLMOutput {
  headline: string;
  metaDescription: string;
  leadParagraph: string;
  bodyParagraphs: string[];
  h2Headings?: Array<{ afterParagraph: number; text: string }>;
  crossValidation?: {
    factsCorroborated?: string[];
    factsSecondaryOnly?: string[];
    contradictions?: string[];
  };
}

/**
 * Render the AP-style "Mit Berichten von …"-Footer for multi-source synthesis.
 * Inserted INSIDE contentHtml as a small subtle line — not the same as the
 * Reporter's Notebook block (which sits separately, fed by TMDB).
 */
function renderMultiSourceFooter(input: FaithfulTranslatorInput): string {
  const all = [
    { url: input.sourceUrl, publisher: publisherFromUrl(input.sourceUrl) },
    ...(input.additionalSources || []).map((s) => ({
      url: s.url,
      publisher: s.publisher || publisherFromUrl(s.url),
    })),
  ];
  // Dedupe by publisher name (rare case of same outlet twice)
  const seen = new Set<string>();
  const unique = all.filter((s) => {
    const key = s.publisher.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length < 2) return '';
  const linked = unique.map(
    (s) => `<a href="${s.url}" rel="nofollow noopener" target="_blank">${escapeHtml(s.publisher)}</a>`
  );
  const last = linked.pop()!;
  const prefix = linked.length > 0 ? linked.join(', ') + ' und ' : '';
  return `\n<p class="multi-source-footer text-sm text-gray-500 dark:text-gray-400 mt-4 italic">Mit Berichten von ${prefix}${last}.</p>`;
}

function buildHtml(out: LLMOutput, dach?: DachLocalizationContext): {
  html: string;
  wordCount: number;
  paragraphCount: number;
  quotesPreserved: number;
} {
  const parts: string[] = [];
  const allParas: string[] = [out.leadParagraph, ...out.bodyParagraphs];
  const cleanedParas = allParas.map((p) => applyEditorialDiff(p, dach)).filter((p) => p.length > 10);

  // Faithful output keeps H2 inline; convert to one-section-per-H2 layout.
  const h2Map = new Map<number, string>();
  // Cap at 3 entries — generous enough for forced 2-3 H2 rule while
  // still preventing listicle blowout.
  (out.h2Headings || []).slice(0, 3).forEach((h) => {
    if (h.text && typeof h.afterParagraph === 'number') h2Map.set(h.afterParagraph, h.text);
  });

  cleanedParas.forEach((para, idx) => {
    parts.push(`<p>${applyGermanQuotes(escapeHtml(para))}</p>`);
    const oneBased = idx + 1;
    if (h2Map.has(oneBased)) {
      parts.push(`<h2>${applyGermanQuotes(escapeHtml(h2Map.get(oneBased)!))}</h2>`);
    }
  });

  const html = parts.join('\n');
  const wordCount = cleanedParas.join(' ').split(/\s+/).filter(Boolean).length;
  const quotesPreserved = (html.match(/[„"]/g) || []).length;

  return { html, wordCount, paragraphCount: cleanedParas.length, quotesPreserved };
}

/**
 * Main entry. Translates a full source article into a German contentHtml
 * suitable for direct insertion into `articles.contentHtml`.
 */
export async function translateFaithful(
  input: FaithfulTranslatorInput
): Promise<FaithfulArticle> {
  if (!input.sourceText || input.sourceText.trim().length < 200) {
    throw new Error('Source text too short for faithful translation (< 200 chars)');
  }

  const client = createLLMClient();
  const cfg = getLLMConfig();
  const prompt = buildPrompt(input);

  let attempt = 0;
  let lastErr: Error | null = null;
  let parsed: LLMOutput | null = null;

  while (attempt < 2 && !parsed) {
    attempt++;
    try {
      const response = await client.chat.completions.create({
        model: cfg.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 3500,
      });
      const raw = response.choices[0]?.message?.content || '';
      parsed = parseLLMJson(raw) as LLMOutput;
      if (!parsed || !parsed.leadParagraph || !Array.isArray(parsed.bodyParagraphs)) {
        throw new Error('LLM output missing required fields');
      }
    } catch (e: any) {
      lastErr = e;
      parsed = null;
    }
  }

  if (!parsed) {
    throw new Error(`Faithful translation failed after ${attempt} attempts: ${lastErr?.message}`);
  }

  const { html, wordCount, paragraphCount, quotesPreserved } = buildHtml(parsed, input.dach);
  const notes: string[] = [];
  if (wordCount < TARGET_WORDS_MIN) notes.push(`short:${wordCount}`);
  if (wordCount > TARGET_WORDS_MAX) notes.push(`long:${wordCount}`);
  if (quotesPreserved === 0) notes.push('no-quotes');

  // Append AP-style "Mit Berichten von …"-Footer when ≥1 additional source
  // was supplied AND the publishers differ from the primary.
  const isMultiSource = Boolean(input.additionalSources && input.additionalSources.length > 0);
  let finalHtml = html;
  let multiSourceMeta: FaithfulArticle['multiSource'] | undefined;
  if (isMultiSource) {
    const footer = renderMultiSourceFooter(input);
    if (footer) finalHtml = `${html}${footer}`;
    multiSourceMeta = {
      sourceCount: 1 + (input.additionalSources?.length || 0),
      publishers: [
        publisherFromUrl(input.sourceUrl),
        ...(input.additionalSources || []).map((s) => s.publisher || publisherFromUrl(s.url)),
      ],
      crossValidatedFacts: parsed.crossValidation?.factsCorroborated?.length || 0,
      contradictionsFlagged: parsed.crossValidation?.contradictions?.length || 0,
    };
    if (multiSourceMeta.contradictionsFlagged > 0) notes.push(`contradictions:${multiSourceMeta.contradictionsFlagged}`);
  }

  return {
    headline: applyGermanQuotes(parsed.headline.trim()),
    metaDescription: applyGermanQuotes(parsed.metaDescription.trim()),
    leadParagraph: applyGermanQuotes(applyEditorialDiff(parsed.leadParagraph, input.dach)),
    contentHtml: finalHtml,
    wordCount,
    paragraphCount,
    quotesPreserved,
    notes,
    multiSource: multiSourceMeta,
  };
}
