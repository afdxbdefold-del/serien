/**
 * Seasons & Status Component
 * Lists all seasons and current production status
 */

interface SeasonsStatusProps {
  seriesName: string;
  seasons?: any[];
  status?: string | null;
  numberOfSeasons?: number | null;
}

export default function SeasonsStatus({ seriesName, seasons, status, numberOfSeasons }: SeasonsStatusProps) {
  if (!seasons || seasons.length === 0) return null;

  const formatStatus = (status: string | null | undefined) => {
    if (!status) return 'Status unklar';
    switch (status) {
      case 'Returning Series':
      case 'Running':
        return 'Wird fortgesetzt';
      case 'Ended':
        return 'Beendet';
      case 'In Production':
        return 'In Produktion';
      case 'Planned':
        return 'Geplant';
      default:
        return status;
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-lg transition-shadow p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
        Staffeln & Serienstatus
      </h2>
      
      <div className="space-y-4">
        {/* Seasons List */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Staffeln</h3>
          <div className="space-y-2">
            {seasons.filter(s => s.season_number > 0).map((season) => (
              <div key={season.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <span className="text-sm text-gray-900 dark:text-white">
                  Staffel {season.season_number}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {season.air_date ? new Date(season.air_date).getFullYear() : 'TBA'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Produktionsstatus</h3>
          <div className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm shadow-sm ${
            status === 'Returning Series' || status === 'Running' || status === 'In Production'
              ? 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : status === 'Ended'
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
              : 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
          }`}>
            {formatStatus(status)}
          </div>
        </div>
      </div>
    </section>
  );
}
