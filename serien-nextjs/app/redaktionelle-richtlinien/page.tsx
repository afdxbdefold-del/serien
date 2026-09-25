import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Redaktionelle Richtlinien | serien.de',
  description: 'Wie serien.de Inhalte erstellt, Quellen prüft, historische Artikel berichtigt und die Verantwortung offenlegt.',
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
              Wie Inhalte entstehen und wie wir Fehler korrigieren
            </p>
          </div>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            <h2>Unser Anspruch</h2>
            <p>
              serien.de veröffentlicht deutschsprachige Nachrichten und Informationen zu Serien.
              Für die Veröffentlichung ist der Betreiber verantwortlich, der im
              <Link href="/impressum"> Impressum</Link> genannt wird.
            </p>

            <h2>Quellenarbeit und Faktenprüfung</h2>
            <p>
              Als Quellen kommen unter anderem infrage:
            </p>
            <ul>
              <li>Offizielle Pressemitteilungen von Streaming-Diensten und Produktionsstudios</li>
              <li>Interviews und Statements von Showrunnern, Regisseuren und Darstellern</li>
              <li>Branchenmedien wie Deadline, Variety, The Hollywood Reporter und Collider</li>
              <li>Offizielle Social-Media-Kanäle der Serien und Plattformen</li>
              <li>TMDB (The Movie Database) für Episoden- und Besetzungsdaten</li>
            </ul>
            <p>
              Die Nennung einer Quelle allein belegt die Aussage eines Artikels nicht.
              Besonders ältere Beiträge können sachliche Fehler, veraltete Angaben oder
              unpassende Serienzuordnungen enthalten. Wir prüfen diese Fälle einzeln.
            </p>

            <h2>Redaktioneller Prozess</h2>
            <p>
              Für neue Beiträge kann Software Quellen sammeln, Entwürfe schreiben und
              automatische Prüfungen ausführen. Diese Schritte ersetzen keine
              menschliche Faktenprüfung. Für ältere Beiträge lässt sich eine solche
              Prüfung nicht durchgehend nachweisen. Wir beschreiben deshalb keine
              pauschale persönliche Freigabe aller veröffentlichten Artikel.
            </p>
            <ol>
              <li>
                <strong>Quelle:</strong> Zentrale Aussagen mit erreichbaren Belegen abgleichen.
              </li>
              <li>
                <strong>Deutschlandbezug:</strong> Verfügbarkeit und Termine für Leser in
                Deutschland gesondert prüfen.
              </li>
              <li>
                <strong>Zuordnung:</strong> Personen, Produktionen, Bilder und ähnliche
                Meldungen auf Verwechslungen prüfen.
              </li>
              <li>
                <strong>Korrektur:</strong> Belegte Fehler im bestehenden Artikel berichtigen
                und wesentliche Änderungen kenntlich machen.
              </li>
            </ol>

            <h2>Unabhängigkeit</h2>
            <p>
              Werbung und redaktionelle Inhalte sind getrennt. Werbliche Inhalte sollen
              als solche erkennbar sein.
            </p>

            <h2>Korrekturen und Transparenz</h2>
            <p>
              Hinweise auf Fehler prüfen wir anhand der verfügbaren Quellen. Bestätigte
              sachliche Korrekturen werden am bestehenden Artikel vorgenommen, ohne das
              ursprüngliche Veröffentlichungsdatum künstlich zu erneuern. Hinweise sind
              über die unten genannte Kontaktadresse möglich.
            </p>

            <h2>Autorenschaft</h2>
            <p>
              Das frühere Publikationssystem hat Artikeln Personennamen zugewiesen.
              Die tatsächliche Mitwirkung und die früher veröffentlichten Lebensläufe
              sind nicht ausreichend belegt. Deshalb erscheinen diese Angaben nicht
              mehr als verifizierte Autorenprofile. Die historischen Zuordnungen
              bleiben intern für die Nachvollziehbarkeit erhalten. Mehr dazu steht
              unter <Link href="/autoren">Verantwortung und Autorenschaft</Link>.
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
              Zuletzt aktualisiert: September 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
