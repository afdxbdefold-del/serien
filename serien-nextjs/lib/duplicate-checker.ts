/**
 * DUPLICATE CHECKER - LLM-basierte Themen-Deduplizierung
 * 
 * Verhindert doppelte Artikel zum GLEICHEN THEMA,
 * erlaubt aber verschiedene Themen zur gleichen Serie.
 * 
 * Beispiel:
 * ✅ "Harry Potter Trailer bricht Rekorde" + "HP Casting-News" = OK (verschiedene Themen)
 * ⛔ "Harry Potter Trailer bricht Rekorde" + "HP Rekord-Trailer" = DUPLIKAT (gleiches Thema)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Topic categories for better classification
const TOPIC_CATEGORIES = [
  'CASTING',        // Neue Schauspieler, Absagen, Bestätigungen
  'TRAILER',        // Veröffentlichung, Reaktionen, Rekorde
  'STAFFEL',        // Ankündigung, Verlängerung, Absetzung
  'EPISODE',        // Recap, Analyse, Bewertung einer Episode
  'PRODUKTION',     // Drehstart, Behind-Scenes, Verzögerung
  'STORY',          // Plot-Leaks, Fan-Theorien, Erklärungen
  'KRITIK',         // Reviews, Ratings, Kritiker-Meinungen
  'STREAMING',      // Plattform-Wechsel, Verfügbarkeit
  'AWARD',          // Nominierungen, Gewinne
  'INTERVIEW',      // Schauspieler/Creator Interviews
  'SONSTIGES'       // Alles andere
] as const;

type TopicCategory = typeof TOPIC_CATEGORIES[number];

interface DuplicateCheckResult {
  isDuplicate: boolean;
  topicCategory: TopicCategory;
  coreEvent: string;
  duplicateOf: string | null;
  reason: string;
  confidence: number;
}

interface ExistingArticle {
  slug: string;
  title: string;
  excerpt: string | null;
}

/**
 * Normalize text for Jaccard / core-event comparison.
 */
