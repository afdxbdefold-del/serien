/**
 * ARTIKEL-KONTEXT-KÄSTEN
 * 
 * Drei kurze, sachliche Einordnungen am Ende jedes Artikels:
 * - Was bedeutet das? (praktische Bedeutung)
 * - Darum ist das relevant (Kontext für den Zuschauer)
 * - Bisheriger Stand zur Serie (Recap)
 */

interface ContextBoxProps {
  label: string;
  text: string;
  testId: string;
  borderColor?: string;
  labelColor?: string;
}

function ContextBox({ label, text, testId, borderColor = 'border-cyan-500', labelColor = 'text-cyan-600 dark:text-cyan-400' }: ContextBoxProps) {
  return (
    <aside 
      data-testid={testId}
      className={`border-l-4 ${borderColor} bg-gray-50 dark:bg-gray-900/50 rounded-r-lg p-5`}
    >
      <p className={`text-sm font-bold ${labelColor} uppercase tracking-wider mb-2`}>
        {label}
      </p>
      <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
        {text}
      </p>
    </aside>
  );
}

export function WasBedeutetDas({ text }: { text: string }) {
  return <ContextBox label="Was bedeutet das?" text={text} testId="was-bedeutet-das" />;
}

export function DarumRelevant({ text }: { text: string }) {
  return <ContextBox label="Darum ist das relevant" text={text} testId="darum-relevant" borderColor="border-amber-500" labelColor="text-amber-600 dark:text-amber-400" />;
}

export function BisherigerStand({ text }: { text: string }) {
  return <ContextBox label="Bisheriger Stand zur Serie" text={text} testId="bisheriger-stand" borderColor="border-violet-500" labelColor="text-violet-600 dark:text-violet-400" />;
}
