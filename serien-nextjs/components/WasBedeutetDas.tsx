/**
 * WAS BEDEUTET DAS? - Erklärungs-Kasten
 * 
 * Zeigt am Ende eines Artikels eine kurze, sachliche Einordnung
 * der praktischen Bedeutung der Nachricht.
 */

interface WasBedeutetDasProps {
  text: string;
}

export function WasBedeutetDas({ text }: WasBedeutetDasProps) {
  return (
    <aside 
      data-testid="was-bedeutet-das"
      className="my-8 border-l-4 border-cyan-500 bg-gray-50 dark:bg-gray-900/50 rounded-r-lg p-5"
    >
      <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-2">
        Was bedeutet das?
      </p>
      <p className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
        {text}
      </p>
    </aside>
  );
}
