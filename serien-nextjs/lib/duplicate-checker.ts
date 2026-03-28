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

  const prompt = `Du bist ein Serien-News-Editor. Prüfe ob ein neuer Artikel ein DUPLIKAT eines existierenden ist.

WICHTIG: 
- Verschiedene THEMEN zur GLEICHEN SERIE sind KEIN Duplikat!
- Nur wenn das KERN-EREIGNIS identisch ist, ist es ein Duplikat.
- Follow-up Stories (z.B. "Reaktionen auf X" nach "X passiert") sind KEINE Duplikate.

THEMEN-KATEGORIEN:
- CASTING: Neue Schauspieler, Absagen, Rollen-Bestätigungen
- TRAILER: Trailer-Veröffentlichung, Trailer-Reaktionen, Trailer-Rekorde
- STAFFEL: Staffel-Ankündigung, Verlängerung, Absetzung, Episodenzahl
- EPISODE: Episode-Recap, Episode-Analyse, Episode-Bewertung
- PRODUKTION: Drehstart, Behind-Scenes, Verzögerungen, Regisseur-News
- STORY: Plot-Details, Theorien, Ending-Erklärungen
- KRITIK: Reviews, Ratings, Kritiker-Meinungen
- STREAMING: Plattform-Verfügbarkeit, Release-Termine
- AWARD: Nominierungen, Preise
- INTERVIEW: Schauspieler/Creator Interviews
- SONSTIGES: Alles andere

SERIE: ${seriesName}

NEUER ARTIKEL:
Titel: "${newTitle}"
Zusammenfassung: ${newSummary.substring(0, 300)}

EXISTIERENDE ARTIKEL (letzte 7 Tage):
${existingList}

Analysiere und antworte NUR mit diesem JSON (keine Erklärung davor/danach):
{
  "is_duplicate": true/false,
  "topic_category": "CASTING|TRAILER|STAFFEL|EPISODE|PRODUKTION|STORY|KRITIK|STREAMING|AWARD|INTERVIEW|SONSTIGES",
  "core_event": "Kurze Beschreibung des Kern-Ereignisses (max 10 Wörter)",
  "duplicate_of_index": null oder Nummer des Duplikats (1-${existingArticles.length}),
  "reason": "Begründung in einem Satz",
  "confidence": 0.0-1.0
}`;

  try {
    // Use OpenAI directly (same pattern as other lib files)
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: 'https://api.openai.com/v1',
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Kostengünstig für diesen Check
      messages: [
        { role: 'system', content: 'Du bist ein präziser JSON-Generator. Antworte NUR mit validem JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1, // Niedrig für konsistente Ergebnisse
      max_tokens: 300
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    
    // Parse JSON (handle potential markdown code blocks)
    let jsonStr = content;
    if (content.includes('```')) {
      const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      jsonStr = match ? match[1].trim() : content;
    }

    const result = JSON.parse(jsonStr);

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
    // Bei Fehlern: Artikel durchlassen (false positive vermeiden)
    return {
      isDuplicate: false,
      topicCategory: 'SONSTIGES',
      coreEvent: newTitle,
      duplicateOf: null,
      reason: `Fehler beim Duplicate-Check: ${error instanceof Error ? error.message : 'Unbekannt'}`,
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
