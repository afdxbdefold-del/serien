import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import Breadcrumb from '@/components/Breadcrumb';
import { ArrowLeft, Clock, ChevronRight } from 'lucide-react';
import { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import ShareButton from '@/components/ShareButton';
import { SeriesInfobox } from '@/components/SeriesInfobox';
import WhereToStreamBox from '@/components/WhereToStreamBox';
import { sanitizeArticleContent } from '@/lib/content-sanitizer';
import ArticleQA from '@/components/ArticleQA';
import { generateArticleSchema, getImageDimensions, generateBreadcrumbSchema } from '@/lib/schema-generator';
import { getAuthorUrl } from '@/lib/author-utils';
import AuthorBox from '@/components/AuthorBox';
import NewsCard from '@/components/NewsCard';
import ContentWithAds from '@/components/ContentWithAds';
import ClientAdSlot from '@/components/ClientAdSlot';
import { WasBedeutetDas, DarumRelevant, BisherigerStand, type BisherigerStandData } from '@/components/WasBedeutetDas';

// Lazy load heavy client components
const InlineVideoPlayer = dynamic(() => import('@/components/InlineVideoPlayer'), {
  ssr: true,
  loading: () => (
    <div className="relative w-full aspect-[16/9] md:aspect-[21/9] bg-gray-900 animate-pulse" />
  ),
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
        wasBedeutetDasText: true,
        darumRelevantText: true,
        bisherigerStandText: true,
        users: {
          select: { id: true, name: true, image: true, bio: true, expertise: true }
        },
        series: {
          select: { 
            tmdbId: true, 
            title: true, 
            name: true, 
            slug: true, 
            networks: true,
            localTrailerPath: true,
            status: true,
            numberOfSeasons: true,
            firstAirDate: true,
            lastAirDate: true,
          }
        },
        article_qa: {
          select: { questions: true, schemaEnabled: true, headingType: true }
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

// Cached fetch for articles from the SAME series (for "Mehr zu <Serie>" cards)
const getSeriesArticles = (articleId: string, primarySeriesId: number) => unstable_cache(
  async () => {
    return prisma.articles.findMany({
      where: {
        OR: [
          { status: 'published' },
          { status: 'PUBLISHED' }
        ],
        id: { not: articleId },
        primarySeriesId,
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
        series: {
          select: { networks: true },
        },
      },
    });
  },
  [`series-articles-${articleId}-${primarySeriesId}`],
  { revalidate: 300, tags: ['series-articles'] }
)();

// ISR - Revalidate every 5 minutes for near-real-time data with caching
export const revalidate = 300;

// Cached TMDB season count fetch (for series missing numberOfSeasons in DB)
const getSeriesSeasonCount = (tmdbId: number) => unstable_cache(
  async () => {
    try {
      const tmdbKey = process.env.TMDB_API_KEY;
      if (!tmdbKey) return null;
      const res = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}?language=de-DE&api_key=${tmdbKey}`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      // Update DB in background
      prisma.series.update({ where: { tmdbId }, data: { numberOfSeasons: data.number_of_seasons, lastAirDate: data.last_air_date ? new Date(data.last_air_date) : undefined } }).catch(() => {});
      return { numberOfSeasons: data.number_of_seasons as number, lastAirDate: data.last_air_date as string | null, networks: (data.networks || []).map((n: any) => n.name) as string[] };
    } catch { return null; }
  },
  [`tmdb-seasons-${tmdbId}`],
  { revalidate: 86400, tags: [`tmdb-${tmdbId}`] } // 24h cache
)();

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
        publishedAt: true,
        updatedAt: true,
        contentType: true,
        users: {
          select: { name: true },
        },
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
    notFound();
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
      publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
      modifiedTime: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
      authors: article.users?.name ? [article.users.name] : undefined,
      section: article.contentType || 'Serien News',
      images: ogImage ? [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: article.title,
          type: 'image/webp',
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
  
  // 301 Redirect: If slug matches a series, redirect to /serie/slug
  const matchingSeries = await prisma.series.findFirst({
    where: { slug },
    select: { slug: true },
  });
  if (matchingSeries) {
    permanentRedirect(`/serie/${slug}`);
  }

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

  // Fetch same-series articles for "Mehr zu <Serie>" card section
  const seriesArticles = article.primarySeriesId
    ? await getSeriesArticles(article.id, article.primarySeriesId)
    : [];

  // Fetch TMDB season data if missing from DB (cached 24h)
  let seriesSeasonData: { numberOfSeasons: number; lastAirDate: string | null; networks: string[] } | null = null;
  if (article.series && !article.series.numberOfSeasons) {
    seriesSeasonData = await getSeriesSeasonCount(article.series.tmdbId);
  }

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

  // Reading time (200 wpm)
  const plainText = (article.contentHtml || '').replace(/<[^>]+>/g, ' ');
  const wordCount = plainText.trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(wordCount / 200));

  // Determine image URL
  const imageUrl = article.heroImagePath || 
    article.ogImageUrl || 
    (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl) || 
    '/og-image.png';
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';

  // Generate structured data with ImageObject
  const authorSlug = article.users?.name ? 
    article.users.name.toLowerCase()
      .replace(/[äöü]/g, (c: string) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue' }[c] || c))
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') 
    : undefined;

  const articleSchema = generateArticleSchema({
    title: article.title,
    description: article.excerpt || '',
    imageUrl,
    imageDimensions: getImageDimensions(imageUrl),
    datePublished: toDate(article.publishedAt || article.createdAt).toISOString(),
    dateModified: toDate(article.updatedAt).toISOString(),
    slug,
    author: article.users?.name,
    authorSlug,
    category: article.category || article.contentType || 'Serien News',
  });

  // Generate BreadcrumbList schema
  const seriesName = article.series?.name || article.series?.title;
  const seriesSlug = article.series?.slug;
  const breadcrumbItems = [
    { name: 'Startseite', url: '/' },
    ...(seriesName && seriesSlug ? [{ name: seriesName, url: `/serie/${seriesSlug}` }] : []),
    { name: article.title, url: `/${slug}` },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  // Generate VideoObject schema if article has a video/trailer
  const videoUrl = article.heroVideoUrl || article.trailerLocalUrl || 
    (article.series?.localTrailerPath && 
     article.series.localTrailerPath !== 'unavailable' && 
     article.series.localTrailerPath !== 'SKIP' && 
     article.series.localTrailerPath.startsWith('http') 
      ? article.series.localTrailerPath 
      : null);

  const videoSchema = videoUrl ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: `${article.title} - Trailer`,
    description: article.excerpt || `Trailer zu ${article.title}`,
    thumbnailUrl: imageUrl.startsWith('http') ? imageUrl : `${baseUrl}${imageUrl}`,
    uploadDate: toDate(article.publishedAt || article.createdAt).toISOString(),
    contentUrl: videoUrl,
    embedUrl: videoUrl,
    inLanguage: 'de',
    publisher: {
      '@type': 'Organization',
      name: 'serien.de',
      url: baseUrl,
    },
  } : null;

  return (
    <div className="min-h-screen bg-white dark:bg-[hsl(230,25%,5%)]">
      {/* Google AdSense Script - Only on article pages */}
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      {/* JSON-LD Structured Data with ImageObject */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
      
      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />

      {/* VideoObject Schema */}
      {videoSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoSchema),
          }}
        />
      )}

      {/* Article Content Section */}
      <article className="bg-white dark:bg-[hsl(230,25%,5%)]">
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-3xl">
          
          {/* Breadcrumb */}
          {article.series ? (
            <Breadcrumb items={[{ label: article.series.title || article.series.name, href: `/serie/${article.series.slug}` }, { label: article.title }]} className="mb-4" />
          ) : (
            <Breadcrumb items={[{ label: article.title }]} className="mb-4" />
          )}

          {/* Title */}
          <h1 data-speakable="headline" className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 leading-tight text-center">
            {article.title}
          </h1>

          {/* Author Meta Line (inline, centered, no avatar) */}
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
            {article.users && (
              <>
                <Link
                  href={getAuthorUrl(article.users.name || '')}
                  rel="author"
                  className="font-semibold text-gray-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                >
                  {article.users.name || 'Redaktion'}
                </Link>
                <span className="mx-2">·</span>
              </>
            )}
            <span>
              {publishedDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
            <span className="mx-2">·</span>
            <span>{readingMinutes} Min</span>
          </div>

          {/* HERO - Video/Image */}
          {(article.heroImageUrl || article.heroLocalUrl || (article.tmdbId && article.tmdbType)) && (
            <div className="relative w-full bg-black rounded-lg overflow-hidden mb-6">
              {article.category === 'neue-videos' ? (
                <div className="relative aspect-video">
                  {article.heroVideoUrl && !article.heroVideoUrl.includes('youtube.com') ? (
                    <video
                      className="w-full h-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      poster={article.heroImageUrl || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : undefined)}
                    >
                      <source src={article.heroVideoUrl} type="video/mp4" />
                      Dein Browser unterstützt HTML5 Video nicht.
                    </video>
                  ) : (
                    <Image
                      src={article.heroImageUrl || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
                      alt={article.title}
                      fill
                      className="object-cover"
                      priority
                    />
                  )}
                </div>
              ) : (
                <InlineVideoPlayer
                  heroImageUrl={article.heroImageUrl || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
                  trailerUrl={article.heroVideoUrl || article.trailerLocalUrl || (article.series?.localTrailerPath && article.series.localTrailerPath !== 'unavailable' && article.series.localTrailerPath !== 'SKIP' && article.series.localTrailerPath.startsWith('http') ? article.series.localTrailerPath : null)}
                  title={article.title}
                  fullWidth={false}
                />
              )}
            </div>
          )}

          {/* Excerpt/Lead - Bold Intro */}
          {article.excerpt && (
            <p data-speakable="summary" className="text-lg md:text-xl text-gray-800 dark:text-gray-200 leading-relaxed font-semibold mb-8">
              {article.excerpt}
            </p>
          )}

          {/* Cyan Accent Line */}
          <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded mb-6" />

          {/* Ad Unit - Above Intro */}
          <ClientAdSlot position="above_intro" className="mb-6" />

          {/* Ad Unit - Below Intro */}
          <ClientAdSlot position="below_intro" className="mb-8" />

          {/* Article Body with Ads between paragraphs */}
          <section aria-labelledby="article-content">
            <h2 id="article-content" className="sr-only">Artikel-Inhalt</h2>
            <ContentWithAds 
              html={sanitizeArticleContent(article.contentHtml || '', article.excerpt || undefined)}
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-10 
                prose-headings:text-gray-900 dark:prose-headings:text-white
                prose-p:text-gray-700 dark:prose-p:text-gray-300
                prose-a:text-cyan-600 dark:prose-a:text-cyan-400
                prose-strong:text-gray-900 dark:prose-strong:text-white
                prose-img:rounded-lg"
            />
          </section>

          {/* Ad Unit - Below Q&A */}
          <ClientAdSlot position="below_author" className="my-8" />

          {/* Mehr zu <Serie> - Cards from same series */}
          {seriesArticles.length > 0 && article.series && (
            <section aria-labelledby="series-more" className="mt-10 mb-10">
              <h3 id="series-more" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Mehr zu „{article.series.title || article.series.name}"
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {seriesArticles.map((news) => (
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

          {/* Article Meta - Source & Last Updated */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500 dark:text-gray-400 border-t border-b border-gray-200 dark:border-gray-700 py-4 my-8">
            {article.series?.networks && (article.series.networks as string[]).length > 0 && (
              <span>
                <span className="font-medium text-gray-700 dark:text-gray-300">Quelle:</span> {(article.series.networks as string[])[0]}
              </span>
            )}
            <span>
              <span className="font-medium text-gray-700 dark:text-gray-300">Zuletzt aktualisiert:</span> {toDate(article.updatedAt || article.publishedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, {toDate(article.updatedAt || article.publishedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </span>
          </div>

          {/* Artikel teilen */}
          <div className="mt-8 mb-4">
            <ShareButton title={article.title} />
          </div>

          {/* Trust / E-E-A-T Author Box */}
          {article.users && (
            <div className="mt-10">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                Artikel geschrieben von:
              </h3>
              <AuthorBox
                author={{
                  id: article.users.id,
                  name: article.users.name,
                  image: article.users.image,
                  bio: (article.users as any).bio ?? null,
                  expertise: ((article.users as any).expertise as string[]) ?? [],
                }}
              />
            </div>
          )}

          {/* Ad Unit - Above Footer */}
          <ClientAdSlot position="above_footer" className="my-8" />
        </div>
      </article>

      {/* Ähnliche News — außerhalb von <article> */}
      {relatedNews.length > 0 && (
        <div className="container mx-auto px-4 md:px-6 max-w-3xl py-8">
          <section aria-labelledby="similar-news">
            <h3 id="similar-news" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Neue News</h3>
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
        </div>
      )}

      {/* Serien-Infobox + Streaming-Box — außerhalb von <article> */}
      <div className="container mx-auto px-4 md:px-6 max-w-3xl pb-8">
        {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
          <SeriesInfobox
            seriesId={article.primarySeriesId}
            seriesName={article.series.title || article.series.name || ''}
            seriesSlug={article.series.slug || ''}
          />
        )}
        {article.primarySeriesId && article.series && article.contentType !== 'IMPORTED' && (
          <WhereToStreamBox
            seriesId={article.primarySeriesId}
            seriesName={article.series.title || article.series.name || ''}
            networks={article.series.networks}
            slug={article.series.slug}
          />
        )}
      </div>
    </div>
  );
}
