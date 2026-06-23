/**
 * Schema.org Helper Functions
 * Generates structured data markup for SEO
 */

// Canonical production URL — JSON-LD must always reference the public domain,
// even when this code runs on a Vercel preview (`NEXT_PUBLIC_BASE_URL`
// can point to `*.vercel.app` there).
const CANONICAL_SITE_URL = 'https://serien.de';

/** Stable @id for the publisher entity — referenced by NewsArticle.publisher */
export const ORG_ID = `${CANONICAL_SITE_URL}#organization`;
export const SITE_ID = `${CANONICAL_SITE_URL}#website`;

/**
 * Image dimensions for different image types
 */
export const IMAGE_DIMENSIONS = {
  HERO: { width: 1600, height: 900 },      // Hero images (16:9)
  OG: { width: 1200, height: 630 },        // Open Graph images
  CARD: { width: 800, height: 450 },       // Card images
  PROCESSED: { width: 1920, height: 1080 }, // Processed TMDB images
  TMDB_BACKDROP: { width: 1920, height: 1080 }, // TMDB backdrop (original)
} as const;

/**
 * Generate Schema.org ImageObject for better Google Discover performance
 * 
 * @param imageUrl - URL of the image
 * @param title - Image title/alt text
 * @param dimensions - Image dimensions (width, height)
 * @param options - Additional options (caption, author, license)
 */
export function generateImageObject(
  imageUrl: string,
  title: string,
  dimensions: { width: number; height: number },
  options?: {
    caption?: string;
    author?: string;
    license?: string;
    representativeOfPage?: boolean;
  }
) {
  const imageObject: Record<string, any> = {
    '@type': 'ImageObject',
    url: imageUrl,
    width: dimensions.width,
    height: dimensions.height,
    caption: options?.caption || title,
  };

  // Image author: inline a minimal Organization identity. Cross-block `@id`
  // refs (to the layout `@graph` Organization) work in Google's Rich Results
  // Test but trigger "unresolved reference" warnings in stricter validators
  // (Yoast, JSON-LD-Linter). Inlining @type + name keeps the entity self-
  // describing without duplicating the full Organization definition.
  if (options?.author) {
    imageObject.author = {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: options.author,
    };
  }

  if (options?.license) {
    imageObject.license = options.license;
  }

  if (options?.representativeOfPage !== undefined) {
    imageObject.representativeOfPage = options.representativeOfPage;
  }

  return imageObject;
}

/**
 * Generate complete NewsArticle schema with ImageObject
 */
