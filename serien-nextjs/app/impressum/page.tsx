import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Impressum | serien.de',
  description: 'Impressum und rechtliche Informationen zu serien.de',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://serien.de/impressum',
  },
};

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Impressum
            </h1>
            <div className="h-1 w-20 bg-cyan-500 mb-8"></div>
          </div>

          {/* Content */}
          <div className="prose prose-lg max-w-none">
            {/* Angaben gemäß § 5 TMG */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Angaben gemäß § 5 TMG
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-lg text-gray-900 font-semibold mb-2">AF Consulting</p>
                <p className="text-gray-700">Am Nesseufer 1</p>
                <p className="text-gray-700 mb-4">26789 Leer</p>
                
                <p className="text-gray-900 font-semibold mb-2">Vertreten durch:</p>
                <p className="text-gray-700 mb-4">Andreas Frey</p>
                
                <p className="text-gray-900 font-semibold mb-2">Kontakt:</p>
                <p className="text-gray-700">
                  E-Mail: <a href="mailto:mail@serien.de" className="text-cyan-500 hover:underline">mail@serien.de</a>
                </p>
              </div>
            </section>

            {/* Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
              </h2>
              <div className="bg-gray-50 rounded-lg p-6">
                <p className="text-gray-700">Andreas Frey</p>
                <p className="text-gray-700">Am Nesseufer 1</p>
                <p className="text-gray-700">26789 Leer</p>
              </div>
            </section>

            {/* EU-Streitschlichtung */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                EU-Streitschlichtung
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
                <a 
                  href="https://ec.europa.eu/consumers/odr/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:underline"
                >
                  https://ec.europa.eu/consumers/odr/
                </a>
                <br />
                Unsere E-Mail-Adresse finden Sie oben im Impressum.
              </p>
            </section>

            {/* Verbraucherstreitbeilegung */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Verbraucherstreitbeilegung / Universalschlichtungsstelle
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer 
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </section>

            {/* Haftung für Inhalte */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Haftung für Inhalte
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den 
                allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht 
                verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen 
                zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen 
                Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt 
                der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden 
                Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
              </p>
            </section>

            {/* Haftung für Links */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Haftung für Links
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. 
                Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der 
                verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. 
                Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche 
                Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht 
                zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
              </p>
            </section>

            {/* Urheberrecht */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Urheberrecht
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem 
                deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung 
                außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen 
                Autors bzw. Erstellers.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. 
                Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte 
                Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem 
                auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. 
                Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
              </p>
            </section>

            {/* Bildnachweise */}
            <section className="mb-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Bildnachweise
              </h2>
              <div className="bg-blue-50 border-l-4 border-cyan-500 p-6 rounded-r-lg">
                <p className="text-gray-900 font-semibold mb-2">
                  Serieninformationen und Bilder
                </p>
                <p className="text-gray-700 leading-relaxed mb-3">
                  Sämtliche Bilder, Poster und Serieninformationen auf dieser Website stammen von{' '}
                  <a 
                    href="https://www.themoviedb.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-500 hover:underline font-medium"
                  >
                    The Movie Database (TMDB.org)
                  </a>
                  .
                </p>
                <p className="text-gray-700 leading-relaxed text-sm">
                  Diese Website verwendet die TMDB-API, ist jedoch nicht von TMDB unterstützt oder zertifiziert. 
                  Alle Rechte an den Bildern und Serieninformationen liegen bei den jeweiligen Rechteinhabern.
                </p>
              </div>
            </section>

            {/* Hinweis */}
            <section className="mb-10">
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong>Hinweis:</strong> Dieses Impressum wurde mit größter Sorgfalt erstellt. Für die 
                  Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. 
                  Quelle:{' '}
                  <a 
                    href="https://www.e-recht24.de" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-cyan-500 hover:underline"
                  >
                    e-recht24.de
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}