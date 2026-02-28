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
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6 mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">
        Staffeln & Serienstatus
      </h2>
      
      <div className="space-y-4">
        {/* Seasons List */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Staffeln</h3>
          <div className="space-y-2">
            {seasons.filter(s => s.season_number > 0).map((season) => (
              <div key={season.id} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-900">
                  Staffel {season.season_number}
                </span>
                <span className="text-sm text-gray-600">
                  {season.air_date ? new Date(season.air_date).getFullYear() : 'TBA'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Produktionsstatus</h3>
          <div className={`inline-flex items-center px-4 py-2 rounded-lg font-medium text-sm shadow-sm ${
            status === 'Returning Series' || status === 'Running' || status === 'In Production'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : status === 'Ended'
              ? 'bg-gray-100 text-gray-700 border border-gray-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {formatStatus(status)}
          </div>
        </div>
      </div>
    </section>
  );
}
