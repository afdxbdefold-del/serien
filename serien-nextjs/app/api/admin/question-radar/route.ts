/**
 * User Question Radar — Content Decision Engine
 *
 * POST /api/admin/question-radar
 * Body: { topic: string, boost?: boolean }
 *
 * Returns 30 categorized, fully scored question items for a given topic/franchise.
 * Each item carries SEO / Discover / Social / Monetization / Competition scores,
 * a recommended content format and a trend delta computed from prior runs.
 *
 * Everything comes from ONE Claude Sonnet 4.5 call — no extra LLM cost per field.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig, parseLLMJson } from '@/lib/llm-config';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const CATEGORIES = [
  'Staffel / Release',
  'Streaming / Availability',
  'Bewertung / Lohnt sich?',
  'Story / Ende erklärt',
  'Cast / Produktion',
  'Empfehlungen',
] as const;

const INTENT_TYPES = ['Informational', 'Commercial', 'Navigational', 'Transactional'] as const;
const FORMATS = ['article', 'reel', 'carousel', 'faq'] as const;
const FRESHNESS = ['Evergreen', 'Seasonal', 'Breaking'] as const;

type Competition = 'Low' | 'Medium' | 'High';
type IntentType = typeof INTENT_TYPES[number];
type Format = typeof FORMATS[number];
type Freshness = typeof FRESHNESS[number];

interface QuestionItem {
  question: string;
  category: typeof CATEGORIES[number];
  // Original scores (kept for backward compat)
  searchIntent: number;
  discoverPotential: number;
  evergreen: number;
  competition: Competition;
  articleHeadlines: string[];
  // New scoring dimensions
  intentType: IntentType;
  seoScore: number;
  discoverScore: number;
  socialScore: number;
  monetizationScore: number;
  competitionScore: number;
  freshness: Freshness;
  recommendedFormat: Format;
  // Computed server-side (not LLM)
  trend?: 'up' | 'down' | 'flat' | 'new';
  trendDelta?: number; // discoverScore vs 7d avg
}

function createClient() {
  const config = getLLMConfig();
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

async function callLLM(prompt: string, preferredModel: string): Promise<string> {
  const client = createClient();
  // Claude first (better scoring quality), gpt-4o-mini fallback if proxy 502s.
  // With 2 × 15-item batches the payload is small enough for Claude to finish
  // well under the proxy's 60s timeout.
  const modelsToTry = [preferredModel, 'gpt-4o-mini'];
  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_completion_tokens: 4000,
        temperature: 0.6,
      });
      return completion.choices[0].message.content || '';
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildPrompt(topic: string, boost: boolean, batch: 'A' | 'B'): string {
  const boostNote = boost ? `\n\nTREND-BOOST: Topic ist heiß — Release-Dates, Cancellation, Trailer, Kontroversen priorisieren.` : '';

  const categoryBlock = batch === 'A'
    ? `Genau 5 Fragen pro Kategorie (c-Wert):
1 = Staffel/Release
2 = Streaming/Verfügbarkeit
3 = Bewertung/Lohnt sich`
    : `Genau 5 Fragen pro Kategorie (c-Wert):
4 = Story/Ende erklärt
5 = Cast/Produktion
6 = Empfehlungen`;

  const total = 15;

  return `Du bist deutscher Content-Stratege für serien.de. Erzeuge ${total} realistische deutsche User-Fragen zum Topic.

TOPIC: "${topic}"${boostNote}

PFLICHT: ${categoryBlock}

Antworte NUR als JSON-Array (${total} Einträge, keine Prosa, keine Codeblöcke).

Felder je Eintrag:
- q: string (deutsche User-Frage)
- c: int (Kategorie-Code, siehe oben)
- i: "I"|"C"|"N"|"T" (Informational/Commercial/Navigational/Transactional)
- seo: int 0-100 (Google-SEO-Potenzial)
- disc: int 0-100 (Google-Discover-Potenzial)
- soc: int 0-100 (Viral-Potenzial Reels/TikTok)
- cmp: int 0-100 (Konkurrenz)
- ev: int 0-100 (Evergreen-Faktor)
- f: "E"|"S"|"B" (Evergreen/Seasonal/Breaking)
- fmt: "article"|"reel"|"carousel"|"faq"
- h1, h2, h3: 3 Artikel-Headlines (SEO-freundlich, natürlich deutsch)

Beispiel:
[{"q":"Wann kommt Fallout Staffel 2?","c":1,"i":"I","seo":92,"disc":88,"soc":70,"cmp":80,"ev":40,"f":"S","fmt":"article","h1":"Fallout Staffel 2: Wann startet sie auf Prime Video?","h2":"Wann kommt Fallout Staffel 2? Alle Infos zum Release","h3":"Fallout Staffel 2 – Release, Cast und Story"}]

WICHTIG: Keine Duplikate. Natürliches Deutsch. DACH-Streamer bevorzugen. Exakt ${total} Einträge. Gültiges JSON.`;
}

// Decode compact LLM format back to rich QuestionItem shape.
type CompactItem = {
  q: string; c: number; i: string;
  seo: number; disc: number; soc: number; cmp: number; ev: number;
  f: string; fmt: string;
  h1?: string; h2?: string; h3?: string;
};

const CATEGORY_BY_CODE: Record<number, typeof CATEGORIES[number]> = {
  1: 'Staffel / Release',
  2: 'Streaming / Availability',
  3: 'Bewertung / Lohnt sich?',
  4: 'Story / Ende erklärt',
  5: 'Cast / Produktion',
  6: 'Empfehlungen',
};
const INTENT_BY_CODE: Record<string, IntentType> = {
  I: 'Informational', C: 'Commercial', N: 'Navigational', T: 'Transactional',
};
const FRESHNESS_BY_CODE: Record<string, Freshness> = {
  E: 'Evergreen', S: 'Seasonal', B: 'Breaking',
};

function expandCompact(items: CompactItem[]): Partial<QuestionItem>[] {
  return items.map(it => {
    const category = CATEGORY_BY_CODE[it.c] || 'Staffel / Release';
    const intentType = INTENT_BY_CODE[it.i] || 'Informational';
    const cmp = clamp(it.cmp, 0, 100);
    const competition: Competition = cmp >= 67 ? 'High' : cmp >= 34 ? 'Medium' : 'Low';
    const seo = clamp(it.seo, 0, 100);
    const soc = clamp(it.soc, 0, 100);
    // Monetization = seo × intent-multiplier (Commercial/Transactional pay more).
    const intentMultiplier = intentType === 'Transactional' ? 1.1
      : intentType === 'Commercial' ? 1.0
      : intentType === 'Navigational' ? 0.8 : 0.7;
    const monetizationScore = clamp(Math.round(seo * intentMultiplier), 0, 100);
    return {
      question: it.q,
      category,
      intentType,
      seoScore: seo,
      discoverScore: clamp(it.disc, 0, 100),
      socialScore: soc,
      competitionScore: cmp,
      monetizationScore,
      searchIntent: seo,
      discoverPotential: clamp(it.disc, 0, 100),
      evergreen: clamp(it.ev, 0, 100),
      competition,
      freshness: FRESHNESS_BY_CODE[it.f] || 'Evergreen',
      recommendedFormat: oneOf(it.fmt, FORMATS, 'article'),
      articleHeadlines: [it.h1, it.h2, it.h3].filter(
        (x): x is string => typeof x === 'string' && x.trim().length > 10
      ).slice(0, 3),
    };
  });
}

function clamp(n: unknown, min: number, max: number): number {
  const v = typeof n === 'number' ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, Math.round(v)));
}

function oneOf<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  return options.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function dedupeAndClean(items: Partial<QuestionItem>[]): QuestionItem[] {
  const seen = new Set<string>();
  const out: QuestionItem[] = [];
  for (const it of items) {
    if (!it?.question || !it.category) continue;
    const key = it.question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    if (key.length < 5) continue;
    if (!CATEGORIES.includes(it.category as typeof CATEGORIES[number])) continue;
    seen.add(key);

    const comp = oneOf(it.competition, ['Low', 'Medium', 'High'] as const, 'Medium');
    const competitionScore = clamp(it.competitionScore ?? (comp === 'High' ? 80 : comp === 'Medium' ? 50 : 25), 0, 100);

    out.push({
      question: it.question.trim(),
      category: it.category as typeof CATEGORIES[number],
      searchIntent: clamp(it.searchIntent, 1, 100),
      discoverPotential: clamp(it.discoverPotential, 1, 100),
      evergreen: clamp(it.evergreen, 1, 100),
      competition: comp,
      articleHeadlines: Array.isArray(it.articleHeadlines)
        ? it.articleHeadlines.filter(h => typeof h === 'string' && h.trim().length > 10).slice(0, 3)
        : [],
      intentType: oneOf(it.intentType, INTENT_TYPES, 'Informational'),
      seoScore: clamp(it.seoScore ?? it.searchIntent, 0, 100),
      discoverScore: clamp(it.discoverScore ?? it.discoverPotential, 0, 100),
      socialScore: clamp(it.socialScore, 0, 100),
      monetizationScore: clamp(it.monetizationScore, 0, 100),
      competitionScore,
      freshness: oneOf(it.freshness, FRESHNESS, 'Evergreen'),
      recommendedFormat: oneOf(it.recommendedFormat, FORMATS, 'article'),
    });
  }
  return out;
}

/**
 * Recover a truncated JSON array — used when the LLM gets cut off at max_tokens.
 */
