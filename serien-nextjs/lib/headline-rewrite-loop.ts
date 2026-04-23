/**
 * HEADLINE REWRITE LOOP
 *
 * Turns the Discover-Gate scorer from pure gatekeeper into a coach.
 * When a headline scores below the Performance threshold, we hand the
 * specific failed checks back to Claude as fix-instructions and ask for
 * 5 new variants that address exactly those blockers.
 *
 * - Max 1 retry per article (keeps LLM cost bounded).
 * - Only rewrites PERFORMANCE weaknesses. Hygiene failures (clickbait,
 *   missing series name, duplicates) are hard blockers and not rewritten.
 * - Returns both scores so the Admin dashboard can A/B the gains.
 */
import { discoverGate } from './discover-gate';
import { stripDashes } from './strip-dashes';

export interface RewriteInput {
  originalHeadline: string;
  seriesName: string;
  articleContent: string; // markdown or plain text, first ~2000 chars used
  beforeScore: number; // Performance score of original (0-30)
  beforeReasons: string[]; // Performance reasons from gate
}

export interface RewriteOutput {
  attempted: boolean;
  applied: boolean;
  originalHeadline: string;
  finalHeadline: string;
  beforePerformance: number;
  afterPerformance: number;
  gain: number;
  candidates: Array<{ text: string; performance: number }>;
  durationMs: number;
  errorMessage?: string;
}

const PERFORMANCE_THRESHOLD = 22; // Rewrite trigger. Headlines with score < 22/30 enter the rewrite loop.
                                  // Gate verdict in discover-gate.ts remains 18/30 (PASS).
                                  // Gap 18–21 = "passes publication bar, but still coached for CTR uplift".

/**
 * Build a focused rewrite prompt from the failed checks.
 */
function buildRewritePrompt(input: RewriteInput): string {
  const issues = input.beforeReasons.map((r) => `• ${r}`).join('\n');

  return `Du bist Chef-vom-Dienst bei einem deutschen Serien-Magazin. Schreibe für Google Discover.

Deine aktuelle Headline hat Schwächen und muss neu geschrieben werden.

ORIGINAL-HEADLINE:
"${input.originalHeadline}"

KONKRETE PROBLEME (die du JEDES fixen musst):
${issues}

SERIE:
"${input.seriesName}"

ARTIKEL-KONTEXT (die ersten Absätze):
${input.articleContent.slice(0, 1500)}

====================================================================
WINNING-HEADLINE-REGELN — jeder Kandidat muss alle diese erfüllen:
====================================================================
1. SCROLL-STOP START: Beginne mit Eigenname, Zahl oder starkem Verb.
   VERBOTEN am Anfang: Die, Der, Das, In, Auf, Nach, Mit, Ist.
2. OPEN LOOP: Lass etwas offen. Nutze "Warum ...", "Darum ...",
   "Was hinter ... steckt", "Deshalb ...", "Wie ..." — NICHT alles verraten.
3. EMOTION: Konkrete Emotion, KEINE Hype-Wörter.
   ERLAUBT: Abschied, Rückkehr, Krise, Schock, Wende, Comeback, Verrat,
   Triumph, Trauer, Eskalation, Aus.
   VERBOTEN: mega, unglaublich, spektakulär, sensationell, "Fans freuen sich".
4. STARKES VERB: kippt, streicht, verlässt, enthüllt, feuert, stoppt,
   bricht, überrascht, verliert, triumphiert — NICHT ist/hat/gibt/kommt.
5. NATÜRLICHE SPRACHE: NIE "offiziell bestätigt", "im Überblick",
   "verständlich erklärt", "alles was ihr wissen müsst".
6. KEIN COLON-LABEL: Nicht "Serie: Detail bestätigt" — Aussagesatz.
7. Länge 40–65 Zeichen.
8. Serienname "${input.seriesName}" MUSS enthalten sein.
9. KEINE Gedankenstriche (— oder –). Nutze Komma, Punkt oder Doppelpunkt.

====================================================================
AUFGABE
====================================================================
Gib 5 komplett neue Varianten zurück, die ALLE genannten Probleme
beheben und ALLE Winning-Regeln erfüllen.

Antworte NUR mit validem JSON-Array (kein Markdown, kein Kommentar):
[
  { "text": "Erste Variante ..." },
  { "text": "Zweite Variante ..." },
  { "text": "Dritte Variante ..." },
  { "text": "Vierte Variante ..." },
  { "text": "Fünfte Variante ..." }
]`;
}