export function generateArticleSchema(data: {
  title: string;
  description: string;
  imageUrl: string;
  imageDimensions: { width: number; height: number };
  datePublished: string;
  dateModified: string;
  slug: string;
  author?: string;
  authorSlug?: string;
  /** Optional: author avatar URL (relative or absolute), surfaced as Person.image. */
  authorImage?: string | null;
  /** Optional: author short bio (used as Person.description). */
  authorBio?: string | null;
  /** Optional: author expertise tags (used as Person.knowsAbout). */
  authorExpertise?: string[] | null;
  /** Optional: author job title (defaults to "Serien-Redakteur:in" when expertise hints at editorial). */
  authorJobTitle?: string | null;
  category?: string;
  /** Optional: TVSeries entity to link via `about` (deep Knowledge-Graph signal). */
  aboutSeriesSlug?: string;
  /** Required when `aboutSeriesSlug` is set — display name for the TVSeries entity. */
  aboutSeriesName?: string;
  /** Optional: HTML word count, surfaced as `wordCount`. */
  wordCount?: number;
  /** Optional: tag array, surfaced as comma-separated `keywords`. */
  keywords?: string[];
  /** Optional: plain-text article body (max ~5000 chars), surfaced as `articleBody`. */
  articleBody?: string;
  /** Optional: external source URL (Variety, Deadline, …) referenced via `isBasedOn`. */
  sourceUrl?: string;
  publisher?: {
    name: string;
    logo?: string;
  };
}) {
  const baseUrl = CANONICAL_SITE_URL;

  // Ensure image URL is absolute
  const absoluteImageUrl = data.imageUrl.startsWith('http')
    ? data.imageUrl
    : `${baseUrl}${data.imageUrl.startsWith('/') ? '' : '/'}${data.imageUrl}`;

  // Map vague defaults to "Serien-News" (better Discover signal than "Allgemein").
  const articleSection =
    !data.category || /^allgemein$/i.test(data.category)
      ? 'Serien-News'
      : data.category;

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: data.title,
    // Aggregator-Fallback: manche Crawler lesen `name` wenn `headline` fehlt.
    name: data.title,
    description: data.description,
    image: generateImageObject(
      absoluteImageUrl,
      data.title,
      data.imageDimensions,
      {
        caption: data.title,
        author: data.publisher?.name || 'serien.de',
        representativeOfPage: true,
      }
    ),
    datePublished: data.datePublished,
    // dateModified: Suppress when it equals (or is within 60 s of) datePublished —
    // emitting an "update" timestamp that's identical to publication is a noise
    // signal for Google ("Was this article actually updated?") and triggers
    // soft Helpful-Content warnings in some validators.
    ...((() => {
      const pub = Date.parse(data.datePublished);
      const mod = Date.parse(data.dateModified);
      if (!Number.isFinite(pub) || !Number.isFinite(mod)) {
        return { dateModified: data.dateModified };
      }
      return mod - pub > 60_000 ? { dateModified: data.dateModified } : {};
    })()),
    inLanguage: 'de-DE',
    // NOTE: `isAccessibleForFree` wurde entfernt — Google Rich-Results-Test
    // gruppiert jeden Artikel mit diesem Property unter „Paywall-Inhalte",
    // selbst wenn der Wert `true` ist. Für freie News ist Schema-Default
    // ohnehin „frei zugänglich" → kein SEO-Nachteil, sauberere Kategorisierung.
    author: (() => {
      const authorName = data.author || 'serien.de Redaktion';
      const authorUrl = data.authorSlug ? `${baseUrl}/autor/${data.authorSlug}` : undefined;
      const person: Record<string, any> = {
        '@type': 'Person',
        ...(authorUrl && { '@id': `${authorUrl}#person` }),
        name: authorName,
        ...(authorUrl && { url: authorUrl }),
      };
      // E-E-A-T signals: image, jobTitle, knowsAbout, description, worksFor
      if (data.authorImage) {
        const absImg = data.authorImage.startsWith('http')
          ? data.authorImage
          : `${baseUrl}${data.authorImage.startsWith('/') ? '' : '/'}${data.authorImage}`;
        person.image = absImg;
      }
      if (data.authorBio) {
        // Trim to 500 chars — Google ignores schema strings beyond that.
        person.description = data.authorBio.length > 500
          ? data.authorBio.slice(0, 497) + '…'
          : data.authorBio;
      }
      if (data.authorExpertise && data.authorExpertise.length > 0) {
        person.knowsAbout = data.authorExpertise;
      }
      // jobTitle: explicit value wins; otherwise infer from expertise.
      if (data.authorJobTitle) {
        person.jobTitle = data.authorJobTitle;
      } else if (data.authorExpertise?.some((e) => /redakti|news|editor/i.test(e))) {
        person.jobTitle = 'Serien-Redakteur:in';
      }
      // Connect Person to the publisher Organization entity. Single source of
      // truth — the full org definition lives in generateOrganizationSchema.
      person.worksFor = { '@id': ORG_ID };
      return person;
    })(),
    // Reference the publisher entity defined in the global Organization schema
    // (see generateOrganizationSchema). Single source of truth, no duplication.
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/${data.slug}`,
    },
    articleSection,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['[data-speakable="headline"]', '[data-speakable="summary"]'],
    },
    ...(data.wordCount && { wordCount: data.wordCount }),
    ...(data.keywords && data.keywords.length > 0 && {
      keywords: data.keywords.join(', '),
    }),
    ...(data.articleBody && {
      articleBody: data.articleBody.slice(0, 5000),
    }),
    // `isBasedOn` bewusst NICHT mehr emittiert — Google Rich-Results-Test
    // hat das Feld als sekundäres `NewsArticle`-Entity geparst und „unbenanntes
    // Element" + 3 Pflichtfeld-Warnungen (image/author/headline) erzeugt. Quell-
    // Attribution erfolgt stattdessen sichtbar im Artikel-Body via Source-Link.
    ...(data.aboutSeriesSlug && {
      // TVSeries entity inlined — must not be a dangling `@id` reference,
      // because the full TVSeries schema only lives on /serie/[slug] and is
      // not present on the article page's JSON-LD blocks. Inlining minimal
      // identity (@type + name + url) gives Google a resolvable entity here.
      about: {
        '@type': 'TVSeries',
        '@id': `${baseUrl}/serie/${data.aboutSeriesSlug}#tvseries`,
        name: data.aboutSeriesName || data.aboutSeriesSlug,
        url: `${baseUrl}/serie/${data.aboutSeriesSlug}`,
      },
    }),
  };

  return schema;
}

