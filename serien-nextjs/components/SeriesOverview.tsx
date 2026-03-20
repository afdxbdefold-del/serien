/**
 * SeriesOverview Component
 * Displays AI-generated extended overview for a series
 * 
 * DEDUPLICATION RULE: Only renders when extendedOverview exists.
 * When extendedOverview is absent, DiscoverIntro handles the description.
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
  // DEDUPLICATION: Only render when we have EXTENDED overview
  // If we only have shortOverview, DiscoverIntro will handle it
  if (!extendedOverview) {
    return null;
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">📖</span>
        <span>Über {seriesName}</span>
      </h2>
      
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 whitespace-pre-line">
          {extendedOverview}
        </div>
      </div>
    </section>
  );
}