function tryRecoverTruncatedArray(raw: string): Partial<QuestionItem>[] {
  let content = raw.trim();
  if (content.startsWith('```json')) content = content.slice(7);
  else if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();
  const start = content.indexOf('[');
  if (start < 0) return [];
  const slice = content.slice(start);
  const closes: number[] = [];
  for (let i = 0; i < slice.length; i++) if (slice[i] === '}') closes.push(i);
  for (let i = closes.length - 1; i >= 0; i--) {
    const candidate = slice.slice(0, closes[i] + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Partial<QuestionItem>[];
    } catch { /* try next */ }
  }
  return [];
}

function normalizeTopicKey(topic: string): string {
  return topic.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

function normalizeQuestionKey(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Compute trend delta for each item based on prior runs of the same topic.
 * Compares current discoverScore vs. avg discoverScore from runs in [7d, 30d] ago.
 */
async function applyTrendHistory(topicKey: string, items: QuestionItem[]): Promise<QuestionItem[]> {
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

  try {
    const priorRuns = await prisma.radar_runs.findMany({
      where: { topicKey, createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
      select: { items: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (priorRuns.length === 0) {
      return items.map(i => ({ ...i, trend: 'new' as const, trendDelta: 0 }));
    }

    const priorByQuestion = new Map<string, number[]>();
    for (const run of priorRuns) {
      const arr = Array.isArray(run.items) ? (run.items as unknown as QuestionItem[]) : [];
      for (const it of arr) {
        if (!it?.question) continue;
        const k = normalizeQuestionKey(it.question);
        const score = typeof it.discoverScore === 'number' ? it.discoverScore : it.discoverPotential;
        if (typeof score !== 'number') continue;
        const bucket = priorByQuestion.get(k) || [];
        bucket.push(score);
        priorByQuestion.set(k, bucket);
      }
    }

    return items.map(item => {
      const k = normalizeQuestionKey(item.question);
      const prior = priorByQuestion.get(k);
      if (!prior || prior.length === 0) {
        return { ...item, trend: 'new' as const, trendDelta: 0 };
      }
      const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
      const delta = Math.round(item.discoverScore - priorAvg);
      const trend: 'up' | 'down' | 'flat' = delta > 5 ? 'up' : delta < -5 ? 'down' : 'flat';
      return { ...item, trend, trendDelta: delta };
    });
  } catch (e) {
    console.warn('[radar] trend history lookup failed:', e);
    return items.map(i => ({ ...i, trend: 'new' as const, trendDelta: 0 }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const topic = (body?.topic || '').toString().trim();
    const boost = !!body?.boost;

    if (!topic || topic.length < 2 || topic.length > 80) {
      return NextResponse.json(
        { error: 'Invalid topic: must be between 2 and 80 characters' },
        { status: 400 }
      );
    }

    const { model } = getLLMConfig();
    // Parallel generation — 2 × 15 items is reliably under proxy timeout,
    // whereas a single 30-item call consistently 502s.
    const [rawA, rawB] = await Promise.all([
      callLLM(buildPrompt(topic, boost, 'A'), model),
      callLLM(buildPrompt(topic, boost, 'B'), model),
    ]);

    const compact: CompactItem[] = [];
    for (const raw of [rawA, rawB]) {
      try {
        const parsed = parseLLMJson(raw);
        if (Array.isArray(parsed)) compact.push(...(parsed as CompactItem[]));
      } catch {
        const recovered = tryRecoverTruncatedArray(raw);
        compact.push(...(recovered as unknown as CompactItem[]));
      }
    }

    if (compact.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse LLM response' },
        { status: 502 }
      );
    }

    const expanded = expandCompact(compact);
    const cleaned = dedupeAndClean(expanded);

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'No valid questions generated', raw: raw.substring(0, 500) },
        { status: 502 }
      );
    }

    const topicKey = normalizeTopicKey(topic);
    const withTrend = await applyTrendHistory(topicKey, cleaned);

    // Persist run for future trend analysis (fire-and-forget tolerated)
    try {
      await prisma.radar_runs.create({
        data: {
          topic,
          topicKey,
          boost,
          items: withTrend as unknown as object,
        },
      });
    } catch (e) {
      console.warn('[radar] failed to persist run:', e);
    }

    const byCategory = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = withTrend.filter(i => i.category === cat).length;
      return acc;
    }, {} as Record<string, number>);

    const byFormat = FORMATS.reduce((acc, fmt) => {
      acc[fmt] = withTrend.filter(i => i.recommendedFormat === fmt).length;
      return acc;
    }, {} as Record<Format, number>);

    return NextResponse.json({
      topic,
      topicKey,
      boost,
      total: withTrend.length,
      byCategory,
      byFormat,
      generatedAt: new Date().toISOString(),
      items: withTrend,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
