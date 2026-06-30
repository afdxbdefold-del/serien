import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
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
import { seoTitle, seoDescription } from '@/lib/seo-meta';
import { getAuthorUrl } from '@/lib/author-utils';
import AuthorBox from '@/components/AuthorBox';
import NewsCard from '@/components/NewsCard';
import ContentWithAds from '@/components/ContentWithAds';
import ArticleInterstitial from '@/components/ArticleInterstitial';
import { headers } from 'next/headers';
import ClientAdSlot from '@/components/ClientAdSlot';
import GlobalTags from '@/components/GlobalTags';
import { WasBedeutetDas, DarumRelevant, BisherigerStand, type BisherigerStandData } from '@/components/WasBedeutetDas';
import InlineVideoPlayer from '@/components/InlineVideoPlayer';

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
        imageAttribution: true,
        wasBedeutetDasText: true,
        darumRelevantText: true,
        bisherigerStandText: true,
        metaDescription: true,
        tags: true,
        sourceUrl: true,
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
const getRelatedNews = (articleId: string) => unstable_cache(
  async () => {
    return prisma.articles.findMany({
      where: {
        OR: [
          { status: 'published' },
          { status: 'PUBLISHED' }
        ],
        id: { not: articleId },
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        heroLocalUrl: true,
        heroImageUrl: true,
        heroImagePath: true,
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
  [`latest-news-${articleId}`],
  { revalidate: 300, tags: ['latest-news'] }
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
        heroImageUrl: true,
        heroImagePath: true,
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

// E-E-A-T: Other articles by the SAME author about the SAME series.
// Used for the "Mehr zu dieser Serie von <Autor>"-Section under the author trust box.
const getAuthorSeriesArticles = (articleId: string, primarySeriesId: number, authorId: string) => unstable_cache(
  async () => {
    return prisma.articles.findMany({
      where: {
        OR: [
          { status: 'published' },
          { status: 'PUBLISHED' },
        ],
        id: { not: articleId },
        primarySeriesId,
        authorId,
      },
      take: 3,
      orderBy: { publishedAt: 'desc' },
      select: {
        slug: true,
        title: true,
        publishedAt: true,
      },
    });
  },
  [`author-series-articles-${articleId}-${primarySeriesId}-${authorId}`],
  { revalidate: 300, tags: ['author-series-articles'] }
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
        metaDescription: true,
        category: true,
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

  // Schema/metadata URLs are always canonical (https://serien.de), even on
  // Vercel preview deployments — the social-card platforms must never see
  // a `*.vercel.app` URL.
  const baseUrl = 'https://serien.de';

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

  const finalTitle = seoTitle(article.title);
  const finalDescription = seoDescription(article.metaDescription || article.excerpt || '');

  // Map internal contentType / category to a public-facing section label.
  const PUBLIC_SECTION_LABEL: Record<string, string> = {
    'imported_with_series': 'Serien-News',
    'serien_news': 'Serien-News',
    'series_news': 'Serien-News',
    'streaming_news': 'Streaming-News',
    'trailer_news': 'Trailer-News',
    'review': 'Review',
    'erklaerartikel': 'Erklärartikel',
    'erklär': 'Erklärartikel',
    'erklarartikel': 'Erklärartikel',
    'ranking': 'Ranking',
    'allgemein': 'Serien-News',
  };
  const rawSection = (article.category || article.contentType || '').toString().trim().toLowerCase();
  const publicSection = PUBLIC_SECTION_LABEL[rawSection]
    || (article.category && !/_/.test(article.category) ? article.category : 'Serien-News');

  return {
    title: finalTitle,
    description: finalDescription,
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
      languages: {
        'de-DE': `${baseUrl}/${slug}`,
        'x-default': `${baseUrl}/${slug}`,
      },
    },
    openGraph: {
      title: article.title,
      description: finalDescription,
      type: 'article',
      url: `${baseUrl}/${slug}`,
      siteName: 'serien.de',
      locale: 'de_DE',
      publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined,
      modifiedTime: article.updatedAt ? new Date(article.updatedAt).toISOString() : undefined,
      authors: article.users?.name ? [article.users.name] : undefined,
      section: publicSection,
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
      description: finalDescription,
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

  // Fetch 3 latest news (site-wide) for "Neue News" section
  const relatedNews = await getRelatedNews(article.id);

  // Fetch same-series articles for "Mehr zu <Serie>" card section
  const seriesArticles = article.primarySeriesId
    ? await getSeriesArticles(article.id, article.primarySeriesId)
    : [];

  // E-E-A-T: other articles by the SAME author about the SAME series
  const authorSeriesArticles = (article.primarySeriesId && article.users?.id)
    ? await getAuthorSeriesArticles(article.id, article.primarySeriesId, article.users.id)
    : [];

  // Fetch TMDB season data if missing from DB (cached 24h)
  let seriesSeasonData: { numberOfSeasons: number; lastAirDate: string | null; networks: string[] } | null = null;
  if (article.series && !article.series.numberOfSeasons) {
    seriesSeasonData = await getSeriesSeasonCount(article.series.tmdbId);
  }

  // Format dates - handle both Date objects and ISO strings from cache
  const publishedDate = toDate(article.publishedAt || article.createdAt);
  const formattedDate = publishedDate.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', year: 'numeric',
    month: 'long',
    day: 'numeric' });

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

  // Cache-bust blob-hosted composite heroes: Vercel Blob serves `max-age=2592000`
  // (30 days), and the blob URL is deterministic per articleId, so browsers
  // never re-fetch after a hero regeneration unless the URL changes.
  // We append `?v=<updatedAtMs>` only when the URL points at our own blob
  // storage — TMDB CDN URLs are content-addressed and don't need busting.
  const cacheBustHero = (url: string | null | undefined): string | null | undefined => {
    if (!url) return url;
    if (!url.includes('.blob.vercel-storage.com/articles/')) return url;
    const v = toDate(article.updatedAt || article.publishedAt).getTime();
    return url.includes('?') ? `${url}&v=${v}` : `${url}?v=${v}`;
  };
  const heroImageUrlCB = cacheBustHero(article.heroImageUrl);

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
    description: article.metaDescription || article.excerpt || '',
    imageUrl,
    imageDimensions: getImageDimensions(imageUrl),
    datePublished: toDate(article.publishedAt || article.createdAt).toISOString(),
    dateModified: toDate(article.updatedAt).toISOString(),
    slug,
    author: article.users?.name,
    authorSlug,
    // E-E-A-T author signals straight from DB. Google weights these heavily
    // for Discover: real images, real expertise tags, real bios.
    authorImage: article.users?.image,
    authorBio: article.users?.bio,
    authorExpertise: article.users?.expertise,
    category: article.category || article.contentType || 'Serien-News',
    aboutSeriesSlug: article.series?.slug,
    aboutSeriesName: article.series?.title || article.series?.name || undefined,
    wordCount: article.contentHtml
      ? article.contentHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
      : undefined,
    keywords: article.tags && article.tags.length > 0 ? article.tags : undefined,
    // Plain-text body (HTML stripped, whitespace collapsed) for Discover indexers
    articleBody: article.contentHtml
      ? article.contentHtml
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : undefined,
    // E-E-A-T: explicit attribution to the journalistic source (Variety, Deadline, …).
    sourceUrl: article.sourceUrl || undefined,
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

  // VideoObject-Schema bewusst NICHT mehr in News-Artikeln gerendert —
  // Google klassifizierte einige News dadurch als "video page" statt
  // "news article", was Top-Stories-Eligibility verschlechtert hat.
  // TVSeries-Schema auf /serie/[slug] behält seine `trailer`-Property.

  // Schema URLs must always be canonical (production), even when running on a
  // Vercel preview deployment.
  const SCHEMA_BASE = 'https://serien.de';

  // Hero preload URL for LCP optimization. We render an explicit
  // <link rel="preload" as="image"> in <head> so Chromium downloads the
  // hero before parsing the article body — Discover ranks LCP-image quality
  // heavily, and Googlebot weights `preload`-hinted images higher.
  const heroPreloadUrl = heroImageUrlCB
    || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl)
    || null;

  return (
    <div className="min-h-screen bg-white dark:bg-[hsl(230,25%,5%)]">
      {/* Article-only ad interstitial. Reads its creative from the
          admin-managed ad_slots table (position="interstitial"). Renders
          nothing if the slot is inactive or empty. Appears on every page
          view — there is no per-session cap.

          Defense-in-depth: we ALSO skip emitting the component on the
          server when the request's User-Agent looks like a bot — so
          Googlebot / SEO crawlers / preview tools never even receive the
          script. Belt + braces on top of the client-side UA check. */}
      {await (async () => {
        const h = await headers();
        const ua = h.get('user-agent') || '';
        const BOT_RE = /bot|crawler|spider|googlebot|bingbot|applebot|gptbot|claudebot|chatgpt|ccbot|petalbot|yandexbot|baiduspider|duckduckbot|facebookexternalhit|whatsapp|telegrambot|twitterbot|linkedinbot|slackbot|pinterest|embedly|preview|prerender|headless|lighthouse|pagespeed|gtmetrix|webpagetest/i;
        if (BOT_RE.test(ua)) return null;
        return <ArticleInterstitial />;
      })()}

      {/* LCP: preload the hero image so Chromium fetches it before the
          article body parses. Next.js can't auto-emit this because the
          hero is rendered by a Client Component (InlineVideoPlayer). */}
      {heroPreloadUrl && (
        <link
          rel="preload"
          as="image"
          href={heroPreloadUrl}
          fetchPriority="high"
        />
      )}

      {/* AdSense Loader — als raw <script async> direkt im SSR-HTML, NICHT
          via next/script `afterInteractive`. Grund: `afterInteractive` startet
          das Script erst NACH der React-Hydration. Auf Twitter-/X-In-App-
          Browsern (Bulk unseres /x-news-Traffics) dauert die Hydration 5-10 s
          — viele User bouncen vorher zurück nach X, ohne dass das AdSense-
          Pixel je gefeuert hat. Resultat: Page-View in unserer DB gezählt,
          aber NULL bei AdSense. Erklärt die 12k→1k-Gap (~8 % Pixel-Fire-Rate
          = User die >5s bleiben).
          
          Raw <script async> wird vom Browser parallel zum HTML-Parse geladen
          und sofort beim Eintreffen ausgeführt — Ad-Pixel feuert nach 1-2 s
          statt 5-10 s. Kein Hydration-Lock, kein next/script-Lifecycle.
          
          SPA-Navigation zwischen Artikeln: Da [slug]/page.tsx eine Server
          Component ist, wird dieser <script>-Tag bei jeder vollständigen
          Navigation neu im HTML emittiert. Next.js dedupliziert externe
          Script-URLs nicht automatisch, aber das ist OK — adsbygoogle.js
          ist idempotent und nutzt ein globales Queue-Array. */}
      <script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805"
        crossOrigin="anonymous"
        data-npa-on-unknown-consent="1"
      />

      {/* Globale Custom-Tags (The-Moneytizer-Loader, Header-Bidding-
          Wrapper, externe SSP-Pixel …). Verwaltet via /admin/global-tags.
          NUR auf Artikelseiten (dieser Page-Component). Bot-Traffic wird
          serverseitig gefiltert (UA-Check in lib/global-tags.ts). */}
      <GlobalTags placement="head" />
      <GlobalTags placement="body-start" />

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

      {/* Article Content Section */}
      <article className="bg-white dark:bg-[hsl(230,25%,5%)]">
        {/* ─────── Desktop-only Top-of-Article Ads ─────── */}
        {/* Billboard Header (970×250) ÜBER dem Megabanner Top.
            `empty:hidden` lässt den Wrapper komplett kollabieren, wenn
            ClientAdSlot null rendert (kein aktiver Slot). Verhindert
            visuelle Lücken bei deaktivierten Slots. */}
        <div className="hidden lg:flex w-full justify-center pt-4 pb-2 px-4 empty:hidden empty:!pt-0 empty:!pb-0" data-ad-slot-wrapper="desktop_billboard_header">
          <ClientAdSlot position="desktop_billboard_header" />
        </div>
        {/* Megabanner Top (970×90) direkt über Breadcrumb / Titel. */}
        <div className="hidden lg:flex w-full justify-center pb-4 px-4 empty:hidden empty:!pb-0" data-ad-slot-wrapper="desktop_megabanner_top">
          <ClientAdSlot position="desktop_megabanner_top" />
        </div>

        {/* ─────── Desktop Sticky Skyscrapers (nur ab xl ≥ 1280 px,
            damit sie nicht mit dem Article-Body kollidieren). Fixed an
            den Viewport-Rändern, top-24 = unterhalb des Headers.
            empty:hidden → kein leerer fixed-Block. ─── */}
        <aside
          className="hidden xl:block fixed left-2 2xl:left-6 top-24 z-30 w-[160px] empty:hidden"
          aria-label="Werbung Skyscraper links"
          data-ad-slot-wrapper="desktop_skyscraper_left"
        >
          <ClientAdSlot position="desktop_skyscraper_left" />
        </aside>
        <aside
          className="hidden xl:block fixed right-2 2xl:right-6 top-24 z-30 w-[160px] empty:hidden"
          aria-label="Werbung Skyscraper rechts"
          data-ad-slot-wrapper="desktop_skyscraper_right"
        >
          <ClientAdSlot position="desktop_skyscraper_right" />
        </aside>

        {/* ─────── Layout-Wrapper: Mobile = single column max-w-3xl
            (unverändert). Desktop ≥ lg: zweispaltiges Grid
            [Content max-w-3xl | Sidebar 300px] zentriert in max-w-[1100px]. ─── */}
        <div className="container mx-auto px-4 md:px-6 py-6 max-w-3xl lg:max-w-[1100px] lg:grid lg:grid-cols-[minmax(0,720px)_300px] lg:gap-8 lg:justify-center">

          {/* ─────────────────────────── MAIN COLUMN ─────────────────────────── */}
          <div className="w-full lg:max-w-[720px]">
          
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
              {publishedDate.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })}
              {', '}
              {publishedDate.toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr
            </span>
            <span className="mx-2">·</span>
            <span>{readingMinutes} Min</span>
          </div>

          {/* HERO - Video/Image */}
          {(article.heroImageUrl || article.heroLocalUrl || (article.tmdbId && article.tmdbType)) && (
            <figure className="mb-6">
              <div className="relative w-full bg-black rounded-lg overflow-hidden">
                {article.category === 'neue-videos' ? (
                  <div className="relative aspect-video">
                    {article.heroVideoUrl && !article.heroVideoUrl.includes('youtube.com') ? (
                      <video
                        className="w-full h-full object-cover"
                        controls
                        playsInline
                        preload="metadata"
                        poster={heroImageUrlCB || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : undefined)}
                      >
                        <source src={article.heroVideoUrl} type="video/mp4" />
                        Dein Browser unterstützt HTML5 Video nicht.
                      </video>
                    ) : (
                      <Image
                        src={heroImageUrlCB || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
                        alt={article.title}
                        fill
                        className="object-cover"
                        priority
                        fetchPriority="high"
                        sizes="(max-width: 1024px) 100vw, 1024px"
                      />
                    )}
                  </div>
                ) : (
                  <InlineVideoPlayer
                    heroImageUrl={heroImageUrlCB || (article.tmdbId && article.tmdbType ? `/img/hero/${article.tmdbType}/${article.tmdbId}` : article.heroLocalUrl!)}
                    trailerUrl={article.heroVideoUrl || article.trailerLocalUrl || (article.series?.localTrailerPath && article.series.localTrailerPath !== 'unavailable' && article.series.localTrailerPath !== 'SKIP' && article.series.localTrailerPath.startsWith('http') ? article.series.localTrailerPath : null)}
                    title={article.title}
                    fullWidth={false}
                  />
                )}
              </div>
              <figcaption className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                Bild: {[article.series?.networks?.[0], article.imageAttribution || 'TMDB'].filter(Boolean).join(' · ')}
              </figcaption>
            </figure>
          )}

          {/* Ad Unit - Above Intro */}
          <ClientAdSlot position="above_intro" className="mb-6" />

          {/* Excerpt/Lead - Bold Intro */}
          {article.excerpt && (
            <p data-speakable="summary" className="text-lg md:text-xl text-gray-800 dark:text-gray-200 leading-relaxed font-semibold mb-8">
              {article.excerpt}
            </p>
          )}

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
              <h2 id="series-more" className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Mehr zu „{article.series.title || article.series.name}"
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {seriesArticles.map((news) => (
                  <NewsCard
                    key={news.id}
                    slug={news.slug}
                    title={news.title}
                    excerpt={news.excerpt}
                    heroImageUrl={news.heroImageUrl || (news.heroImagePath ? `/${news.heroImagePath.replace(/^\//, '')}` : undefined)}
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
              <span className="font-medium text-gray-700 dark:text-gray-300">Zuletzt aktualisiert:</span> {toDate(article.updatedAt || article.publishedAt).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })}, {toDate(article.updatedAt || article.publishedAt).toLocaleTimeString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr
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

              {/* Mehr zu dieser Serie vom gleichen Autor */}
              {authorSeriesArticles.length > 0 && article.series && article.users.name && (
                <div className="mt-4 bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700 p-5" data-testid="author-series-articles">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                    Mehr zu {article.series.title || article.series.name} von {article.users.name.split(' ')[0]}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {article.users.name.split(' ')[0]} hat {authorSeriesArticles.length === 1 ? 'einen weiteren Artikel' : `${authorSeriesArticles.length} weitere Artikel`} zur selben Serie verfasst.
                  </p>
                  <ul className="space-y-2">
                    {authorSeriesArticles.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/${a.slug}`}
                          className="group flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                          data-testid={`author-series-article-${a.slug}`}
                        >
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-cyan-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="font-medium leading-snug">{a.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Ad Unit - Above Footer */}
          <ClientAdSlot position="above_footer" className="my-8" />
          </div>
          {/* ─────────────────────────── /MAIN COLUMN ─────────────────────────── */}

          {/* ─────────────────────────── DESKTOP SIDEBAR ─────────────────────────── */}
          {/* Nur Desktop. Sticky-Container mit 3 TheMoneytizer-Slots.
              Wenn ein Slot inaktiv ist, rendert ClientAdSlot null und der
              Container kollabiert (gap auf 0). */}
          <aside
            className="hidden lg:block"
            aria-label="Artikel Sidebar Werbung"
            data-ad-sidebar="desktop"
          >
            <div className="sticky top-24 space-y-6">
              <div data-ad-slot-wrapper="desktop_sidebar_top_rect" className="empty:hidden">
                <ClientAdSlot position="desktop_sidebar_top_rect" />
              </div>
              <div data-ad-slot-wrapper="desktop_sidebar_halfpage" className="empty:hidden">
                <ClientAdSlot position="desktop_sidebar_halfpage" />
              </div>
              <div data-ad-slot-wrapper="desktop_sidebar_megasky" className="empty:hidden">
                <ClientAdSlot position="desktop_sidebar_megasky" />
              </div>
            </div>
          </aside>
          {/* ─────────────────────────── /DESKTOP SIDEBAR ─────────────────────── */}
        </div>

        {/* ─────── Desktop-only Bottom-of-Article Ads ─────── */}
        <div className="hidden lg:flex w-full justify-center pb-4 px-4 empty:hidden empty:!pb-0" data-ad-slot-wrapper="desktop_bottom_rect">
          <ClientAdSlot position="desktop_bottom_rect" />
        </div>
        <div className="hidden lg:flex w-full justify-center pb-6 px-4 empty:hidden empty:!pb-0" data-ad-slot-wrapper="desktop_megabanner_bottom">
          <ClientAdSlot position="desktop_megabanner_bottom" />
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

      {/* Mehr aktuelle Serien-News CTA */}
      <div className="container mx-auto px-4 md:px-6 max-w-3xl pb-2">
        <section
          aria-labelledby="more-news"
          className="rounded-2xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50 dark:bg-cyan-950/30 p-5 sm:p-6"
          data-testid="article-news-cta"
        >
          <h3 id="more-news" className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
            Mehr aktuelle Serien-News
          </h3>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
            Bleib auf dem Laufenden — alle frischen Meldungen, Trailer und Staffel-Starts auf einen Blick.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/news"
              className="inline-flex items-center px-4 py-2 rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold transition-colors"
              data-testid="article-news-cta-all"
            >
              Alle Serien-News →
            </Link>
            {(() => {
              const nets = (article.series?.networks || []).map((n: string) => n.toLowerCase());
              const STREAMER_LINKS: Array<{ match: string[]; href: string; label: string }> = [
                { match: ['netflix'],                                 href: '/news/netflix',       label: 'Netflix-News' },
                { match: ['prime video', 'amazon prime', 'amazon'],   href: '/news/prime-video',   label: 'Prime Video-News' },
                { match: ['disney+', 'disney plus', 'disney'],        href: '/news/disney-plus',   label: 'Disney+ News' },
                { match: ['apple tv+', 'apple tv plus', 'apple tv'],  href: '/news/apple-tv',      label: 'Apple TV+ News' },
              ];
              const matched = STREAMER_LINKS.find((s) => nets.some((n) => s.match.some((m) => n.includes(m))));
              return matched ? (
                <Link
                  href={matched.href}
                  className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 text-sm font-semibold transition-colors"
                  data-testid="article-news-cta-streamer"
                >
                  Mehr {matched.label} →
                </Link>
              ) : null;
            })()}
          </div>
        </section>
      </div>

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

      {/* Globale Custom-Tags am Ende der Artikelseite (z.B. Late-Loading-
          Pixel, Tracking-Beacons, Adblock-Detection). Default-Placement im
          Admin — landet bei "Standard"-Tags hier. Verwaltet via
          /admin/global-tags. */}
      <GlobalTags placement="body-end" />

      {/* ─────── Desktop Floating Overlays (Corner Video + Footer Slide-in) ───────
          Nur Desktop (≥ lg). Beide Slots sind opt-in (in der DB initial
          inaktiv). TheMoneytizer-Snippets bringen ihren eigenen Close-
          Button mit — wir wrappen sie nur in fixed-positioned Container.
          Bot-Schutz: Interstitial-Logik oben filtert bereits Crawler
          aus, dadurch kein SEO-Risiko durch overlays. */}
      <div
        className="hidden lg:block fixed bottom-4 right-4 z-40 pointer-events-auto empty:hidden"
        aria-label="Werbung Corner Video"
        data-ad-slot-wrapper="desktop_corner_video"
      >
        <ClientAdSlot position="desktop_corner_video" />
      </div>
      <div
        className="hidden lg:flex fixed bottom-0 left-0 right-0 z-30 justify-center pointer-events-auto empty:hidden"
        aria-label="Werbung Footer Slide-in"
        data-ad-slot-wrapper="desktop_footer_slidein"
      >
        <ClientAdSlot position="desktop_footer_slidein" />
      </div>
    </div>
  );
}
