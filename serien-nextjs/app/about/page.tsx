import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Über uns | serien.de',
  description: 'Erfahre mehr über serien.de - dein Portal für Serien-News, Trailer und Updates.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-6 md:px-12 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Über uns
            </h1>
            <div className="h-1 w-20 bg-cyan-500 mb-8"></div>
            
            <div className="prose prose-lg max-w-none">
              <p className="text-xl text-gray-700 leading-relaxed mb-6">
                Serien.de wurde Anfang 2021 als leidenschaftliches Projekt ins Leben gerufen und hat sich zur 
                am schnellsten wachsenden unabhängigen Serien- und Filmnachrichten-Website in Deutschland entwickelt.
              </p>
              
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                In kürzester Zeit hat sich die Seite zu einer der zuverlässigsten Quellen für ausführliche 
                Unterhaltungsberichterstattung entwickelt. Von umfassenden Erklärungen bis hin zu detaillierten 
                Rezensionen bietet Serien.de alles, um die Informationsbedürfnisse aller Arten von Film-, 
                Fernseh- und Anime-Liebhabern zu erfüllen.
              </p>
              
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                Kein Wunder also, dass Serien.de jeden Monat von über 1 Million Serienfans besucht wird.
              </p>
            </div>
          </div>

          {/* Team Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Unser Team
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              Unser Autorenteam besteht nicht nur aus Film- und Fernsehjournalisten, sondern auch aus 
              Anime-Kennern und Filmabsolventen. Das Team von Serien.de ist eine bunte Mischung von Menschen 
              mit unterschiedlichem Hintergrund, die ein gemeinsames Ziel haben: die Liebe für Serien zu verbreiten.
            </p>
            
            <Link 
              href="/autoren" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white rounded-lg font-semibold hover:bg-cyan-600 transition-colors"
            >
              Zur Redaktion
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Mission Section */}
          <div className="bg-gray-50 rounded-2xl p-8 mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Unsere Mission
            </h2>
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Wir sind bestrebt, unseren Lesern die aktuellsten und genauesten Informationen über ihre 
              Lieblingsserien und -filme zu liefern. Unser Team arbeitet rund um die Uhr, um sicherzustellen, 
              dass du immer auf dem neuesten Stand bist.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Ob es sich um exklusive Interviews, Behind-the-Scenes-Einblicke oder detaillierte 
              Episodenanalysen handelt – wir decken alles ab, was das Herz von Serienfans begehrt.
            </p>
          </div>

          {/* Coverage Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Was wir abdecken
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Streaming-News</h3>
                <p className="text-gray-600">
                  Aktuelle Neuigkeiten von Netflix, Amazon Prime, Disney+, HBO Max und allen anderen 
                  wichtigen Streaming-Plattformen.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Rezensionen & Analysen</h3>
                <p className="text-gray-600">
                  Detaillierte Rezensionen neuer Serien und Filme sowie tiefgehende Analysen von 
                  Episoden und Staffeln.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Erscheinungstermine</h3>
                <p className="text-gray-600">
                  Verpasse keine neue Staffel oder Serie – wir halten dich über alle wichtigen 
                  Veröffentlichungstermine auf dem Laufenden.
                </p>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Exklusive Inhalte</h3>
                <p className="text-gray-600">
                  Interviews mit Schauspielern und Produzenten sowie exklusive Behind-the-Scenes-Einblicke 
                  in deine Lieblingsproduktionen.
                </p>
              </div>
            </div>
          </div>

          {/* Contact CTA */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Kontaktiere uns
            </h2>
            <p className="text-lg mb-6 opacity-90">
              Hast du Fragen, Anregungen oder möchtest du mit uns zusammenarbeiten?
            </p>
            <a 
              href="mailto:kontakt@serien.de"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-bold hover:bg-gray-100 transition-colors"
            >
              E-Mail senden
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}