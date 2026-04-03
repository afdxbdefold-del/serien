import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redaktionelle Richtlinien | serien.de',
  description: 'Unsere redaktionellen Grundsätze: Wie serien.de Inhalte erstellt, Fakten prüft und Qualität sicherstellt.',
  alternates: {
    canonical: 'https://serien.de/redaktionelle-richtlinien',
  },
};

export default function RedaktionelleRichtlinienPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-12">
            <Link
              href="/"
              className="text-cyan-600 dark:text-cyan-400 hover:underline text-sm mb-4 inline-block"
            >
              Startseite
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Redaktionelle Richtlinien
            </h1>
            <div className="h-1 w-20 bg-cyan-500 mb-4"></div>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              So stellen wir die Qualität unserer Inhalte sicher
            </p>
          </div>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            <h2>Unser Anspruch</h2>
            <p>
              serien.de ist ein unabhängiges deutschsprachiges Online-Magazin für Serien-News,
              Reviews und Streaming-Analysen. Wir informieren unsere Leser zeitnah, korrekt und
              verständlich über Neuigkeiten aus der Welt der Serien und Streaming-Plattformen.
            </p>

            <h2>Quellenarbeit und Faktenprüfung</h2>
            <p>
              Unsere Artikel basieren auf verifizierten Quellen. Dazu gehören:
            </p>
            <ul>
              <li>Offizielle Pressemitteilungen von Streaming-Diensten und Produktionsstudios</li>
              <li>Interviews und Statements von Showrunnern, Regisseuren und Darstellern</li>
              <li>Branchenmedien wie Deadline, Variety, The Hollywood Reporter und Collider</li>
              <li>Offizielle Social-Media-Kanäle der Serien und Plattformen</li>
              <li>TMDB (The Movie Database) für Episoden- und Besetzungsdaten</li>
            </ul>
            <p>
              Jede Nachricht wird auf Plausibilität geprüft, bevor sie veröffentlicht wird.
              Unbelegte Gerüchte werden als solche gekennzeichnet.
            </p>

            <h2>Redaktioneller Prozess</h2>
            <p>
              Unsere Inhalte durchlaufen einen mehrstufigen Qualitätsprozess:
            </p>
            <ol>
              <li>
                <strong>Recherche:</strong> Identifikation relevanter Nachrichtenquellen und
                Verifizierung der Fakten.
              </li>
              <li>
                <strong>Erstellung:</strong> Unsere Redaktion verfasst Artikel mit Fokus auf
                Relevanz, Aktualität und Mehrwert für den Leser.
              </li>
              <li>
                <strong>Qualitätssicherung:</strong> Jeder Artikel wird auf inhaltliche
                Korrektheit, Vollständigkeit und sprachliche Qualität geprüft.
              </li>
              <li>
                <strong>Veröffentlichung:</strong> Nach Freigabe wird der Artikel veröffentlicht
                und bei Bedarf mit offiziellen Trailern und Bildmaterial ergänzt.
              </li>
              <li>
                <strong>Aktualisierung:</strong> Bei neuen Entwicklungen werden bestehende
                Artikel aktualisiert und mit einem Aktualisierungsdatum versehen.
              </li>
            </ol>

            <h2>Unabhängigkeit</h2>
            <p>
              serien.de ist redaktionell unabhängig. Unsere Berichterstattung wird nicht von
              Streaming-Diensten, Studios oder Werbekunden beeinflusst. Werbliche Inhalte werden
              als solche gekennzeichnet und klar vom redaktionellen Inhalt getrennt.
            </p>

            <h2>Korrekturen und Transparenz</h2>
            <p>
              Sollte sich eine Information als fehlerhaft herausstellen, korrigieren wir den
              betreffenden Artikel umgehend und kennzeichnen die Korrektur transparent. Leser
              können uns jederzeit auf Fehler hinweisen.
            </p>

            <h2>Autorenschaft</h2>
            <p>
              Alle Artikel auf serien.de sind mit dem Namen des Autors oder der Autorin versehen.
              Auf der jeweiligen Autorenseite finden Leser weitere Informationen zur
              Expertise und zum Schwerpunkt des Verfassers.
            </p>

            <h2>Kontakt</h2>
            <p>
              Haben Sie Fragen zu unserer redaktionellen Arbeit oder möchten einen Fehler melden?
              Kontaktieren Sie uns unter{' '}
              <a href="mailto:redaktion@serien.de" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                redaktion@serien.de
              </a>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Zuletzt aktualisiert: April 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
