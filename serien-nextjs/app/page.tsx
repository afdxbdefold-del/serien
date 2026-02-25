export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            serien.de
          </h1>
          <p className="text-xl text-gray-600">
            Deine Serien-News Plattform
          </p>
        </header>
        
        <main className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-700 mb-4">
              Willkommen! Die Plattform wird über den Admin-Bereich verwaltet.
            </p>
            <p className="text-sm text-gray-500">
              Artikel werden unter /[slug] verfügbar sein
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
