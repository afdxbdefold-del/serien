/**
 * User Question Radar
 *
 * POST /api/admin/question-radar
 * Body: { topic: string, boost?: boolean }
 *
 * Returns ~100 realistic user-intent questions in German, grouped into categories,
 * scored for Search Intent / Discover Potential / Evergreen Potential / Competition,
 * and rendered into 3 article-headline variants each.
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getLLMConfig, parseLLMJson } from '@/lib/llm-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CATEGORIES = [
  'Staffel / Release',
  'Streaming / Availability',
  'Bewertung / Lohnt sich?',
  'Story / Ende erklärt',
  'Cast / Produktion',
  'Empfehlungen',
] as const;

type Competition = 'Low' | 'Medium' | 'High';

interface QuestionItem {
  question: string;
  category: typeof CATEGORIES[number];
  searchIntent: number;
  discoverPotential: number;
  evergreen: number;
  competition: Competition;
  articleHeadlines: string[];
}

function createClient() {
  const { apiKey, baseURL } = getLLMConfig();
  return new OpenAI({ apiKey, baseURL, timeout: 45_000, maxRetries: 0 });
}

async function callLLM(prompt: string, preferredModel: string): Promise<string> {
  const client = createClient();
  // Per handoff: Claude Sonnet is unstable via Emergent proxy → prefer fast gpt-4o-mini,
  // fall back to Claude only if mini fails.
  const modelsToTry = ['gpt-4o-mini', preferredModel];
  let lastError: unknown;
  for (const model of modelsToTry) {
    try {
      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 6000,
        temperature: 0.7,
      });
      return completion.choices[0].message.content || '';
    } catch (e) {
      lastError = e;
      // Continue to next model on any error (timeout, 502, parse fail etc.)
      continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function buildPrompt(topic: string, boost: boolean): string {
  const boostNote = boost ? `

TREND-BOOST: Dieses Topic ist gerade heiß. Priorisiere Fragen zu:
- Aktuelles Startdatum / Verzögerungen
- Cancellation / Verlängerung
- Aktuelle Trailer
- Besetzungsänderungen
- Kontroversen / Reaktionen
- Ende erklärt / Twists
` : '';

  return `Du bist ein deutscher Content-Stratege für serien.de. Dein Ziel: ECHTE Suchintent-Fragen finden, die deutsche User bei Google, YouTube und ChatGPT zu einer Serie/Franchise/Plattform stellen.

TOPIC: "${topic}"${boostNote}

ANWEISUNGEN:
1. Erzeuge EXAKT 30 realistische deutsche Fragen zum Topic — Qualität vor Quantität.
2. Jede Frage muss klingen wie eine echte Google-Suche oder Konversation mit einem KI-Assistenten.
3. PFLICHT: Genau 5 Fragen pro Kategorie, keine Kategorie darf leer sein:
   A) "Staffel / Release" — Release-Datum, Verlängerungen, Cancellation, Anzahl Folgen
   B) "Streaming / Availability" — Wo streamen? Netflix? Prime? Disney+? In Deutschland?
   C) "Bewertung / Lohnt sich?" — Gut? FSK? Für Familien? Besser als X?
   D) "Story / Ende erklärt" — Plot, Twists, Ende, Tod eines Charakters
   E) "Cast / Produktion" — Schauspieler, Showrunner, Drehort, Budget
   F) "Empfehlungen" — Ähnliche Serien, "wenn du X magst, dann..." — PFLICHT: 5 konkrete Alternativ-Serien-Fragen

4. KEINE Duplikate, keine Quatsch-Fragen, keine Fragen ohne Suchvolumen-Potenzial.
5. NATÜRLICHE deutsche Phrasierung. Keine Übersetzungen aus dem Englischen.
6. Priorisiere deutschsprachiges Suchverhalten (DACH): deutsche Sendernamen bevorzugen (Netflix, Prime Video, Disney+, Sky, WOW, RTL+, Joyn).

5. Für JEDE Frage bewerte:
   - searchIntent (1-100): Wie viele Deutsche suchen das aktuell? (100 = Millionen, 50 = mittelgroß, 20 = Nische)
   - discoverPotential (1-100): Wie gut passt das zu Google Discover (emotional + aktuell)? 100 = perfekter Discover-Kandidat
   - evergreen (1-100): Wie lange ist das relevant? (100 = jahrelang, 50 = Monate, 20 = Tage)
   - competition: "Low" | "Medium" | "High" — wie viele etablierte Seiten ranken dafür?

6. Für JEDE Frage generiere 3 konkrete Artikel-Headlines (natürlich, SEO-freundlich, nicht klickbaity-billig).

ANTWORT NUR ALS JSON-ARRAY — keine Einleitung, kein Markdown-Block, nur reines JSON. Beispielformat:

[
  {
    "question": "Wann kommt Fallout Staffel 2?",
    "category": "Staffel / Release",
    "searchIntent": 92,
    "discoverPotential": 88,
    "evergreen": 40,
    "competition": "High",
    "articleHeadlines": [
      "Fallout Staffel 2: Wann startet sie auf Prime Video?",
      "Wann kommt Fallout Staffel 2? Alle Infos zum Release",
      "Fallout Staffel 2 – Release, Cast und Story im Überblick"
    ]
  }
]

WICHTIG: Exakt 30 Einträge, gültiges JSON, keine trailing commas.`;
}

function dedupeAndClean(items: QuestionItem[]): QuestionItem[] {
  const seen = new Set<string>();
  const out: QuestionItem[] = [];
  for (const it of items) {
    if (!it?.question || !it.category) continue;
    const key = it.question.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) continue;
    if (key.length < 5) continue;
    if (!CATEGORIES.includes(it.category)) continue;
    seen.add(key);
    out.push({
      question: it.question.trim(),
      category: it.category,
      searchIntent: clamp(it.searchIntent, 1, 100),
      discoverPotential: clamp(it.discoverPotential, 1, 100),
      evergreen: clamp(it.evergreen, 1, 100),
      competition: ['Low', 'Medium', 'High'].includes(it.competition) ? it.competition : 'Medium',
      articleHeadlines: Array.isArray(it.articleHeadlines) ? it.articleHeadlines.filter(h => typeof h === 'string' && h.trim().length > 10).slice(0, 3) : [],
    });
  }
  return out;
}

function clamp(n: unknown, min: number, max: number): number {
  const v = typeof n === 'number' ? n : parseInt(String(n), 10);
  if (!Number.isFinite(v)) return Math.round((min + max) / 2);
  return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * Recover a truncated JSON array by finding the last `},` or `}]` and closing
 * the array. Used when the LLM output is cut off at max_tokens.
 */