/**
 * Detect image type from URL and return appropriate dimensions.
 *
 * Pattern-Erkennung in Reihenfolge der Spezifität:
 *   1. TMDB sized-URLs (`/t/p/w1280/…`, `/t/p/original/…`) → echte Maße
 *   2. Nano-Banana Vercel Blob (`/nano-banana/…`) → 1536×1024 (gpt-image-1 Output)
 *   3. Internal route handlers (`/img/og/`, `/img/hero/`, `/img/processed/`)
 *   4. Default: 1920×1080 (Discover-safe, ≥1200 px Breite)
 */
export function getImageDimensions(imageUrl: string): { width: number; height: number } {
  // 1. TMDB direct image URLs (image.tmdb.org/t/p/<size>/…)
  // Common sizes for backdrops: w300, w780, w1280, original (max 3840×2160)
  const tmdbMatch = imageUrl.match(/image\.tmdb\.org\/t\/p\/(w\d+|original)\b/i);
  if (tmdbMatch) {
    const size = tmdbMatch[1].toLowerCase();
    if (size === 'original') return { width: 1920, height: 1080 }; // Most TMDB backdrops are 1920×1080
    const w = parseInt(size.slice(1), 10);
    if (Number.isFinite(w) && w >= 300) {
      // TMDB backdrops have 16:9 aspect (1.78). Round height to nearest int.
      return { width: w, height: Math.round(w / (16 / 9)) };
    }
  }

  // 2. Nano-Banana / GPT-Image-1 output (Vercel Blob, deterministic 1536×1024 from gpt-image-1)
  if (/\/nano-banana\//i.test(imageUrl)) {
    return { width: 1536, height: 1024 };
  }

  // 3. Internal route handlers
  if (imageUrl.includes('/img/processed/')) {
    return IMAGE_DIMENSIONS.PROCESSED;
  }
  if (imageUrl.includes('/img/og/')) {
    return IMAGE_DIMENSIONS.OG;
  }
  if (imageUrl.includes('/img/hero/')) {
    return IMAGE_DIMENSIONS.HERO;
  }
  if (imageUrl.includes('/img/card/')) {
    return IMAGE_DIMENSIONS.CARD;
  }

  // 4. Default: Discover-safe 1920×1080 (≥1200 px Breite, 16:9 Aspect)
  return IMAGE_DIMENSIONS.PROCESSED;
}

/**
 * Generate BreadcrumbList schema for better navigation
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const baseUrl = CANONICAL_SITE_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      // Normalise paths: keep root as `/`, strip trailing slash everywhere else.
      let path = item.url;
      if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
      const fullUrl = path === '/' ? baseUrl : `${baseUrl}${path}`;
      return {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: fullUrl,
      };
    }),
  };
}

/**
 * Generate TVSeries schema with poster image, ratings, cast, trailer, etc.
 *
 * Includes the full set of Rich-Result-eligible signals:
 *   – stable @id (so NewsArticle.about can reference it)
 *   – publisher reference (#organization)
 *   – aggregateRating (Sternchen in SERPs)
 *   – numberOfSeasons / numberOfEpisodes
 *   – trailer (VideoObject) when localTrailerPath is available
 *   – inLanguage, sameAs (TMDB / Wikidata)
 *   – endDate ONLY when the show is actually ended
 */
