import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Clock } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ShareButton from '@/components/ShareButton';
import { SeriesInfobox } from '@/components/SeriesInfobox';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import InlineVideoPlayer from '@/components/DirectVideoPlayer';
import { sanitizeArticleContent } from '@/lib/content-sanitizer';
import ArticleQA from '@/components/ArticleQA';
import { generateArticleSchema, getImageDimensions } from '@/lib/schema-generator';
import { getAuthorUrl } from '@/lib/author-utils';

// Force dynamic rendering - articles need real-time data
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await prisma.articles.findUnique({
    where: { slug },
    select: {
      title: true,
      excerpt: true,
      heroLocalUrl: true,
      ogImageUrl: true,
      tmdbId: true,
      tmdbType: true,
    },
  });

  if (!article) {
    return {
      title: 'Artikel nicht gefunden | serien.de',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  // Use TMDB image pipeline if available, fallback to local URL
  const ogImage = article.ogImageUrl || 
    (article.tmdbId && article.tmdbType ? `/img/og/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl);

  return {
    title: `${article.title} | serien.de`,
    description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
    metadataBase: new URL(baseUrl),
    robots: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    alternates: {
      canonical: `/${slug}`,
    },
    openGraph: {
      title: `${article.title} | serien.de`,
      description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
      type: 'article',
      url: `/${slug}`,
      images: ogImage ? [
        {
          url: ogImage,
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
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  
  // Fetch article with related data
  const article = await prisma.articles.findUnique({
    where: { slug },
    include: {
      users: true, // Fixed: use 'users' not 'author' (relation name in schema)
      series: true, // Fixed: use 'series' not 'primarySeries'
      article_qa: true, // Fixed: use 'article_qa' not 'articleQA'
    },
  });

  if (!article || article.status !== 'published') {
    notFound();
  }

  // Fetch related news (same category or same series)
  const relatedNews = await prisma.articles.findMany({
    where: {
      status: 'published',
      id: { not: article.id },
      OR: [
        { category: article.category },
        { primarySeriesId: article.primarySeriesId },
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
      users: {
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

  // Determine image URL
  const imageUrl = article.heroImagePath || 
    article.ogImageUrl || 
    (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl) || 
    '/og-image.png';
  
  // Generate structured data with ImageObject
  const articleSchema = generateArticleSchema({
    title: article.title,
    description: article.excerpt || '',
    imageUrl,
    imageDimensions: getImageDimensions(imageUrl),
    datePublished: (article.publishedAt || article.createdAt).toISOString(),
    dateModified: article.updatedAt.toISOString(),
    slug,
    author: article.users?.name,
  });

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD Structured Data with ImageObject */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      {/* Article with proper semantic structure */}
      <article className="container mx-auto px-6 md:px-12 py-8 max-w-4xl">
        {/* Back Button (before header) */}
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
          aria-label="Zurück zur Startseite"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          <span>Zurück zur Startseite</span>
        </Link>

        {/* Article Header */}
        <header className="mb-8">

        {/* Hero Image */}
        {(article.heroImageUrl || article.heroLocalUrl || (article.tmdbId && article.tmdbType)) && (
          <div className="mb-8">
            <InlineVideoPlayer
              heroImageUrl={article.heroImageUrl || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
              trailerUrl={article.heroVideoUrl || article.trailerLocalUrl}
              title={article.title}
            />
            <p className="text-xs text-gray-500 mt-2">
              Bild: {article.imageAttribution || 'TMDB'}
            </p>
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
        <div className="flex items-center justify-between gap-6 mb-8 pb-8 border-b">
          <div className="flex items-center gap-6">
            {article.users && (
              <div className="flex items-center gap-3">
                {article.users.image ? (
                  <div className="relative w-12 h-12 rounded-full overflow-hidden">
                    <Image
                      src={article.users.image}
                      alt={article.users.name || 'Author'}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
                    {(article.users.name || 'A').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <Link 
                    href={getAuthorUrl(article.users.name || '')}
                    className="font-semibold text-gray-900 hover:text-cyan-600 transition-colors"
                  >
                    {article.users.name || 'Anonymous'}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Clock className="h-4 w-4" />
                    <span>{getRelativeTime()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Share Button */}
          <ShareButton title={article.title} />
        </div>

        {/* Excerpt/Lead */}
        {article.excerpt && (
          <p className="text-xl text-gray-700 leading-relaxed font-medium">
            {article.excerpt}
          </p>
        )}
        </header>

        {/* Article Body */}
        <section aria-labelledby="article-content">
          <h2 id="article-content" className="sr-only">Artikel-Inhalt</h2>
          <div 
            className="prose prose-lg max-w-none mb-12 overflow-x-hidden"
            dangerouslySetInnerHTML={{ __html: sanitizeArticleContent(article.contentHtml || '', article.excerpt || undefined) }}
          />
        </section>

        {/* Series Infobox: AFTER content, BEFORE Q&A (Discover-optimized) */}
        {/* Hide for imported articles without real series assignment */}
        {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
          <SeriesInfobox
            seriesId={article.primarySeriesId}
            seriesName={article.series.title || article.series.name || ''}
            seriesSlug={article.series.slug}
          />
        )}

        {/* Q&A Section */}
        {article.article_qa && article.article_qa.questions && (
          <ArticleQA 
            questions={article.article_qa.questions as any[]}
            schemaEnabled={article.article_qa.schemaEnabled}
          />
        )}

        {/* Sidebar/Related Content */}
        <aside aria-labelledby="related-content">
          <h2 id="related-content" className="sr-only">Verwandte Inhalte</h2>

          {/* Where to Stream Box */}
          {/* Hide for imported articles without real series assignment */}
          {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
          <WhereToStreamBox
            seriesId={article.primarySeriesId}
            seriesName={article.series.title || article.series.name || ''}
            networks={article.series.networks}
            slug={article.series.slug}
          />
        )}

        {/* Related News */}
        {relatedNews.length > 0 && (
          <section className="mt-16" aria-labelledby="similar-news">
            <h3 id="similar-news" className="text-3xl font-bold mb-8">Ähnliche News</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedNews.map((news) => (
                <Link key={news.id} href={`/${news.slug}`}>
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
                      <p className="font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2">
                        {news.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        {news.publishedAt ? new Date(news.publishedAt).toLocaleDateString('de-DE', {
                          day: 'numeric',
                          month: 'short',
                        }) : 'Kein Datum'}
                      </p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </section>
        )}
        </aside>
      </article>
    </div>
  );
}
