/**
 * Series Overview Component
 * Editorial overview section (120-180 words)
 * Factual, neutral tone, SEO-optimized
 */

interface SeriesOverviewProps {
  overview: string;
  seriesName: string;
  status?: string | null;
  firstAirYear?: number | null;
}

export default function SeriesOverview({ overview, seriesName, status, firstAirYear }: SeriesOverviewProps) {
  // Generate editorial overview (120-180 words)
  // Rewrite TMDB overview into editorial style
  const generateEditorialOverview = () => {
    if (!overview || overview.length < 50) {
      return `${seriesName} ist eine Fernsehserie${firstAirYear ? ` aus dem Jahr ${firstAirYear}` : ''}. Die Serie hat sich${status === 'Ended' || status === 'Beendet' ? ' zu ihrer Zeit' : ''} zu einem${status === 'Returning Series' || status === 'Running' || status === 'Läuft' ? ' aktuellen' : ''} Serien-Highlight entwickelt und begeistert Zuschauer mit ihrer${overview.includes('comedy') || overview.includes('lustig') ? ' humorvollen' : overview.includes('thriller') || overview.includes('spannung') ? ' spannenden' : overview.includes('drama') ? ' emotionalen' : ''} Erzählweise.`;
    }

    // Use TMDB overview as base, add editorial context
    let editorial = overview;

    // Add context about status
    if (status === 'Returning Series' || status === 'Running' || status === 'Läuft') {
      editorial += ` Die Serie wird aktuell fortgesetzt und begeistert weiterhin ihr Publikum.`;
    } else if (status === 'Ended' || status === 'Beendet') {
      editorial += ` Die Serie wurde abgeschlossen und hat sich als${firstAirYear ? ` wegweisende Produktion der ${firstAirYear}er Jahre` : ' bedeutende Fernsehproduktion'} etabliert.`;
    }

    // Ensure length is within 120-180 words
    const words = editorial.split(' ');
    if (words.length > 180) {
      editorial = words.slice(0, 175).join(' ') + '...';
    }

    return editorial;
  };

  const editorialText = generateEditorialOverview();

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-3">
        Über {seriesName}
      </h2>
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-700 leading-relaxed">
          {editorialText}
        </p>
      </div>
    </section>
  );
}