export function generateSeriesSchema(data: {
  name: string;
  description: string;
  posterUrl: string;
  tmdbId: number;
  slug: string;
  /** Real ISO date (YYYY-MM-DD) — preferred over `startYear` */
  firstAirDate?: Date | string | null;
  /** Real ISO date (YYYY-MM-DD) of the last aired episode */
  lastAirDate?: Date | string | null;
  /** Free-form TMDB status string ("Returning Series", "Ended", "Canceled", …). */
  status?: string | null;
  startYear?: number;
  endYear?: number;
  genres?: string[];
  numberOfSeasons?: number | null;
  numberOfEpisodes?: number | null;
  /** TMDB voteAverage on the 0–10 scale */
  voteAverage?: number | null;
  voteCount?: number | null;
  /** Optional list of broadcast networks / streaming providers. */
  networks?: string[];
  /** Optional list of cast: `{ name, characterName? }` */
  cast?: Array<{ name: string; characterName?: string }>;
  /** Optional list of creators (showrunner / created_by). */
  creators?: string[];
  /** Optional production companies. */
  productionCompanies?: string[];
  /** Local trailer URL (Cloudflare R2 mp4). */
  trailerUrl?: string | null;
  /** Optional explicit poster URL (absolute) — overrides `posterUrl` for image. */
  absolutePosterUrl?: string;
}) {
  const baseUrl = CANONICAL_SITE_URL;
  const slug = data.slug;
  const seriesId = `${baseUrl}/serie/${slug}#tvseries`;

  // Image: must be absolute for Schema.org rich results.
  const posterAbsolute = data.absolutePosterUrl
    || (data.posterUrl.startsWith('http')
      ? data.posterUrl
      : `${baseUrl}${data.posterUrl.startsWith('/') ? '' : '/'}${data.posterUrl}`);

  // Real ISO dates win over Year-only fallbacks.
  const startDate = data.firstAirDate
    ? (typeof data.firstAirDate === 'string'
        ? data.firstAirDate.slice(0, 10)
        : data.firstAirDate.toISOString().slice(0, 10))
    : (data.startYear ? `${data.startYear}-01-01` : undefined);

  const isEnded = (data.status || '').toLowerCase() === 'ended'
    || (data.status || '').toLowerCase() === 'canceled';
  const endDate = isEnded
    ? (data.lastAirDate
        ? (typeof data.lastAirDate === 'string'
            ? data.lastAirDate.slice(0, 10)
            : data.lastAirDate.toISOString().slice(0, 10))
        : (data.endYear ? `${data.endYear}-12-31` : undefined))
    : undefined;

  const cleanedGenres = (data.genres ?? []).filter((g): g is string => typeof g === 'string' && g.length > 0);

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    '@id': seriesId,
    name: data.name,
    description: data.description,
    image: generateImageObject(
      posterAbsolute,
      data.name,
      { width: 500, height: 750 },
      { caption: data.name, representativeOfPage: true },
    ),
    url: `${baseUrl}/serie/${slug}`,
    inLanguage: 'de-DE',
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
    ...(cleanedGenres.length > 0 && { genre: cleanedGenres }),
    ...(data.numberOfSeasons && data.numberOfSeasons > 0 && { numberOfSeasons: data.numberOfSeasons }),
    ...(data.numberOfEpisodes && data.numberOfEpisodes > 0 && { numberOfEpisodes: data.numberOfEpisodes }),
  };

  // AggregateRating from TMDB voteAverage → Stars in SERPs
  if (typeof data.voteAverage === 'number' && data.voteAverage > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(data.voteAverage * 10) / 10,
      bestRating: 10,
      worstRating: 0,
      ...(data.voteCount && data.voteCount > 0 && { ratingCount: data.voteCount }),
    };
  }

  // Cast as Person array
  if (Array.isArray(data.cast) && data.cast.length > 0) {
    schema.actor = data.cast.slice(0, 12).map((c) => ({
      '@type': 'Person',
      name: c.name,
      ...(c.characterName && {
        characterName: c.characterName,
      }),
    }));
  }

  if (Array.isArray(data.creators) && data.creators.length > 0) {
    schema.creator = data.creators.map((n) => ({ '@type': 'Person', name: n }));
  }

  if (Array.isArray(data.productionCompanies) && data.productionCompanies.length > 0) {
    schema.productionCompany = data.productionCompanies.map((n) => ({
      '@type': 'Organization',
      name: n,
    }));
  }

  // Trailer (R2-hosted MP4 — never YouTube iframe)
  if (data.trailerUrl && data.trailerUrl.startsWith('http')) {
    schema.trailer = {
      '@type': 'VideoObject',
      name: `${data.name} – Trailer`,
      description: `Trailer zur Serie ${data.name}`,
      thumbnailUrl: posterAbsolute,
      uploadDate: startDate || `${new Date().getFullYear()}-01-01`,
      contentUrl: data.trailerUrl,
      embedUrl: data.trailerUrl,
      inLanguage: 'de-DE',
      publisher: { '@id': ORG_ID },
    };
  }

  // sameAs — link to TMDB authority record (Wikidata can be added later when
  // we sync that mapping).
  schema.sameAs = [
    `https://www.themoviedb.org/tv/${data.tmdbId}`,
  ];

  return schema;
}

