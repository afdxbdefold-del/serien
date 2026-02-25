/**
 * WasBedeutetDasBox Component
 * 
 * Zeigt praktische Bedeutung der News (max 2 Sätze)
 * Position: Direkt nach Lead-Absatz, vor Haupttext
 */

interface WasBedeutetDasBoxProps {
  text: string;
}

export function WasBedeutetDasBox({ text }: WasBedeutetDasBoxProps) {
  if (!text || text.trim().length === 0) {
    return null;
  }

  return (
    <div className="my-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-blue-900 mb-1">
            Was bedeutet das?
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}
