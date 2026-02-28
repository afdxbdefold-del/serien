/**
 * SeriesOverview Component
 * Displays AI-generated extended overview for a series
 */

interface SeriesOverviewProps {
  seriesName: string;
  extendedOverview: string | null;
  shortOverview: string | null;
}

export default function SeriesOverview({
  seriesName,
  extendedOverview,
  shortOverview,
}: SeriesOverviewProps) {
  // Use extended overview if available, otherwise fall back to short overview
  const displayText = extendedOverview || shortOverview;

  if (!displayText) {
    return null;
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-2xl">📖</span>
        <span>Über {seriesName}</span>
      </h2>
      
      <div className="prose prose-sm max-w-none">
        <div className="text-gray-700 leading-relaxed space-y-4 whitespace-pre-line">
          {displayText}
        </div>
      </div>
    </section>
  );
}
