/**
 * Article Q&A Component
 * Displays 3-6 questions after article body
 * Includes FAQPage JSON-LD schema (Google-preferred format)
 */

import React from 'react';

interface QAItem {
  question: string;
  answer: string;
  factual: boolean;
}

interface ArticleQAProps {
  questions: QAItem[];
  schemaEnabled: boolean;
  headingType?: string | null;
}

function getHeading(type: string | null | undefined): string {
  switch (type) {
    case 'episode': return 'Fragen zur Episode';
    case 'finale': return 'Fragen zum Finale';
    case 'season': return 'Fragen zur Staffel';
    case 'ending': return 'Fragen zur Handlung';
    default: return 'Fragen & Antworten';
  }
}

export default function ArticleQA({ questions, schemaEnabled, headingType }: ArticleQAProps) {
  if (!questions || questions.length === 0) return null;

  const heading = getHeading(headingType);

  // JSON-LD FAQPage schema (Google-preferred over Microdata)
  const jsonLd = schemaEnabled ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(qa => ({
      '@type': 'Question',
      name: qa.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: qa.answer,
      },
    })),
  } : null;

  return (
    <section aria-labelledby="qa-article" className="mt-12 mb-8 border-t border-gray-200 dark:border-gray-700 pt-8">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <h2 id="qa-article" className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        {heading}
      </h2>

      <div className="space-y-6">
        {questions.map((qa, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
              {qa.question}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {qa.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
