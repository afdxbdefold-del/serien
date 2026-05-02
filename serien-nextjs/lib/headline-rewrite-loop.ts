/**
 * HEADLINE REWRITE LOOP (v5.3 — combined Hygiene + Performance, iterative)
 *
 * Goal: push every headline toward the joint 60/60 Discover-Gate ceiling
 * (30 Hygiene + 30 Performance).
 *
 * Design:
 *  - ONE scorer call per iteration measures BOTH dimensions.
 *  - If combined < TARGET and gap > 0, we hand the failed checks to Claude
 *    as a focused fix-list + require ALL "Winning Rules".
 *  - We pick the best of 5 candidates and repeat up to MAX_ATTEMPTS times.
 *  - Stop early when combined >= TARGET or no gain vs. previous round.
 *  - Pipeline metadata (rewriteOutcome) reports per-iteration scores so the
 *    admin dashboard can audit the climb.
 */
import { discoverGate } from './discover-gate';
import { stripDashes } from './strip-dashes';
import { detectHeadlineContradiction } from './headline-contradiction';

export interface RewriteInput {
  originalHeadline: string;
  seriesName: string;
  articleContent: string; // markdown or plain text, first ~2000 chars used
  beforeScore: number; // DEPRECATED: kept for backwards compat (= performance only)
  beforeReasons: string[]; // DEPRECATED: kept for backwards compat (= performance only)
  beforeHygieneScore?: number;       // v5.3: 0–30
  beforeHygieneReasons?: string[];   // v5.3
  beforePerformanceScore?: number;   // v5.3: 0–30 (same number as beforeScore when supplied)
  beforePerformanceReasons?: string[]; // v5.3 (same array as beforeReasons when supplied)
}

interface IterationResult {
  attempt: number;
  picked: string;
  hygiene: number;
  performance: number;
  combined: number;
  candidates: Array<{ text: string; hygiene: number; performance: number; combined: number }>;
}

export interface RewriteOutput {
  attempted: boolean;
  applied: boolean;
  originalHeadline: string;
  finalHeadline: string;
  beforePerformance: number;
  afterPerformance: number;
  beforeHygiene?: number;            // v5.3
  afterHygiene?: number;             // v5.3
  beforeCombined?: number;           // v5.3
  afterCombined?: number;            // v5.3
  gain: number;                      // combined gain after all iterations
  candidates: Array<{ text: string; performance: number; hygiene?: number; combined?: number }>;
  iterations?: IterationResult[];    // v5.3: every attempt for audit
  durationMs: number;
  errorMessage?: string;
}

// v5.3: Fire iff combined < TRIGGER_COMBINED. 55/60 target ≈ "both sides well in the green".
const TRIGGER_COMBINED = 55;   // combined < 55 → rewrite kicks in
const TARGET_COMBINED  = 55;   // combined >= 55 → stop iterating
const MAX_ATTEMPTS     = 3;    // LLM budget cap

/**
 * Build a focused rewrite prompt from the failed Hygiene + Performance checks.
 */
