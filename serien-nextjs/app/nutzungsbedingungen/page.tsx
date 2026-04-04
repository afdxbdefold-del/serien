import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nutzungsbedingungen | serien.de',
  description: 'Allgemeine Nutzungsbedingungen von serien.de. Informationen zu Urheberrecht, Haftung und Nutzung unserer Inhalte.',
  alternates: {
    canonical: 'https://serien.de/nutzungsbedingungen',
  },
};

export default function NutzungsbedingungenPage() {
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
              Nutzungsbedingungen
            </h1>
            <div className="h-1 w-20 bg-cyan-500 mb-4"></div>
          </div>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            <h2>1. Geltungsbereich</h2>
            <p>
              Diese Nutzungsbedingungen regeln die Nutzung des Online-Angebots von serien.de.
              Mit dem Zugriff auf unsere Webseite erklären Sie sich mit diesen Bedingungen einverstanden.
            </p>

            <h2>2. Urheberrecht und Inhalte</h2>
            <p>
              Alle auf serien.de veröffentlichten Inhalte (Texte, Bilder, Grafiken, Videos und Logos)
              unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung
              oder jede Art der Verwertung außerhalb der Grenzen des Urheberrechts bedarf der
              schriftlichen Zustimmung des Betreibers.
            </p>
            <p>
              Bildmaterial von Serien und Filmen stammt von TMDB (The Movie Database) und
              unterliegt den jeweiligen Lizenzbestimmungen der Rechteinhaber. Trailer und
              Videomaterial werden unter den Bedingungen der jeweiligen Streaming-Plattformen
              und Studios bereitgestellt.
            </p>

            <h2>3. Nutzung der Inhalte</h2>
            <p>
              Die Nutzung unserer Inhalte ist ausschließlich zum privaten, nicht-kommerziellen
              Gebrauch gestattet. Das systematische Herunterladen, Kopieren oder maschinelle
              Auslesen (Scraping) von Inhalten ist ohne ausdrückliche Genehmigung untersagt.
            </p>
            <p>
              Kurze Zitate mit Quellenangabe und Verlinkung zu serien.de sind im Rahmen des
              Zitatrechts gestattet.
            </p>

            <h2>4. Verfügbarkeit</h2>
            <p>
              Wir bemühen uns, serien.de jederzeit verfügbar zu halten. Ein Anspruch auf
              ununterbrochene Verfügbarkeit besteht jedoch nicht. Wir behalten uns das Recht
              vor, das Angebot jederzeit zu ändern, zu ergänzen oder einzustellen.
            </p>

            <h2>5. Haftungsausschluss</h2>
            <p>
              Die Inhalte auf serien.de werden mit größtmöglicher Sorgfalt erstellt. Dennoch
              übernehmen wir keine Gewähr für die Richtigkeit, Vollständigkeit und Aktualität
              der bereitgestellten Informationen. Insbesondere Angaben zu Streaming-Verfügbarkeit,
              Staffel-Starts und Besetzungen können sich kurzfristig ändern.
            </p>
            <p>
              Für die Inhalte externer Links übernehmen wir keine Haftung. Für den Inhalt
              der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
            </p>

            <h2>6. Kommentare und Nutzerbeiträge</h2>
            <p>
              Sofern Nutzer die Möglichkeit haben, Inhalte zu veröffentlichen, sind sie
              für diese selbst verantwortlich. Es ist untersagt, rechtswidrige, beleidigende
              oder irreführende Inhalte zu veröffentlichen. Wir behalten uns das Recht vor,
              solche Beiträge ohne Vorankündigung zu entfernen.
            </p>

            <h2>7. Datenschutz</h2>
            <p>
              Informationen zur Erhebung und Verarbeitung personenbezogener Daten finden Sie
              in unserer{' '}
              <Link href="/datenschutz" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                Datenschutzerklärung
              </Link>.
            </p>

            <h2>8. Änderungen der Nutzungsbedingungen</h2>
            <p>
              Wir behalten uns vor, diese Nutzungsbedingungen jederzeit zu ändern. Die jeweils
              aktuelle Version ist auf dieser Seite abrufbar. Durch die fortgesetzte Nutzung
              der Webseite nach Änderungen erklären Sie sich mit den aktualisierten Bedingungen
              einverstanden.
            </p>

            <h2>9. Anwendbares Recht</h2>
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland. Gerichtsstand ist, soweit
              gesetzlich zulässig, der Sitz des Betreibers.
            </p>

            <h2>10. Kontakt</h2>
            <p>
              Bei Fragen zu diesen Nutzungsbedingungen wenden Sie sich bitte an:{' '}
              <a href="mailto:kontakt@serien.de" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                kontakt@serien.de
              </a>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Stand: April 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
