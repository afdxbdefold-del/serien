/**
 * Series Page Q&A Component
 * Displays 5 evergreen questions on /serie/[slug]
 * Always includes FAQPage schema (evergreen content)
 */

import React from 'react';

interface QAItem {
  question: string;
  answer: string;
  factual: boolean;
}

interface SeriesQAProps {
  questions: QAItem[];
  seriesName: string;
}

export default function SeriesQA({ questions, seriesName }: SeriesQAProps) {
  if (!questions || questions.length === 0) {
    return null;
  }

  return (
    <section 
      aria-labelledby="qa-series" 
      className="mt-8 mb-12"
    >
      <h2 
        id="qa-series" 
        className="text-3xl font-bold mb-6 text-gray-900"
      >
        Häufige Fragen zu {seriesName}
      </h2>

      <div 
        className="space-y-5"
        itemScope
        itemType="https://schema.org/FAQPage"
      >
        {questions.map((qa, index) => (
          <div
            key={index}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            itemScope
            itemProp="mainEntity"
            itemType="https://schema.org/Question"
          >
            <h3 
              className="text-xl font-semibold mb-3 text-gray-900"
              itemProp="name"
            >
              {qa.question}
            </h3>
            
            <div
              itemScope
              itemProp="acceptedAnswer"
              itemType="https://schema.org/Answer"
            >
              <p 
                className="text-gray-700 leading-relaxed text-base"
                itemProp="text"
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