function buildRewritePrompt(opts: {
  originalHeadline: string;
  seriesName: string;
  articleContent: string;
  hygieneReasons: string[];
  performanceReasons: string[];
  attemptNumber: number;
}): string {
  const allIssues = [
    ...opts.hygieneReasons.map((r) => `• [Hygiene] ${r}`),
    ...opts.performanceReasons.map((r) => `• [Performance] ${r}`),
  ].join('\n');
  const attemptHint = opts.attemptNumber > 1
    ? `\n(Vorherige ${opts.attemptNumber - 1} Versuche haben die Probleme noch nicht voll gelöst. Beseitige ALLE aufgelisteten Blocker diesmal.)`
    : '';

  return `Du bist Chef-vom-Dienst bei einem deutschen Serien-Magazin. Schreibe für Google Discover.

Deine aktuelle Headline hat Schwächen und muss neu geschrieben werden.${attemptHint}

ORIGINAL-HEADLINE:
"${opts.originalHeadline}"

KONKRETE PROBLEME (JEDES muss fix sein):
${allIssues || '• Combined Score unter Ziel — verbessere Klarheit, News-Wert und Hook'}

SERIE:
"${opts.seriesName}"

ARTIKEL-KONTEXT (die ersten Absätze):
${opts.articleContent.slice(0, 1500)}

====================================================================
HYGIENE-PFLICHT (Hard Requirements — keine Ausnahmen):
====================================================================
H1. Serienname "${opts.seriesName}" MUSS wörtlich enthalten sein
    (klein-/groß-Schreibung egal, kein Alias).
H2. News-Wert-Signal MUSS enthalten sein — mindestens EINES von:
    Promo: bestätigt, startet, endet, angekündigt, veröffentlicht, beendet, erhält, verlängert, abgesetzt, verschoben
    Ereignis: kehrt zurück, verlässt, feuert, streicht, überrascht, triumphiert, scheitert, trennt sich, kippt, dreht, stirbt, schockt, bricht, eskaliert
    Feature-Lead: Warum, Darum, Was, Wie
H3. Länge 45–90 Zeichen (Discover Mobile Sweet Spot, max. 100).
H4. Kein Clickbait ohne Fakt, keine doppelten Wörter, kein "offiziell bestätigt", "im Überblick", "alles was ihr wissen müsst".

====================================================================
PERFORMANCE-REGELN — jeder Kandidat muss alle erfüllen:
====================================================================
P1. SCROLL-STOP START: Beginne mit Eigenname, Zahl, "Warum/Darum/Was/Wie", oder starkem Verb.
    VERBOTEN am Anfang: Die, Der, Das, In, Auf, Nach, Mit, Ist.
P2. OPEN LOOP: Lass etwas offen ("Warum …", "Darum …", "Was hinter …", "Wie …") — aber OHNE Komma-Formel.
P3. EMOTION: Konkrete Emotion, keine Hype-Wörter. Erlaubt: Abschied, Rückkehr, Krise, Schock, Wende, Comeback, Verrat, Triumph, Trauer, Eskalation.
P4. STARKES VERB — nicht ist/hat/gibt/kommt.
P5. NATÜRLICHE SPRACHE: nie "offiziell bestätigt", "im Überblick", "verständlich erklärt".
P6. KEINE SCORE-REVEALS: Rotten Tomatoes, Metacritic, IMDb, NN %, NN Prozent, N,N/10 sind verboten.
P7. KEIN COLON-LABEL: kein "Serie: Staffel X bestätigt" — Aussagesatz.
P8. KEINE AI-SLOP-FORMEL: NIE "X enthüllt, warum Y" / "X verrät, was Y" / "X zeigt, weshalb Y".
    NIE "verändert alles" / "stellt alles auf den Kopf".
P9. KEINE Gedankenstriche (— oder –). Nutze Komma, Punkt oder Doppelpunkt.
P10. KEIN MEINUNGS-SOUND — wir sind eine NEWS-Site, keine Kolumne.
    VERBOTEN: erste Person ("ich", "mir", "mich", "mein", "unser") überall.
    VERBOTEN: Imperativ an den Leser ("solltest du", "müsst ihr sehen", "darfst nicht verpassen", "unbedingt streamen").
    VERBOTEN: editorialisierender Auftakt ("Endlich …", "Zum Glück …", "Leider …", "Ein Hoch auf …", "Bravo …", "Bitte mehr …").
    VERBOTEN: Verdikt-Phrasen ("muss man gesehen haben", "gehört zu den besten", "Pflichtprogramm", "ein Muss für", "perfekteste", "beste Serie aller Zeiten").
    VERBOTEN: Personal-Stance ("verzaubert mich", "überzeugt mich", "beeindruckt mich", "ich finde", "meiner Meinung").
    ERLAUBT bleibt Drittpersonen-Emotion ("Hacks erschüttert Zuschauer", "Wednesday packt mit Wendung")
    und Neugier-Hooks ("Warum X scheitert", "Darum kehrt Y zurück") — solange neutral berichtet.

P11. ERÖFFNUNGS-DIVERSITÄT — STARTE die Headline NICHT automatisch mit "Warum" oder "Darum".
    Diese beiden Wörter sind aktuell überrepräsentiert. Wenn der Output "Warum"/"Darum"
    als erstes Wort hatte, wähle für die Rewrite-Variante eine andere Eröffnung:
    Eigenname+Verb ("Hacks erschüttert …"), Faktenmeldung ("Netflix bestätigt …"),
    Zeit-Anker ("Ab Dezember kehrt …"), Frage ("Wer überlebt …") oder Zahl-Listen-Lead.
    "Warum/Darum" ist erst zulässig, wenn keine andere Eröffnung den Aufhänger trifft.

====================================================================
AUFGABE
====================================================================
Gib 5 komplett neue Varianten zurück, die ALLE Probleme beheben
und ALLE Hygiene- + Performance-Regeln erfüllen.

Antworte NUR mit validem JSON-Array (kein Markdown, kein Kommentar):
[
  { "text": "Erste Variante …" },
  { "text": "Zweite Variante …" },
  { "text": "Dritte Variante …" },
  { "text": "Vierte Variante …" },
  { "text": "Fünfte Variante …" }
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
 * Score a single headline against BOTH Hygiene + Performance in ONE gate call.
 */
async function scoreBoth(headline: string, seriesName: string, content: string): Promise<{
  hygiene: number;
  hygieneReasons: string[];
  performance: number;
  performanceReasons: string[];
  combined: number;
}> {
  const result = await discoverGate({
    final_headline: headline,
    article_html: `<p>${content.slice(0, 800)}</p>`,
    hero_image_metadata: { url: '', width: 1920, height: 1080, source: 'TMDB_BACKDROP' as const },
    publishedAt: new Date(),
    primary_series: seriesName,
  });
  const h = result.dashboard.headline.score;
  const p = result.dashboard.headline_performance.score;
  return {
    hygiene: h,
    hygieneReasons: result.dashboard.headline.reasons,
    performance: p,
    performanceReasons: result.dashboard.headline_performance.reasons,
    combined: h + p,
  };
}

export async function rewriteHeadlineIfWeak(input: RewriteInput): Promise<RewriteOutput> {
  const start = Date.now();

  // --- Prepare baseline scores (use supplied values if caller already scored, else score now)
  const beforeHygieneScore =
    input.beforeHygieneScore ??
    (await scoreBoth(input.originalHeadline, input.seriesName, input.articleContent)).hygiene;
  const beforeHygieneReasons = input.beforeHygieneReasons ?? [];
  const beforePerformanceScore = input.beforePerformanceScore ?? input.beforeScore;
  const beforePerformanceReasons = input.beforePerformanceReasons ?? input.beforeReasons;
  const beforeCombined = beforeHygieneScore + beforePerformanceScore;

  // Short-circuit: already above target AND no headline/body contradiction.
  const baselineContradiction = detectHeadlineContradiction(
    input.originalHeadline,
    input.articleContent,
  );
  if (beforeCombined >= TRIGGER_COMBINED && !baselineContradiction.contradicted) {
    return {
      attempted: false,
      applied: false,
      originalHeadline: input.originalHeadline,
      finalHeadline: input.originalHeadline,
      beforePerformance: beforePerformanceScore,
      afterPerformance: beforePerformanceScore,
      beforeHygiene: beforeHygieneScore,
      afterHygiene: beforeHygieneScore,
      beforeCombined,
      afterCombined: beforeCombined,
      gain: 0,
      candidates: [],
      iterations: [],
      durationMs: 0,
    };
  }

  const iterations: IterationResult[] = [];
  let bestHeadline = input.originalHeadline;
  let bestHygiene = beforeHygieneScore;
  let bestPerformance = beforePerformanceScore;
  let bestCombined = beforeCombined;
  let bestContradicted = baselineContradiction.contradicted;
  let currentHygieneReasons = beforeHygieneReasons;
  let currentPerformanceReasons = baselineContradiction.contradicted
    ? [
        ...beforePerformanceReasons,
        `Widerspruch zum Body (${baselineContradiction.reason}): Headline behauptet "${baselineContradiction.claim}", Body sagt "${baselineContradiction.disclaimer}". Vermeide diese Behauptung.`,
      ]
    : beforePerformanceReasons;
  let lastAppliedError: string | undefined;

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (bestCombined >= TARGET_COMBINED && !bestContradicted) break;

      const prompt = buildRewritePrompt({
        originalHeadline: bestHeadline,
        seriesName: input.seriesName,
        articleContent: input.articleContent,
        hygieneReasons: currentHygieneReasons,
        performanceReasons: currentPerformanceReasons,
        attemptNumber: attempt,
      });

      const rawCandidates = await callLLMForRewrite(prompt, input.seriesName);
      if (rawCandidates.length === 0) {
        lastAppliedError = 'LLM returned no candidates';
        break;
      }

      const scored = await Promise.all(
        rawCandidates.map(async (text) => {
          const s = await scoreBoth(text, input.seriesName, input.articleContent);
          const contra = detectHeadlineContradiction(text, input.articleContent);
          return {
            text,
            hygiene: s.hygiene,
            performance: s.performance,
            combined: s.combined,
            hygieneReasons: s.hygieneReasons,
            performanceReasons: s.performanceReasons,
            contradicted: contra.contradicted,
            contradictionReason: contra.reason,
          };
        })
      );
      // Sort: non-contradicting candidates first, then by combined score.
      scored.sort((a, b) => {
        if (a.contradicted !== b.contradicted) return a.contradicted ? 1 : -1;
        return b.combined - a.combined;
      });
      const top = scored[0];

      iterations.push({
        attempt,
        picked: top.text,
        hygiene: top.hygiene,
        performance: top.performance,
        combined: top.combined,
        candidates: scored.map((c) => ({ text: c.text, hygiene: c.hygiene, performance: c.performance, combined: c.combined })),
      });

      // Apply if (a) it's strictly better, or (b) it resolves a contradiction without losing more than 4 points.
      const resolvesContradiction = bestContradicted && !top.contradicted;
      const acceptableScoreDrop = resolvesContradiction && top.combined >= bestCombined - 4;
      if (top.combined > bestCombined || acceptableScoreDrop) {
        bestHeadline = top.text;
        bestHygiene = top.hygiene;
        bestPerformance = top.performance;
        bestCombined = top.combined;
        bestContradicted = top.contradicted;
        currentHygieneReasons = top.hygieneReasons;
        currentPerformanceReasons = top.contradicted
          ? [
              ...top.performanceReasons,
              `Widerspruch bleibt (${top.contradictionReason ?? 'unklar'}). Streiche die Überraschungs-/Sensations-Behauptung.`,
            ]
          : top.performanceReasons;
      } else {
        // No gain this round → further iterations unlikely to help.
        break;
      }
    }
  } catch (error: any) {
    lastAppliedError = error?.message || 'Unknown error';
  }

  const applied = bestHeadline !== input.originalHeadline;
  return {
    attempted: iterations.length > 0 || !!lastAppliedError,
    applied,
    originalHeadline: input.originalHeadline,
    finalHeadline: applied ? bestHeadline : input.originalHeadline,
    beforePerformance: beforePerformanceScore,
    afterPerformance: applied ? bestPerformance : beforePerformanceScore,
    beforeHygiene: beforeHygieneScore,
    afterHygiene: applied ? bestHygiene : beforeHygieneScore,
    beforeCombined,
    afterCombined: applied ? bestCombined : beforeCombined,
    gain: applied ? bestCombined - beforeCombined : 0,
    candidates: iterations.flatMap((it) => it.candidates.map((c) => ({ text: c.text, performance: c.performance, hygiene: c.hygiene, combined: c.combined }))),
    iterations,
    durationMs: Date.now() - start,
    errorMessage: lastAppliedError,
  };
}
