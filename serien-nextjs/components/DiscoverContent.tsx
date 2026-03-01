/**
 * Discover Content Components
 * Evergreen editorial sections for Series Hub pages
 */

interface DiscoverIntroProps {
  seriesName: string;
  content: string;
}

export function DiscoverIntro({ seriesName, content }: DiscoverIntroProps) {
  if (!content) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Worum geht es in {seriesName}?
      </h2>
      <div className="prose prose-sm max-w-none">
        <div className="text-gray-700 leading-relaxed space-y-4 whitespace-pre-line">
          {content}
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
