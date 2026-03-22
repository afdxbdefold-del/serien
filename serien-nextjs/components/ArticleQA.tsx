/**
 * Article Q&A Component
 * Displays 3-6 questions after article body
 * Includes FAQPage schema if all answers are factual
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

// Dynamic heading based on article type
function getHeading(type: string | null | undefined): string {
  switch (type) {
    case 'episode':
      return 'Fragen zur Episode';
    case 'finale':
      return 'Fragen zum Finale';
    case 'season':
      return 'Fragen zur Staffel';
    case 'ending':
      return 'Fragen zur Handlung';
    default:
      return 'Fragen & Antworten';
  }
}

export default function ArticleQA({ questions, schemaEnabled, headingType }: ArticleQAProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  const heading = getHeading(headingType);

  return (
    <section 
      aria-labelledby="qa-article" 
      className="mt-12 mb-8 border-t border-gray-200 dark:border-gray-700 pt-8"
    >
      <h2 
        id="qa-article" 
        className="text-2xl font-bold mb-6 text-gray-900 dark:text-white"
      >
        {heading}
      </h2>

      <div 
        className="space-y-6"
        {...(schemaEnabled && {
          itemScope: true,
          itemType: "https://schema.org/FAQPage"
        })}
      >
        {questions.map((qa, index) => (
          <div
            key={index}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            {...(schemaEnabled && {
              itemScope: true,
              itemProp: "mainEntity",
              itemType: "https://schema.org/Question"
            })}
          >
            <h3 
              className="text-lg font-semibold mb-3 text-gray-900 dark:text-white"
              {...(schemaEnabled && { itemProp: "name" })}
            >
              {qa.question}
            </h3>
            
            <div
              {...(schemaEnabled && {
                itemScope: true,
                itemProp: "acceptedAnswer",
                itemType: "https://schema.org/Answer"
              })}
            >
              <p 
                className="text-gray-700 dark:text-gray-300 leading-relaxed"
                {...(schemaEnabled && { itemProp: "text" })}
              >
                {qa.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
