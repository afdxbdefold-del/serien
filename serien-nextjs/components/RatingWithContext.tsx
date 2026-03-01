/**
 * Rating With Context Component - MODUL 3
 * Displays TMDB rating with interpretative context
 * Part of Google Discover optimization (data + interpretation)
 */

'use client';

import { Star } from 'lucide-react';
import { useState } from 'react';

interface RatingWithContextProps {
  rating: number;
  voteCount?: number;
  className?: string;
}

export default function RatingWithContext({ 
  rating, 
  voteCount,
  className = '' 
}: RatingWithContextProps) {
  const [showContext, setShowContext] = useState(false);
  
  // Generate context based on rating
  const getContext = () => {
    if (rating >= 8.5) {
      return {
        text: 'Außergewöhnlich hohe Bewertung',
        detail: 'Werte über 8.5 erreichen nur wenige Serien. Allerdings: Nischen-Serien mit kleiner, aber enthusiastischer Fanbase können hier täuschen.',
        color: 'text-green-700'
      };
    } else if (rating >= 7.5) {
      return {
        text: 'Solide bis gute Bewertung',
        detail: 'Der 7er-Bereich ist der typische Wert für gefällige Mainstream-Serien. Die Bewertung sagt mehr über breite Akzeptanz als über künstlerische Qualität.',
        color: 'text-blue-700'
      };
    } else if (rating >= 6.5) {
      return {
        text: 'Durchwachsene Bewertung',
        detail: 'Werte im 6er-Bereich deuten auf polarisierende Inhalte hin – oder auf Serien, die ihren Ton noch nicht gefunden haben.',
        color: 'text-yellow-700'
      };
    } else {
      return {
        text: 'Unterdurchschnittliche Bewertung',
        detail: 'Unter 6.5 fällt eine Serie meist aus gutem Grund. Allerdings: Manchmal ist eine niedrige Bewertung auch Ausdruck falscher Erwartungen.',
        color: 'text-red-700'
      };
    }
  };
  
  const context = getContext();
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setShowContext(!showContext)}
        className="flex items-center gap-1 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer"
        aria-label={`Bewertung ${rating.toFixed(1)} von 10 - Klicken für Kontext`}
      >
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="font-semibold text-gray-900 text-sm">{rating.toFixed(1)}</span>
        {voteCount && voteCount > 100 && (
          <span className="text-xs text-gray-500 ml-1">({Math.round(voteCount / 1000)}k)</span>
        )}
        <span className="text-xs text-gray-400 ml-1">ⓘ</span>
      </button>
      
      {/* Context Tooltip */}
      {showContext && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-white border border-gray-300 rounded-lg shadow-xl p-4 z-50 animate-fadeIn">
          <div className="flex items-start gap-2 mb-2">
            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className={`text-sm font-semibold ${context.color} mb-1`}>
                {context.text}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {context.detail}
              </p>
              {voteCount && (
                <p className="text-xs text-gray-500 mt-2 italic">
                  Basis: {voteCount.toLocaleString('de-DE')} TMDB-Bewertungen
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowContext(false)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1"
          >
            Schließen
          </button>
        </div>
      )}
    </div>
  );
}
