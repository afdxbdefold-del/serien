/**
 * Quick Facts Box Component
 * Compact fact box with key series information
 */

interface QuickFactsBoxProps {
  originalTitle?: string | null;
  firstAirYear?: number | null;
  creators?: string[];
  mainGenre?: string | null;
  platform?: string | null;
  status?: string | null;
}

export default function QuickFactsBox({
  originalTitle,
  firstAirYear,
  creators,
  mainGenre,
  platform,
  status
}: QuickFactsBoxProps) {
  const facts = [
    { label: 'Originaltitel', value: originalTitle },
    { label: 'Erstausstrahlung', value: firstAirYear ? `${firstAirYear}` : null },
    { label: 'Creator', value: creators && creators.length > 0 ? creators.join(', ') : null },
    { label: 'Hauptgenre', value: mainGenre },
    { label: 'Plattform', value: platform },
    { 
      label: 'Status', 
      value: status === 'Returning Series' || status === 'Running' ? 'Läuft' :
             status === 'Ended' ? 'Beendet' :
             status === 'In Production' ? 'In Produktion' :
             status === 'Planned' ? 'Geplant' : status
    }
  ].filter(fact => fact.value);

  if (facts.length === 0) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-shadow p-6">
      <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wide">
        Schnelle Fakten
      </h3>
      <dl className="space-y-3">
        {facts.map((fact, index) => (
          <div key={index} className="flex justify-between items-start">
            <dt className="text-sm font-medium text-gray-600 w-1/3">
              {fact.label}
            </dt>
            <dd className="text-sm text-gray-900 w-2/3 text-right font-medium">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
