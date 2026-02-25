import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock, Share2 } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    slug: string;
  };
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    select: {
      title: true,
      excerpt: true,
      heroLocalUrl: true,
    },
  });

  if (!article) {
    return {
      title: 'Artikel nicht gefunden | serien.de',
    };
  }

  return {
    title: `${article.title} | serien.de`,
    description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
    openGraph: {
      title: `${article.title} | serien.de`,
      description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
      type: 'article',
      url: `https://serien.de/${params.slug}/`,
      images: article.heroLocalUrl ? [
        {
          url: article.heroLocalUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} | serien.de`,
      description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  // Fetch article with related data
  const article = await prisma.article.findUnique({
    where: { slug: params.slug },
    include: {
      author: true,
      series: true,
    },
  });

  if (!article || article.status !== 'published') {
    notFound();
  }

  // Fetch related news (same category or same series)
  const relatedNews = await prisma.article.findMany({
    where: {
      status: 'published',
      id: { not: article.id },
      OR: [
        { category: article.category },
        { tmdbSeriesId: article.tmdbSeriesId },
      ],
    },
    take: 3,
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      heroLocalUrl: true,
      publishedAt: true,
      category: true,
      author: {
        select: { name: true },
      },
    },
  });

  // Format dates
  const publishedDate = new Date(article.publishedAt || article.createdAt);
  const formattedDate = publishedDate.toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const getRelativeTime = () => {
    const now = new Date();
    const diffMs = now.getTime() - publishedDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Gerade eben';
    if (diffHours < 24) return `Vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    return formattedDate;
  };

  return (
    <div className="min-h-screen bg-white">
      <article className="container mx-auto px-6 md:px-12 py-8 max-w-4xl">
        {/* Back Button */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Zurück zur Startseite</span>
        </Link>

        {/* Hero Image */}
        {article.heroLocalUrl && (
          <div className="relative aspect-video rounded-2xl overflow-hidden mb-8">
            <Image
              src={article.heroLocalUrl}
              alt={article.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Category Badge */}
        {article.category && (
          <div className="mb-4">
            <span className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold rounded-lg">
              {article.category}
            </span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
          {article.title}
        </h1>

        {/* Meta Info */}
        <div className="flex items-center gap-6 mb-8 pb-8 border-b">
          {article.author && (
            <div className="flex items-center gap-3">
              {article.author.image ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden">
                  <Image
                    src={article.author.image}
                    alt={article.author.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                  {article.author.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-900">{article.author.name}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>{getRelativeTime()}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Excerpt/Lead */}
        {article.excerpt && (
          <p className="text-xl text-gray-700 mb-8 leading-relaxed font-medium">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        <div 
          className="prose prose-lg max-w-none mb-12"
          dangerouslySetInnerHTML={{ __html: article.contentHtml || '' }}
        />

        {/* Related Series */}
        {article.series && (
          <div className="mb-12 p-6 bg-gray-50 rounded-2xl">
            <h3 className="text-xl font-bold mb-4">Zur Serie</h3>
            <Link 
              href={`/serie/${article.series.tmdbId}-${article.series.slug}`}
              className="flex items-center gap-4 hover:opacity-80 transition-opacity"
            >
              {article.series.posterLocalUrl && (
                <div className="relative w-20 h-28 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={article.series.posterLocalUrl}
                    alt={article.series.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div>
                <h4 className="font-bold text-lg text-gray-900">{article.series.title}</h4>
                <p className="text-sm text-gray-600">Zur Serienseite →</p>
              </div>
            </Link>
          </div>
        )}

        {/* Share Button */}
        <div className="flex justify-center mb-12">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl"
            disabled
          >
            <Share2 className="h-5 w-5" />
            <span>Artikel teilen</span>
          </button>
        </div>

        {/* Related News */}
        {relatedNews.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8">Ähnliche News</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedNews.map((news) => (
                <Link key={news.id} href={`/artikel/${news.slug}`}>
                  <article className="group bg-white rounded-xl border hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
                    {news.heroLocalUrl && (
                      <div className="relative aspect-video overflow-hidden">
                        <Image
                          src={news.heroLocalUrl}
                          alt={news.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                        {news.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-2">
                        {new Date(news.publishedAt).toLocaleDateString('de-DE', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="border-t bg-white mt-20">
        <div className="container mx-auto px-6 md:px-12 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold mb-4">serien.de</h3>
              <p className="text-sm text-gray-600">
                Deine Quelle für TV-Serien News
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/" className="hover:text-gray-900 transition-colors">News</Link></li>
                <li><Link href="/trending" className="hover:text-gray-900 transition-colors">Trending</Link></li>
                <li><Link href="/about" className="hover:text-gray-900 transition-colors">Über uns</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Rechtliches</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link></li>
                <li><a href="/" className="hover:text-gray-900 transition-colors">Datenschutz</a></li>
                <li><a href="mailto:mail@serien.de" className="hover:text-gray-900 transition-colors">Kontakt</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t text-center text-sm text-gray-600">
            <p>© 2024 serien.de. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