function tryRecoverTruncatedArray(raw: string): QuestionItem[] {
  let content = raw.trim();
  if (content.startsWith('```json')) content = content.slice(7);
  else if (content.startsWith('```')) content = content.slice(3);
  if (content.endsWith('```')) content = content.slice(0, -3);
  content = content.trim();
  const start = content.indexOf('[');
  if (start < 0) return [];
  // Find the last closing brace that is followed by a comma or end-of-array
  // That's our last complete object.
  const slice = content.slice(start);
  // Match all `}` positions
  const closes: number[] = [];
  for (let i = 0; i < slice.length; i++) if (slice[i] === '}') closes.push(i);
  for (let i = closes.length - 1; i >= 0; i--) {
    const candidate = slice.slice(0, closes[i] + 1) + ']';
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as QuestionItem[];
      }
    } catch {
      // Try next-earlier closing brace
    }
  }
  return [];
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
    const prompt = buildPrompt(topic, boost);
    const raw = await callLLM(prompt, model);

    let items: QuestionItem[] = [];
    try {
      const parsed = parseLLMJson(raw);
      if (Array.isArray(parsed)) items = parsed as QuestionItem[];
    } catch (err) {
      // Try to recover truncated JSON arrays: find the last complete object
      // and close the array with ']'.
      items = tryRecoverTruncatedArray(raw);
      if (items.length === 0) {
        return NextResponse.json(
          { error: 'Failed to parse LLM response', raw: raw.substring(0, 500) },
          { status: 502 }
        );
      }
    }

    const cleaned = dedupeAndClean(items);

    if (cleaned.length === 0) {
      return NextResponse.json(
        { error: 'No valid questions generated', raw: raw.substring(0, 500) },
        { status: 502 }
      );
    }

    // Build category breakdown for UI convenience
    const byCategory = CATEGORIES.reduce((acc, cat) => {
      acc[cat] = cleaned.filter(i => i.category === cat).length;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      topic,
      boost,
      total: cleaned.length,
      byCategory,
      generatedAt: new Date().toISOString(),
      items: cleaned,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
