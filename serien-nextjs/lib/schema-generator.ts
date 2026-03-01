/**
 * Schema.org Helper Functions
 * Generates structured data markup for SEO
 */

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
      '@type': 'Organization',
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
    url: `${baseUrl}/serie/${data.tmdbId}`,
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
