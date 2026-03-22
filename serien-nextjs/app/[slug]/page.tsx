import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { ArrowLeft, Clock } from 'lucide-react';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import ShareButton from '@/components/ShareButton';
import { SeriesInfobox } from '@/components/SeriesInfobox';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import { sanitizeArticleContent } from '@/lib/content-sanitizer';
import ArticleQA from '@/components/ArticleQA';
import { generateArticleSchema, getImageDimensions } from '@/lib/schema-generator';
import { getAuthorUrl } from '@/lib/author-utils';
import NewsCard from '@/components/NewsCard';

// Lazy load heavy client components
const InlineVideoPlayer = dynamic(() => import('@/components/DirectVideoPlayer'), {
  ssr: true,
  loading: () => (
    <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-gray-900 animate-pulse" />
  ),
});

const AdUnit = dynamic(() => import('@/components/AdUnit'), {
  loading: () => null,
});

// Helper to safely convert Date or ISO string to Date object
const toDate = (value: Date | string | null | undefined): Date => {
  if (!value) return new Date();
  return value instanceof Date ? value : new Date(value);
};

// Cached article fetch with optimized select
const getArticle = (slug: string) => unstable_cache(
  async () => {
    return prisma.articles.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        contentHtml: true,
        heroImageUrl: true,
        heroLocalUrl: true,
        heroVideoUrl: true,
        trailerLocalUrl: true,
        heroImagePath: true,
        ogImageUrl: true,
        tmdbId: true,
        tmdbType: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true,
        category: true,
        primarySeriesId: true,
        status: true,
        contentType: true,
        users: {
          select: { id: true, name: true, image: true }
        },
        series: {
          select: { 
            tmdbId: true, 
            title: true, 
            name: true, 
            slug: true, 
            networks: true 
          }
        },
        article_qa: {
          select: { questions: true, schemaEnabled: true }
        },
      },
    });
  },
  [`article-${slug}`],
  { revalidate: 300, tags: ['article', `article-${slug}`] }
)();

// Cached related news fetch
const getRelatedNews = (articleId: string, category: string | null, primarySeriesId: number | null) => unstable_cache(
  async () => {
    return prisma.articles.findMany({
      where: {
        OR: [
          { status: 'published' },
          { status: 'PUBLISHED' }
        ],
        id: { not: articleId },
        AND: category || primarySeriesId ? [
          {
            OR: [
              category ? { category } : {},
              primarySeriesId ? { primarySeriesId } : {},
            ].filter(o => Object.keys(o).length > 0),
          }
        ] : [],
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        heroLocalUrl: true,
        cardImageUrl: true,
        tmdbId: true,
        tmdbType: true,
        publishedAt: true,
        category: true,
        users: {
          select: { name: true },
        },
        series: {
          select: { networks: true },
        },
      },
    });
  },
  [`related-news-${articleId}`],
  { revalidate: 300, tags: ['related-news'] }
)();