/**
 * Generate Person schema with profile image (for character pages)
 */
export function generatePersonSchema(data: {
  name: string;
  description: string;
  imageUrl: string;
  characterName?: string;
  seriesName?: string;
  url: string;
}) {
  const baseUrl = CANONICAL_SITE_URL;
  
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: data.name,
    description: data.description,
    image: generateImageObject(
      data.imageUrl,
      data.name,
      { width: 500, height: 750 }, // TMDB profile dimensions
      { representativeOfPage: true }
    ),
    url: `${baseUrl}${data.url}`,
  };

  // If this is a character page, add character information
  if (data.characterName && data.seriesName) {
    schema['@type'] = 'PerformanceRole';
    schema.characterName = data.characterName;
    schema.inProduction = {
      '@type': 'TVSeries',
      name: data.seriesName,
    };
  }

  return schema;
}


/**
 * Generate FAQPage schema for Q&A sections
 * Helps with rich snippets in Google search results
 */
export function generateFAQSchema(questions: Array<{ question: string; answer: string }>) {
  if (!questions || questions.length === 0) return null;
  
  const baseUrl = CANONICAL_SITE_URL;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
}

/**
 * Generate VideoObject schema for trailers
 * Helps videos appear in Google video search
 */
export function generateVideoSchema(data: {
  name: string;
  description: string;
  thumbnailUrl: string;
  uploadDate: string;
  duration?: string; // ISO 8601 format, e.g., "PT2M30S"
  embedUrl?: string;
  contentUrl?: string;
}) {
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: data.name,
    description: data.description,
    thumbnailUrl: data.thumbnailUrl,
    uploadDate: data.uploadDate,
  };
  
  if (data.duration) schema.duration = data.duration;
  if (data.embedUrl) schema.embedUrl = data.embedUrl;
  if (data.contentUrl) schema.contentUrl = data.contentUrl;
  
  return schema;
}

/**
 * Generate WebSite schema with SearchAction for Sitelinks Searchbox.
 *
 * Uses the canonical URL so the WebSite + Organization graph is consistent
 * regardless of preview origin. Linked to the publisher entity via `publisher`.
 */
