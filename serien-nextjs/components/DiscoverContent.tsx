/**
 * Discover Content Components
 * Evergreen editorial sections for Series Hub pages
 */

/**
 * MODUL 0: Editorial Hook (NEW)
 * Event-based intro at the very top
 * 60-100 words, interprets recent event
 */
interface EditorialHookProps {
  seriesName: string;
  hook: string;
  lastUpdated: Date;
}

export function EditorialHook({ seriesName, hook, lastUpdated }: EditorialHookProps) {
  if (!hook) return null;

  // Calculate days since update
  const daysSince = Math.floor(
    (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 shadow-sm p-6 mb-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0 w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl">
          💬
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
              Aktuelle Einordnung
            </h2>
            {daysSince <= 7 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white">
                Neu
              </span>
            )}
          </div>
          {daysSince <= 14 && (
            <p className="text-xs text-blue-600">
              Aktualisiert vor {daysSince === 0 ? 'heute' : `${daysSince} ${daysSince === 1 ? 'Tag' : 'Tagen'}`}
            </p>
          )}
        </div>
      </div>
      <div className="prose prose-sm max-w-none">
        <p className="text-gray-800 leading-relaxed">
          {hook}
        </p>
      </div>
    </section>
  );
}

interface DiscoverIntroProps {
  seriesName: string;
  content: string;
}

export function DiscoverIntro({ seriesName, content }: DiscoverIntroProps) {
  if (!content) return null;

  // Remove duplicate heading from content
  const cleanContent = content.replace(/^Worum geht es in .+?\?\s*/i, '').trim();

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Worum geht es in {seriesName}?
      </h2>
      <div className="prose prose-sm max-w-none">
        <div className="text-gray-700 leading-relaxed space-y-4 whitespace-pre-line">
          {cleanContent}
        </div>
      </div>
    </section>
  );
}

interface DiscoverStatusProps {
  seriesName: string;
  content: string;
}

export function DiscoverStatus({ seriesName, content }: DiscoverStatusProps) {
  if (!content) return null;

  // Remove duplicate heading from content
  const cleanContent = content.replace(/^Aktueller Stand der Serie\s*/i, '').trim();

  return (
    <section className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6 mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        <span>Aktueller Stand der Serie</span>
      </h2>
      <div className="text-gray-700 leading-relaxed whitespace-pre-line">
        {cleanContent}
      </div>
    </section>
  );
}

interface DiscoverNewsContextProps {
  seriesName: string;
  content: string;
}

export function DiscoverNewsContext({ seriesName, content }: DiscoverNewsContextProps) {
  if (!content) return null;

  return (
    <div className="mb-4">
      <h2 className="text-xl font-bold text-gray-900 mb-3">
        📰 Aktuelle News zu {seriesName}
      </h2>
      <p className="text-gray-600 text-sm leading-relaxed">
        {content}
      </p>
    </div>
  );
}

interface MiniQAProps {
  qa: Array<{ question: string; answer: string }>;
}

export function MiniQA({ qa }: MiniQAProps) {
  if (!qa || qa.length === 0) return null;

  return (
    <section className="bg-gray-50 rounded-xl border border-gray-200 p-6 mt-8">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        💡 Kurz erklärt
      </h2>
      <div className="space-y-4">
        {qa.map((item, index) => (
          <div key={index} className="pb-4 border-b border-gray-200 last:border-0 last:pb-0">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              {item.question}
            </h3>
            <p className="text-gray-700 text-sm leading-relaxed">
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
