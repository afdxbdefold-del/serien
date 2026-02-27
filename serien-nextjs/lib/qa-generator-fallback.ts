/**
 * Fallback Q&A Generator (Rule-Based)
 * Used when OpenAI endpoint is unavailable
 */

import { QAItem, ArticleQAInput, SeriesQAInput } from './qa-generator';

/**
 * Generate rule-based Q&A for articles
 * Based on series name and article title patterns
 */
export function generateFallbackArticleQA(input: ArticleQAInput): QAItem[] {
  const { title, seriesName, seriesStatus } = input;
  const questions: QAItem[] = [];

  // Question 1: Based on title pattern
  if (title.toLowerCase().includes('wer spielt') || title.toLowerCase().includes('wer ist')) {
    const characterMatch = title.match(/(?:Wer (?:ist|spielt) )([^?]+)/i);
    if (characterMatch) {
      questions.push({
        question: `Wer spielt ${characterMatch[1]} in ${seriesName}?`,
        answer: `Informationen zur Besetzung von ${characterMatch[1]} finden sich im Artikel. Die Serie ${seriesName} hat ein talentiertes Ensemble.`,
        factual: false,
      });
    }
  }

  // Question 2: Series status
  if (seriesStatus) {
    questions.push({
      question: `Kommt eine weitere Staffel von ${seriesName}?`,
      answer: `Stand jetzt gibt es noch keine offizielle Bestätigung für eine weitere Staffel. Der Sender hat sich bislang nicht zur Zukunft der Serie geäußert.`,
      factual: false,
    });
  }

  // Question 3: Series info
  questions.push({
    question: `Wo kann ich ${seriesName} streamen?`,
    answer: `Die Streaming-Verfügbarkeit von ${seriesName} variiert je nach Region. Prüfen Sie die Streaming-Anbieter-Box auf der Serien-Seite für aktuelle Informationen.`,
    factual: false,
  });

  return questions.slice(0, 4); // Max 4 questions
}

/**
 * Generate rule-based evergreen Q&A for series
 */
export function generateFallbackSeriesQA(input: SeriesQAInput): QAItem[] {
  const { seriesName, overview, numberOfSeasons, status } = input;

  const questions: QAItem[] = [
    {
      question: `Worum geht es in ${seriesName}?`,
      answer: overview.substring(0, 200) + (overview.length > 200 ? '...' : ''),
      factual: true,
    },
    {
      question: `Wie viele Staffeln gibt es von ${seriesName}?`,
      answer: `${seriesName} hat ${numberOfSeasons} ${numberOfSeasons === 1 ? 'Staffel' : 'Staffeln'}.`,
      factual: true,
    },
  ];

  // Status-based question
  if (status === 'RENEWED') {
    questions.push({
      question: `Ist ${seriesName} verlängert oder abgesetzt?`,
      answer: `${seriesName} wurde für eine weitere Staffel verlängert.`,
      factual: true,
    });
  } else if (status === 'CANCELLED') {
    questions.push({
      question: `Ist ${seriesName} verlängert oder abgesetzt?`,
      answer: `${seriesName} wurde leider abgesetzt. Es wird keine weiteren Staffeln geben.`,
      factual: true,
    });
  } else {
    questions.push({
      question: `Ist ${seriesName} verlängert oder abgesetzt?`,
      answer: `Der Status von ${seriesName} ist derzeit unklar. Es gibt noch keine offizielle Bestätigung über eine Verlängerung oder Absetzung.`,
      factual: false,
    });
  }

  questions.push({
    question: `Wo kann ich ${seriesName} sehen?`,
    answer: `Die Streaming-Verfügbarkeit von ${seriesName} finden Sie in der "Wo wird die Serie gestreamt?" Box auf dieser Seite.`,
    factual: true,
  });

  return questions.slice(0, 5);
}
