/**
 * Schema.org Helper Functions
 * Generates structured data markup for SEO
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';

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

  // Add optional fields
  if (options?.author) {
    imageObject.author = {
      '@type': 'Organization',
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
  publisher?: {
    name: string;
    logo?: string;
  };
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: data.title,
    description: data.description,
    image: generateImageObject(
      data.imageUrl,
      data.title,
      data.imageDimensions,
      {
        caption: data.title,
        author: data.publisher?.name,
        representativeOfPage: true,
      }
    ),
    datePublished: data.datePublished,
    dateModified: data.dateModified,
    author: {
      '@type': 'Person',
      name: data.author || 'serien.de Redaktion',
    },
    publisher: {
      '@type': 'Organization',
      name: data.publisher?.name || 'serien.de',
      logo: data.publisher?.logo ? generateImageObject(
        data.publisher.logo,
        `${data.publisher.name} Logo`,
        { width: 600, height: 60 }
      ) : {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/${data.slug}`,
    },
  };

  return schema;
}

/**
 * Detect image type from URL and return appropriate dimensions
 */
export function getImageDimensions(imageUrl: string): { width: number; height: number } {
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
  
  // Default to hero dimensions
  return IMAGE_DIMENSIONS.HERO;
}

/**
 * Generate BreadcrumbList schema for better navigation
 */
export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${baseUrl}${item.url}`,
    })),
  };
}

/**
 * Generate Series schema with poster image
 */
export function generateSeriesSchema(data: {
  name: string;
  description: string;
  posterUrl: string;
  tmdbId: number;
  slug: string; // NEW: Use clean slug for URL
  startYear?: number;
  endYear?: number;
  genres?: string[];
}) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: data.name,
    description: data.description,
    image: generateImageObject(
      data.posterUrl,
      data.name,
      { width: 500, height: 750 }, // TMDB poster dimensions
      { representativeOfPage: true }
    ),
    url: `${baseUrl}/serie/${data.slug}`, // Use clean slug instead of tmdbId
    ...(data.startYear && { startDate: `${data.startYear}-01-01` }),
    ...(data.endYear && { endDate: `${data.endYear}-12-31` }),
    ...(data.genres && data.genres.length > 0 && { genre: data.genres }),
  };
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
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
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
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
 * Generate WebSite schema with SearchAction for Sitelinks Searchbox
 */
export function generateWebSiteSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'serien.de',
    alternateName: 'Serien.de - Streaming News & Reviews',
    url: baseUrl,
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
 * Generate Organization schema for the publisher
 */
export function generateOrganizationSchema() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'serien.de',
    url: baseUrl,
    logo: {
      '@type': 'ImageObject',
      url: `${baseUrl}/logo.png`,
      width: 600,
      height: 60,
    },
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'kontakt@serien.de',
    },
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
    publisher: {
      '@type': 'Organization',
      name: 'serien.de',
    },
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';
  
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
    worksFor: {
      '@type': 'Organization',
      name: 'serien.de',
      url: baseUrl,
    },
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
