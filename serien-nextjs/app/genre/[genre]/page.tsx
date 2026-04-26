import prisma from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';
import { Library } from 'lucide-react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';


interface PageProps {
  params: Promise<{
    genre: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { genre } = await params;
  const genreName = genre.charAt(0).toUpperCase() + genre.slice(1);
  const baseUrl = 'https://serien.de';
  
  return {
    title: `${genreName} Serien – News & Empfehlungen | serien.de`,
    description: `Aktuelle ${genreName}-Serien: News, Empfehlungen, Trailer und neue Highlights aus Streaming & TV.`,
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
    alternates: {
      canonical: `${baseUrl}/genre/${genre}`,
    },
  };
}

export default async function GenrePage({ params }: PageProps) {
  const { genre } = await params;
  const genreName = genre.charAt(0).toUpperCase() + genre.slice(1);
  
  // Fetch series by genre (simplified - in production you'd have genre filtering)
  const series = await prisma.series.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 md:px-6 py-12 max-w-6xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 mb-8 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-900">Home</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{genreName}</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Library className="h-8 w-8 text-cyan-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              {genreName} Serien
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Entdecke die besten {genreName}-Serien auf Netflix, Amazon Prime, Disney+ und mehr.
          </p>
        </div>

        {/* Series Grid */}
        {series.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {series.map((show) => (
              <Link key={show.tmdbId} href={`/serie/${show.slug}`}>
                <article className="group relative bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
                  <div className="aspect-[2/3] overflow-hidden bg-gray-200">
                    {show.posterLocalUrl && (
                      <img
                        src={show.posterLocalUrl}
                        alt={show.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <h3 className="text-white font-bold line-clamp-2">{show.title}</h3>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">Keine Serien in diesem Genre gefunden.</p>
          </div>
        )}
      </main>
    </div>
  );
}