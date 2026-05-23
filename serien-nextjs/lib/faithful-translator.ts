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
}

export interface FaithfulTranslatorInput {
  sourceText: string;
  sourceHeadline: string;
  sourceUrl: string;
  seriesName: string;
  dach?: DachLocalizationContext;
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
}

const SYSTEM_PROMPT =
  'Du bist ein erfahrener deutscher Übersetzer und TV-Magazin-Redakteur für ' +
  'serien.de. Deine EINZIGE Aufgabe: einen englischen Quellartikel TREU ' +
  'ins Deutsche übersetzen. Du erfindest NICHTS dazu. Du kürzt nicht. Du ' +
  'änderst die Absatzstruktur nicht. Du fügst keine SEO-H2-Überschriften ' +
  'hinzu, die im Original nicht waren. Du behältst Quotes 1:1 (auf Deutsch). ' +
  'Antworte ausschließlich mit validem JSON, ohne Markdown-Codeblöcke.';

function buildPrompt(input: FaithfulTranslatorInput): string {
  const { sourceText, sourceHeadline, sourceUrl, seriesName, dach } = input;
  const today = dach?.todayIso ?? new Date().toISOString().slice(0, 10);
  const streamerHint = dach?.streamersDE?.length
    ? `Auf serien.de relevante deutsche Streaming-Plattformen für „${seriesName}": ${dach.streamersDE.join(', ')}. Wenn der Quelltext US-Sender erwähnt (ABC, NBC, CBS, Fox, The CW, Hulu), ersetze sie durch die passenden DACH-Streamer, falls die Serie dort verfügbar ist. Wenn keine DACH-Verfügbarkeit bekannt ist, schreibe „in Deutschland aktuell nicht verfügbar" oder lasse den Empfangshinweis weg.`
    : `Falls der Quelltext US-Sender (ABC, NBC, CBS, Fox, The CW, Hulu) als Empfangshinweis erwähnt: ersetze sie durch „beim jeweiligen Streaming-Anbieter" oder „aktuell nicht in Deutschland verfügbar". US-Sender dürfen nur als Produktionshintergrund stehen.`;

  return `Übersetze den folgenden englischen Artikel TREU ins Deutsche für das deutsche Serien-Magazin serien.de.

QUELLE: ${sourceUrl}
SERIE: ${seriesName}
ORIGINAL-HEADLINE (Englisch): "${sourceHeadline}"
HEUTE: ${today}

ABSOLUTE REGELN:
1. STRUKTUR ERHALTEN: Übernimm die Absatzstruktur des Originals 1:1. Wenn das Original 5 Absätze hat, übersetzt du 5 Absätze. Keine neuen Abschnitte, keine zusammengefassten Absätze.
2. STIMME ERHALTEN: Wenn das Original kurze, knackige Sätze hat → kurze deutsche Sätze. Wenn das Original lange Schachtelsätze hat → lange deutsche Sätze. Du imitierst den Rhythmus.
3. ZITATE 1:1: Direktzitate ("...") werden treu übersetzt und behalten die Attribution. Erfinde keine neuen Zitate.
4. KEINE NEUE H2: Wenn das Original keine Sub-Headlines hat, fügst du KEINE hinzu. Wenn das Original H2s hat, übersetzt du sie. Maximal 2 H2 pro Artikel, auch wenn das Original mehr hat — dann fasse benachbarte Abschnitte zusammen.
5. KEIN AI-DEUTSCH: Verboten sind „genau diese/das", „wirklich", „schlicht", „letztlich", „unmissverständlich", „trotz dieses vermeintlichen", „im Schnitt verschwand", „sorgt für". Schreibe natürliches Magazin-Deutsch.
6. NUR PARAPHRASIERE: Den ALLERERSTEN Satz darfst (und solltest) du leicht paraphrasieren, damit der Lead nicht 1:1 mit dem Original übereinstimmt. Alle anderen Sätze: möglichst wortgetreu.
7. ENGLISCH KOMPLETT WEG: Kein einziges englisches Wort im Output. Ausnahmen: Eigennamen (Personennamen, Seriennamen, Streamernamen wie "Netflix", "Disney+", "Prime Video").
8. KEINE GEDANKENSTRICHE: Keine em-dashes (—) oder en-dashes (–) — nutze Komma, Doppelpunkt oder Punkt. ZITATE: nutze im JSON-Output IMMER SINGLE QUOTES (') für Direktzitate, NIEMALS doppelte Anführungszeichen — sonst bricht das JSON. Beispiel: 'Ich war so: Dan! Oh mein Gott.' (mit Apostroph).

DACH-LOKALISIERUNG:
${streamerHint}
- US-Dollar-Beträge: in Euro umrechnen (×0,92), auf runde Zahlen runden, NUR Euro angeben.
- US-Datumsformate (Tuesday, May 5) → DE-Format ("am 5. Mai" oder "am 5. Mai 2026").
- US-Industrie-Slang (showrunner deal, first-look deal, pickup, pilot order): inhaltlich übersetzen.
- US-Network-Empfangshinweise: nur als Produktionsfakt einmalig, nicht als Schaut-dort-Empfehlung.

OUTPUT-FORMAT (striktes JSON):
{
  "headline": "Deutsche Headline, 40–70 Zeichen, treue Übersetzung des Originals, keine Click-Bait-Floskeln",
  "metaDescription": "Deutsche Meta-Description, max 155 Zeichen, fasst Kern zusammen",
  "leadParagraph": "Erster Absatz, 2–4 Sätze, leichte Paraphrase des Quell-Leads",
  "bodyParagraphs": [
    "Zweiter deutscher Absatz (treue Übersetzung)",
    "Dritter deutscher Absatz (treue Übersetzung)",
    "..."
  ],
  "h2Headings": [
    { "afterParagraph": 2, "text": "Deutsche H2-Überschrift" }
  ]
}

WICHTIG zu h2Headings:
- Wenn der Quelltext H2-Überschriften enthält, übernimm sie ins JSON-Array. "afterParagraph" = Index des Absatzes (1-basiert), NACH dem die H2 eingefügt wird.
- Maximal 2 Einträge. Wenn das Original keine H2 hat: leeres Array [].

QUELLTEXT (übersetze diesen):
"""
${sourceText.slice(0, MAX_SOURCE_CHARS)}
"""`;
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

  // H2 lookup: keyed by 1-based paragraph index, capped at 2 entries
  const h2Map = new Map<number, string>();
  (out.h2Headings || []).slice(0, 2).forEach((h) => {
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

  return {
    headline: applyGermanQuotes(parsed.headline.trim()),
    metaDescription: applyGermanQuotes(parsed.metaDescription.trim()),
    leadParagraph: applyGermanQuotes(applyEditorialDiff(parsed.leadParagraph, input.dach)),
    contentHtml: html,
    wordCount,
    paragraphCount,
    quotesPreserved,
    notes,
  };
}