function normalizeTerms(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[„""'''`]/g, '')
    .replace(/[^a-z0-9äöüß]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 2);
}

function jaccard(aWords: string[], bWords: string[]): number {
  if (!aWords.length || !bWords.length) return 0;
  const a = new Set(aWords);
  const b = new Set(bWords);
  const inter = Array.from(a).filter((x) => b.has(x)).length;
  const union = new Set([...Array.from(a), ...Array.from(b)]).size;
  return union === 0 ? 0 : inter / union;
}

export function normalizeCoreEvent(raw: string): string {
  return normalizeTerms(raw).sort().join(' ');
}

/**
 * Pre-Filter (no LLM): exact fingerprint / exact core-event / Jaccard-title.
 *
 * - Jaccard-Titel ≥ 0.65 in last 14 days → duplicate
 * - Core-Event-Overlap ≥ 0.7 (Jaccard on normalized tokens) in last 30 days → duplicate
 * - Exact story-fingerprint hit in last 30 days → duplicate
 *
 * @returns null when pre-filter is negative (→ caller runs LLM check)
 */
export interface PreFilterHit {
  stage: 'jaccard-title' | 'core-event' | 'fingerprint';
  matchedSlug: string;
  matchedTitle: string;
  similarity: number;
}

export async function preFilterDuplicate(opts: {
  newTitle: string;
  seriesTmdbIds: number[];
  storyFingerprint: string | null;
}): Promise<PreFilterHit | null> {
  const { newTitle, seriesTmdbIds, storyFingerprint } = opts;
  const now = Date.now();
  const d14 = new Date(now - 14 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000);

  // 1) Fingerprint exact match (30 days)
  if (storyFingerprint) {
    const hit = await prisma.articles.findFirst({
      where: {
        storyFingerprint,
        status: 'published',
        publishedAt: { gte: d30 },
      },
      select: { slug: true, title: true },
      orderBy: { publishedAt: 'desc' },
    });
    if (hit) {
      return {
        stage: 'fingerprint',
        matchedSlug: hit.slug,
        matchedTitle: hit.title,
        similarity: 1.0,
      };
    }
  }

  const seriesFilter =
    seriesTmdbIds.length > 0
      ? { primarySeriesId: { in: seriesTmdbIds } }
      : {};

  // 2) Jaccard-Title (14 days)
  const recent14 = await prisma.articles.findMany({
    where: {
      ...seriesFilter,
      status: 'published',
      publishedAt: { gte: d14 },
    },
    select: { slug: true, title: true, coreEventNormalized: true },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });

  const newTitleWords = normalizeTerms(newTitle);
  let bestTitle: { sim: number; slug: string; title: string } | null = null;
  for (const a of recent14) {
    const sim = jaccard(newTitleWords, normalizeTerms(a.title));
    if (sim >= 0.65 && (!bestTitle || sim > bestTitle.sim)) {
      bestTitle = { sim, slug: a.slug, title: a.title };
    }
  }
  if (bestTitle) {
    return {
      stage: 'jaccard-title',
      matchedSlug: bestTitle.slug,
      matchedTitle: bestTitle.title,
      similarity: bestTitle.sim,
    };
  }

  // 3) Core-Event overlap (30 days) — uses tokens from new title
  const newTitleTokens = new Set(newTitleWords);
  if (newTitleTokens.size >= 3) {
    const recent30 = await prisma.articles.findMany({
      where: {
        ...seriesFilter,
        status: 'published',
        publishedAt: { gte: d30 },
        coreEventNormalized: { not: null },
      },
      select: { slug: true, title: true, coreEventNormalized: true },
      orderBy: { publishedAt: 'desc' },
      take: 200,
    });

    let bestEvent: { sim: number; slug: string; title: string } | null = null;
    for (const a of recent30) {
      if (!a.coreEventNormalized) continue;
      const otherTokens = a.coreEventNormalized.split(' ').filter((t) => t.length > 2);
      if (otherTokens.length === 0) continue;
      const sim = jaccard(Array.from(newTitleTokens), otherTokens);
      if (sim >= 0.7 && (!bestEvent || sim > bestEvent.sim)) {
        bestEvent = { sim, slug: a.slug, title: a.title };
      }
    }
    if (bestEvent) {
      return {
        stage: 'core-event',
        matchedSlug: bestEvent.slug,
        matchedTitle: bestEvent.title,
        similarity: bestEvent.sim,
      };
    }
  }

  return null;
}

/**
 * Holt existierende Artikel zur gleichen Serie (letzte 7 Tage)
 */
async function getRecentArticlesForSeries(
  seriesTmdbId: number,
  limit: number = 10
): Promise<ExistingArticle[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const articles = await prisma.articles.findMany({
    where: {
      primarySeriesId: seriesTmdbId,
      status: 'published',
      publishedAt: { gte: sevenDaysAgo }
    },
    select: {
      slug: true,
      title: true,
      excerpt: true
    },
    orderBy: { publishedAt: 'desc' },
    take: limit
  });

  return articles;
}

/**
 * LLM-basierter Duplicate Check
 */
export async function checkForDuplicate(
  newTitle: string,
  newSummary: string,
  seriesTmdbId: number,
  seriesName: string
): Promise<DuplicateCheckResult> {
  // Hole existierende Artikel
  const existingArticles = await getRecentArticlesForSeries(seriesTmdbId);

  // Wenn keine existierenden Artikel → kein Duplikat möglich
  if (existingArticles.length === 0) {
    return {
      isDuplicate: false,
      topicCategory: 'SONSTIGES',
      coreEvent: newTitle,
      duplicateOf: null,
      reason: 'Keine existierenden Artikel zur Serie in den letzten 7 Tagen',
      confidence: 1.0
    };
  }

  // Formatiere existierende Artikel für den Prompt
  const existingList = existingArticles
    .map((a, i) => `${i + 1}. "${a.title}"${a.excerpt ? `\n   Zusammenfassung: ${a.excerpt.substring(0, 150)}...` : ''}`)
    .join('\n');

  const prompt = `Prüfe ob ein neuer Artikel ein Duplikat ist. Verschiedene Themen zur gleichen Serie = KEIN Duplikat. Nur identisches Kern-Ereignis = Duplikat.

Serie: ${seriesName}
Neuer Artikel: "${newTitle}" – ${newSummary.substring(0, 300)}
Existierende (letzte 7 Tage): ${existingList}

JSON (keine Erklärung):
{"is_duplicate": true/false, "topic_category": "CASTING|TRAILER|STAFFEL|EPISODE|PRODUKTION|STORY|KRITIK|STREAMING|AWARD|INTERVIEW|SONSTIGES", "core_event": "max 10 Wörter", "duplicate_of_index": null|Nummer, "reason": "1 Satz", "confidence": 0.0-1.0}`;

  try {
    const { createLLMClient, LLM_CONFIG } = await import('./llm-config');
    const openai = createLLMClient();

    const response = await openai.chat.completions.create({
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: 'Duplikat-Checker. Nur valides JSON antworten.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Niedrig für konsistente Ergebnisse
      max_completion_tokens: 300
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    
    // Parse JSON (handle potential markdown code blocks and Claude quirks)
    const { parseJsonResponse } = await import('./json-utils');
    const result = parseJsonResponse(content);

    // Map result to our interface
    const duplicateSlug = result.duplicate_of_index 
      ? existingArticles[result.duplicate_of_index - 1]?.slug || null
      : null;

    return {
      isDuplicate: result.is_duplicate === true,
      topicCategory: TOPIC_CATEGORIES.includes(result.topic_category) 
        ? result.topic_category 
        : 'SONSTIGES',
      coreEvent: result.core_event || newTitle,
      duplicateOf: duplicateSlug,
      reason: result.reason || 'Keine Begründung',
      confidence: typeof result.confidence === 'number' ? result.confidence : 0.8
    };

  } catch (error) {
    console.error('Duplicate check error:', error);
    // FAIL-CLOSED: on LLM errors we default to "assume duplicate" — better to
    // skip a unique story than to double-publish. The pre-filter already
    // caught the obvious cases, so this branch only fires for *new* stories
    // whose LLM check happened to fail. Operator can retry from admin UI.
    return {
      isDuplicate: true,
      topicCategory: 'SONSTIGES',
      coreEvent: newTitle,
      duplicateOf: null,
      reason: `LLM-Check fehlgeschlagen (fail-closed): ${error instanceof Error ? error.message : 'Unbekannt'}`,
      confidence: 0
    };
  }
}

/**
 * Schneller Vor-Check ohne LLM (für offensichtliche Duplikate)
 */
export function quickTitleSimilarityCheck(
  newTitle: string,
  existingTitles: string[]
): { isSimilar: boolean; matchedTitle: string | null; similarity: number } {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[„""'''`]/g, '')
    .replace(/[^a-z0-9äöüß]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const newNorm = normalize(newTitle);
  const newWords = new Set(newNorm.split(' ').filter(w => w.length > 2));

  let bestMatch = { title: '', similarity: 0 };

  for (const existing of existingTitles) {
    const existingNorm = normalize(existing);
    const existingWords = new Set(existingNorm.split(' ').filter(w => w.length > 2));

    // Jaccard similarity
    const intersection = Array.from(newWords).filter(x => existingWords.has(x));
    const unionSize = new Set([...Array.from(newWords), ...Array.from(existingWords)]).size;
    const similarity = intersection.length / unionSize;

    if (similarity > bestMatch.similarity) {
      bestMatch = { title: existing, similarity };
    }
  }

  return {
    isSimilar: bestMatch.similarity > 0.7, // 70% Wort-Überlappung
    matchedTitle: bestMatch.similarity > 0.7 ? bestMatch.title : null,
    similarity: bestMatch.similarity
  };
}