// ISR - Revalidate every 5 minutes for near-real-time data with caching
export const revalidate = 300;

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Cached metadata fetch (lightweight)
const getArticleMetadata = (slug: string) => unstable_cache(
  async () => {
    return prisma.articles.findUnique({
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
  },
  [`article-metadata-${slug}`],
  { revalidate: 300, tags: ['article-metadata', `article-${slug}`] }
)();

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleMetadata(slug);

  if (!article) {
    return {
      title: 'Artikel nicht gefunden | serien.de',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  // Build absolute OG image URL
  // Use TMDB image pipeline if available, fallback to local URL
  const ogImagePath = article.ogImageUrl || 
    (article.tmdbId && article.tmdbType ? `/img/og/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl);
  
  // Make sure OG image is absolute URL
  const ogImage = ogImagePath?.startsWith('http') 
    ? ogImagePath 
    : ogImagePath 
      ? `${baseUrl}${ogImagePath.startsWith('/') ? '' : '/'}${ogImagePath}`
      : null;

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
      canonical: `${baseUrl}/${slug}`,
    },
    openGraph: {
      title: article.title,
      description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
      type: 'article',
      url: `${baseUrl}/${slug}`,
      siteName: 'serien.de',
      locale: 'de_DE',
      images: ogImage ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: article.title,
          type: 'image/jpeg',
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt || 'Aktuelle Serien-News auf serien.de',
      images: ogImage ? [ogImage] : undefined,
      site: '@serien_de',
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  
  // Fetch article with cached query
  const article = await getArticle(slug);

  if (!article || (article.status?.toLowerCase() !== 'published')) {
    notFound();
  }

  // Fetch related news with cached query
  const relatedNews = await getRelatedNews(
    article.id, 
    article.category, 
    article.primarySeriesId
  );

  // Format dates - handle both Date objects and ISO strings from cache
  const publishedDate = toDate(article.publishedAt || article.createdAt);
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
    datePublished: toDate(article.publishedAt || article.createdAt).toISOString(),
    dateModified: toDate(article.updatedAt).toISOString(),
    slug,
    author: article.users?.name,
  });

  return (
    <div className="min-h-screen bg-white dark:bg-[hsl(230,25%,5%)]">
      {/* JSON-LD Structured Data with ImageObject */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      {/* HERO SECTION - Full Width Video/Image */}
      <div className="relative w-full bg-black">
        {(article.heroImageUrl || article.heroLocalUrl || (article.tmdbId && article.tmdbType)) && (
          <InlineVideoPlayer
            heroImageUrl={article.heroImageUrl || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
            trailerUrl={article.heroVideoUrl || article.trailerLocalUrl}
            title={article.title}
            fullWidth={true}
          />
        )}
        
        {/* Video/Series Title Overlay at bottom */}
        {article.series && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 py-3">
            <Link 
              href={`/serie/${article.series.tmdbId}-${article.series.slug}`}
              className="text-white/90 hover:text-white text-sm line-clamp-1"
            >
              {article.series.title} <span className="text-white/60">... mehr</span>
            </Link>
          </div>
        )}
      </div>

      {/* Article Content Section */}
      <article className="bg-white dark:bg-[hsl(230,25%,5%)]">
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-3xl">
          
          {/* Breadcrumb - Back to Series */}
          {article.series ? (
            <Link 
              href={`/serie/${article.series.tmdbId}-${article.series.slug}`}
              className="inline-flex items-center gap-1 text-cyan-500 hover:text-cyan-400 text-sm font-medium mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Zu {article.series.title || article.series.name}
            </Link>
          ) : (
            <Link 
              href="/"
              className="inline-flex items-center gap-1 text-cyan-500 hover:text-cyan-400 text-sm font-medium mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Zur Startseite
            </Link>
          )}

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-5 leading-tight">
            {article.title}
          </h1>

          {/* Author & Date */}
          <div className="flex items-center gap-3 mb-6">
            {article.users && (
              <>
                {article.users.image ? (
                  <Link href={getAuthorUrl(article.users.name || '')} className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={article.users.image}
                      alt={article.users.name || 'Author'}
                      fill
                      className="object-cover"
                    />
                  </Link>
                ) : (
                  <Link href={getAuthorUrl(article.users.name || '')} className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {(article.users.name || 'A').charAt(0).toUpperCase()}
                  </Link>
                )}
                <div className="text-sm">
                  <Link 
                    href={getAuthorUrl(article.users.name || '')}
                    className="font-semibold text-gray-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                  >
                    {article.users.name || 'Redaktion'}
                  </Link>
                  <span className="text-gray-500 dark:text-gray-400">,</span>
                  <br className="sm:hidden" />
                  <span className="text-gray-500 dark:text-gray-400 sm:ml-1">
                    {publishedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {publishedDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Cyan Accent Line */}
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded mb-6" />

          {/* Excerpt/Lead - Bold Intro */}
          {article.excerpt && (
            <p className="text-lg md:text-xl text-gray-800 dark:text-gray-200 leading-relaxed font-semibold mb-8">
              {article.excerpt}
            </p>
          )}

          {/* Article Body */}
          <section aria-labelledby="article-content">
            <h2 id="article-content" className="sr-only">Artikel-Inhalt</h2>
            <div 
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-10 
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-a:text-cyan-600 dark:prose-a:text-cyan-400
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-img:rounded-lg"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleContent(article.contentHtml || '', article.excerpt || undefined) }}
            />
          </section>

          {/* Article Meta - Source & Last Updated */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 border-t border-b border-gray-200 dark:border-gray-700 py-4 my-8">
            {article.series?.networks && (article.series.networks as string[]).length > 0 && (
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">Quelle:</span> {(article.series.networks as string[])[0]}
              </span>
            )}
            <span>
              <span className="font-medium text-gray-700 dark:text-gray-300">Zuletzt aktualisiert:</span> {toDate(article.updatedAt || article.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>

          {/* Ad Unit - After Article Content */}
          <div className="my-8">
            <AdUnit slot="9876543210" format="rectangle" />
          </div>

          {/* Share Button - Above Infoboxes */}
          <div className="flex justify-end mb-8">
            <ShareButton title={article.title} />
          </div>

          {/* Q&A Section */}
          {article.article_qa && article.article_qa.questions && (
            <ArticleQA 
              questions={article.article_qa.questions as any[]}
              schemaEnabled={article.article_qa.schemaEnabled}
            />
          )}

          {/* Series Infobox */}
          {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
            <div className="mb-8">
              <SeriesInfobox
                seriesId={article.primarySeriesId}
                seriesName={article.series.title || article.series.name || ''}
                seriesSlug={article.series.slug || ''}
              />
            </div>
          )}

          {/* Where to Stream Box */}
          {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
            <div className="mb-8">
              <WhereToStreamBox
                seriesId={article.primarySeriesId}
                seriesName={article.series.title || article.series.name || ''}
                networks={article.series.networks}
                slug={article.series.slug}
              />
            </div>
          )}

          {/* Related News */}
          {relatedNews.length > 0 && (
            <section className="mt-12" aria-labelledby="similar-news">
              <h3 id="similar-news" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Ähnliche News</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedNews.map((news) => (
                  <NewsCard
                    key={news.id}
                    slug={news.slug}
                    title={news.title}
                    excerpt={news.excerpt}
                    heroLocalUrl={news.heroLocalUrl}
                    cardImageUrl={news.cardImageUrl}
                    tmdbId={news.tmdbId}
                    tmdbType={news.tmdbType}
                    publishedAt={news.publishedAt}
                    category={news.category}
                    networks={news.series?.networks as string[] || []}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}