async function callLLMForRewrite(prompt: string, seriesName: string): Promise<string[]> {
  const { createLLMClient, getLLMConfig, parseLLMJson } = await import('./llm-config');
  const client = createLLMClient();
  const config = getLLMConfig();

  const response = await client.chat.completions.create({
    model: config.model,
    temperature: 0.85,
    messages: [
      {
        role: 'system',
        content: 'Du bist ein deutscher Chef-vom-Dienst für Serien-Journalismus. Du schreibst für Google Discover. Antworte NUR mit validem JSON-Array.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const text = response.choices?.[0]?.message?.content?.trim() || '';
  const parsed = parseLLMJson(text);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item: any) => (typeof item?.text === 'string' ? stripDashes(item.text.trim(), [seriesName]) : null))
    .filter((t: string | null): t is string => !!t && t.length > 0);
}

/**
 * Score a single headline against the Performance dimension only.
 * Uses discoverGate() internally with minimal inputs; only the
 * headline_performance slice is read out.
 */
async function scorePerformanceOnly(headline: string, seriesName: string, content: string): Promise<{ score: number; reasons: string[] }> {
  const result = await discoverGate({
    final_headline: headline,
    article_html: `<p>${content.slice(0, 800)}</p>`,
    hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
    publishedAt: new Date(),
    primary_series: seriesName,
  });
  return {
    score: result.dashboard.headline_performance.score,
    reasons: result.dashboard.headline_performance.reasons,
  };
}

export async function rewriteHeadlineIfWeak(input: RewriteInput): Promise<RewriteOutput> {
  const start = Date.now();

  // Short-circuit: headline already meets performance threshold.
  if (input.beforeScore >= PERFORMANCE_THRESHOLD) {
    return {
      attempted: false,
      applied: false,
      originalHeadline: input.originalHeadline,
      finalHeadline: input.originalHeadline,
      beforePerformance: input.beforeScore,
      afterPerformance: input.beforeScore,
      gain: 0,
      candidates: [],
      durationMs: 0,
    };
  }

  try {
    const prompt = buildRewritePrompt(input);
    const rawCandidates = await callLLMForRewrite(prompt, input.seriesName);

    if (rawCandidates.length === 0) {
      return {
        attempted: true,
        applied: false,
        originalHeadline: input.originalHeadline,
        finalHeadline: input.originalHeadline,
        beforePerformance: input.beforeScore,
        afterPerformance: input.beforeScore,
        gain: 0,
        candidates: [],
        durationMs: Date.now() - start,
        errorMessage: 'LLM returned no candidates',
      };
    }

    // Score all rewritten candidates and pick the best.
    const scored = await Promise.all(
      rawCandidates.map(async (text) => ({
        text,
        performance: (await scorePerformanceOnly(text, input.seriesName, input.articleContent)).score,
      })),
    );

    scored.sort((a, b) => b.performance - a.performance);
    const best = scored[0];

    const applied = best.performance > input.beforeScore;
    const finalHeadline = applied ? best.text : input.originalHeadline;

    return {
      attempted: true,
      applied,
      originalHeadline: input.originalHeadline,
      finalHeadline,
      beforePerformance: input.beforeScore,
      afterPerformance: applied ? best.performance : input.beforeScore,
      gain: applied ? best.performance - input.beforeScore : 0,
      candidates: scored,
      durationMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      attempted: true,
      applied: false,
      originalHeadline: input.originalHeadline,
      finalHeadline: input.originalHeadline,
      beforePerformance: input.beforeScore,
      afterPerformance: input.beforeScore,
      gain: 0,
      candidates: [],
      durationMs: Date.now() - start,
      errorMessage: error?.message || 'Unknown error',
    };
  }
}
