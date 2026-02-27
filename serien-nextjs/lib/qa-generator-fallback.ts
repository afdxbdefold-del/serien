/**
 * Fallback Q&A Generator (Rule-Based)
 * Optimized for Google Discover & Google News
 */

import { QAItem, ArticleQAInput, SeriesQAInput } from './qa-generator';

/**
 * Generate rule-based Q&A for articles
 * Optimized for editorial tone and context
 */
export function generateFallbackArticleQA(input: ArticleQAInput): QAItem[] {
  const { title, seriesName, seriesStatus } = input;
  const questions: QAItem[] = [];

  // Question 1: Character/Role based on title pattern
  if (title.toLowerCase().includes('wer spielt') || title.toLowerCase().includes('wer ist')) {
    const characterMatch = title.match(/(?:Wer (?:ist|spielt) )([^?]+)/i);
    if (characterMatch) {
      questions.push({
        question: `Welche Rolle spielt ${characterMatch[1].trim()} in ${seriesName}?`,
        answer: `Die Figur ist Teil des Hauptensembles von ${seriesName}. Konkrete Details zur Besetzung und Charakterentwicklung finden sich im Artikel, da die Serie mit einem umfangreichen Cast arbeitet.`,
        factual: false,
      });
    }
  }

  // Question 2: Future seasons (contextual, not generic)
  if (seriesStatus === 'Returning Series') {
    questions.push({
      question: `Wie realistisch ist eine weitere Staffel von ${seriesName}?`,
      answer: `Die Serie läuft aktuell erfolgreich und wurde in der Vergangenheit regelmäßig verlängert. Offizielle Ankündigungen zu neuen Staffeln erfolgen üblicherweise mehrere Monate nach dem Finale der laufenden Season.`,
      factual: false,
    });
  } else {
    questions.push({
      question: `Wird ${seriesName} fortgesetzt?`,
      answer: `Eine offizielle Bestätigung zur Zukunft der Serie liegt noch nicht vor. Entscheidungen über Verlängerungen werden in der Regel erst nach Auswertung der Zuschauerzahlen und Kritikerstimmen getroffen.`,
      factual: false,
    });
  }

  // Question 3: Streaming availability (contextual)
  questions.push({
    question: `Wo läuft ${seriesName} in Deutschland?`,
    answer: `Die Serie ist über verschiedene Streaming-Anbieter verfügbar. Die aktuelle Verfügbarkeit für Deutschland kann sich je nach Lizenzvereinbarungen ändern – Details finden sich in der Streaming-Box auf der Serien-Seite.`,
    factual: true,
  });

  return questions.slice(0, 4);
}

/**
 * Generate rule-based evergreen Q&A for series
 * Optimized with context and journalistic tone
 */
export function generateFallbackSeriesQA(input: SeriesQAInput): QAItem[] {
  const { seriesName, overview, numberOfSeasons, status } = input;

  const questions: QAItem[] = [
    {
      question: `Worum geht es in ${seriesName}?`,
      answer: overview.length > 200 
        ? overview.substring(0, 200).trim() + '...' 
        : overview,
      factual: true,
    },
    {
      question: `Wie viele Staffeln umfasst ${seriesName}?`,
      answer: numberOfSeasons === 1
        ? `Bislang wurde eine Staffel von ${seriesName} produziert.`
        : `${seriesName} umfasst derzeit ${numberOfSeasons} Staffeln, die über mehrere Jahre hinweg ausgestrahlt wurden.`,
      factual: true,
    },
  ];

  // Status-based question with context
  if (status === 'RENEWED' || status === 'Returning Series') {
    questions.push({
      question: `Geht ${seriesName} weiter?`,
      answer: `Die Serie wurde offiziell für eine weitere Staffel verlängert. Der genaue Starttermin wird üblicherweise mehrere Monate vor Ausstrahlung bekannt gegeben, sobald die Produktion abgeschlossen ist.`,
      factual: true,
    });
  } else if (status === 'CANCELLED' || status === 'Canceled') {
    questions.push({
      question: `Warum wurde ${seriesName} abgesetzt?`,
      answer: `Die Serie wurde vom Sender offiziell beendet. Gründe für Absetzungen sind meist eine Kombination aus Zuschauerzahlen, Budget und kreativen Entscheidungen des Studios.`,
      factual: true,
    });
  } else if (status === 'Ended') {
    questions.push({
      question: `Ist ${seriesName} abgeschlossen?`,
      answer: `Die Serie endete planmäßig nach ${numberOfSeasons} Staffeln. Ein Revival oder Spin-off wurde bislang nicht angekündigt.`,
      factual: true,
    });
  } else {
    questions.push({
      question: `Wie steht es um die Zukunft von ${seriesName}?`,
      answer: `Eine offizielle Entscheidung über die Fortsetzung der Serie liegt noch nicht vor. Die Sender warten üblicherweise mehrere Wochen nach dem Staffelfinale, um Zuschauerdaten und Kritiken auszuwerten.`,
      factual: false,
    });
  }

  questions.push({
    question: `Wo ist ${seriesName} verfügbar?`,
    answer: `Die Serie läuft über verschiedene Streaming-Dienste. Welche Anbieter ${seriesName} in Deutschland zeigen, ist in der Streaming-Übersicht auf dieser Seite aufgeführt.`,
    factual: true,
  });

  return questions.slice(0, 5);
}