export function generateWebSiteSchema() {
  const baseUrl = CANONICAL_SITE_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: 'serien.de',
    url: baseUrl,
    inLanguage: 'de-DE',
    publisher: { '@id': ORG_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/serienfinder?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Generate Organization (NewsMediaOrganization) schema for the publisher.
 *
 * Uses CANONICAL_SITE_URL — never the preview origin — so all schema URLs are
 * consistent with the canonical tags Google sees in search.
 *
 * Includes the full set of E-E-A-T / Google News Publisher signals:
 *   – stable @id (referenced by NewsArticle.publisher via {@id: …})
 *   – sameAs profiles
 *   – address, foundingDate, knowsAbout
 *   – ethics/corrections/diversity/actionableFeedback/masthead policies
 */
export function generateOrganizationSchema() {
  const baseUrl = CANONICAL_SITE_URL;

  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': ORG_ID,
    name: 'serien.de',
    url: baseUrl,
    description:
      'serien.de ist ein deutschsprachiges Online-Magazin für Serien-News, Trailer, Reviews und Streaming-Updates.',
    inLanguage: 'de-DE',
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
      width: 1200,
      height: 200,
    },
    image: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo-square.png`,
      width: 1024,
      height: 1024,
    },
    sameAs: [
      'https://x.com/serien_de',
      'https://twitter.com/serien_de',
      'https://www.facebook.com/serien.de',
      'https://www.instagram.com/serien_de',
      'https://www.tiktok.com/@serien_de',
      'https://www.youtube.com/@serien189',
      'https://discord.gg/4f6pdexwpY',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'DE',
    },
    foundingDate: '2024',
    knowsAbout: ['TV-Serien', 'Streaming', 'Film', 'Trailer', 'Reviews'],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'kontakt@serien.de',
      availableLanguage: ['de', 'en'],
    },
    publishingPrinciples: `${baseUrl}/redaktionelle-richtlinien`,
    ethicsPolicy: `${baseUrl}/redaktionelle-richtlinien`,
    correctionsPolicy: `${baseUrl}/redaktionelle-richtlinien`,
    diversityPolicy: `${baseUrl}/redaktionelle-richtlinien`,
    actionableFeedbackPolicy: `${baseUrl}/redaktionelle-richtlinien`,
    masthead: `${baseUrl}/autoren`,
  };
}

/**
 * Generate Review/Rating schema
 */
export function generateReviewSchema(data: {
  itemName: string;
  itemType: 'TVSeries' | 'Movie' | 'Episode';
  reviewBody: string;
  ratingValue: number;
  bestRating?: number;
  worstRating?: number;
  authorName: string;
  datePublished: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': data.itemType,
      name: data.itemName,
    },
    reviewBody: data.reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue: data.ratingValue,
      bestRating: data.bestRating || 10,
      worstRating: data.worstRating || 1,
    },
    author: {
      '@type': 'Person',
      name: data.authorName,
    },
    publisher: { '@id': ORG_ID },
    datePublished: data.datePublished,
  };
}

/**
 * Generate HowTo schema for guide articles
 */
export function generateHowToSchema(data: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration
  steps: Array<{ name: string; text: string; imageUrl?: string }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: data.name,
    description: data.description,
    ...(data.totalTime && { totalTime: data.totalTime }),
    step: data.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.imageUrl && {
        image: {
          '@type': 'ImageObject',
          url: step.imageUrl,
        },
      }),
    })),
  };
}

/**
 * Generate ItemList schema for list articles (e.g., "Top 10 Serien")
 */
export function generateItemListSchema(data: {
  name: string;
  description: string;
  items: Array<{ name: string; url?: string; position: number }>;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: data.name,
    description: data.description,
    numberOfItems: data.items.length,
    itemListElement: data.items.map(item => ({
      '@type': 'ListItem',
      position: item.position,
      name: item.name,
      ...(item.url && { url: item.url }),
    })),
  };
}

/**
 * Generate Author/Person schema for author pages
 */
export function generateAuthorSchema(data: {
  name: string;
  description: string;
  imageUrl?: string;
  jobTitle?: string;
  expertise?: string[];
  url: string;
}) {
  const baseUrl = CANONICAL_SITE_URL;
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: data.name,
    description: data.description,
    url: `${baseUrl}${data.url}`,
    ...(data.imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: data.imageUrl,
      },
    }),
    ...(data.jobTitle && { jobTitle: data.jobTitle }),
    ...(data.expertise && data.expertise.length > 0 && { 
      knowsAbout: data.expertise 
    }),
    worksFor: { '@id': ORG_ID },
  };
}

/**
 * Generate combined schema graph for a page
 * Combines multiple schemas into a single @graph
 */
export function generateSchemaGraph(schemas: Array<Record<string, any> | null>) {
  const validSchemas = schemas.filter(s => s !== null);
  
  if (validSchemas.length === 0) return null;
  if (validSchemas.length === 1) return validSchemas[0];
  
  return {
    '@context': 'https://schema.org',
    '@graph': validSchemas.map(s => {
      // Remove @context from individual schemas when combining
      const { '@context': _, ...rest } = s;
      return rest;
    }),
  };
}
