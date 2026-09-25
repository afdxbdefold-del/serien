import Link from 'next/link';

export default function AuthorBox() {
  return (
    <aside className="my-8 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">
        Verantwortung und Quellen
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        Verantwortlich für die Veröffentlichung ist der Betreiber von serien.de.
        Ältere Beiträge wurden teils softwaregestützt erstellt und unter
        Personennamen gespeichert, deren tatsächliche Mitwirkung wir nicht
        ausreichend belegen können. Die Quellen und Angaben dieses Artikels
        prüfen wir im Zuge der Archivüberarbeitung.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/autoren" className="text-cyan-700 underline dark:text-cyan-400">
          Zur Autorenschaft
        </Link>
        <Link href="/redaktionelle-richtlinien" className="text-cyan-700 underline dark:text-cyan-400">
          Redaktionelle Richtlinien
        </Link>
      </div>
    </aside>
  );
}
