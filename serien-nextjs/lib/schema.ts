export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'serien.de',
    url: 'https://serien.de',
    logo: 'https://serien.de/logo.png',
    description: 'Deine Quelle für TV-Serien News, Trailer und Updates',
    sameAs: [
      'https://twitter.com/serien_de',
      'https://facebook.com/serien.de',
    ],
  };
}

export function generateWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'serien.de',
    url: 'https://serien.de',
    description: 'Aktuelle News, Trailer und Updates zu deinen Lieblingsserien',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://serien.de/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateArticleSchema(article: {
  title: string;
  excerpt: string;
  publishedAt: Date;
  updatedAt: Date;
  slug: string;
  heroLocalUrl?: string;
  author: {
    name: string;
  };
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    image: article.heroLocalUrl || 'https://serien.de/og-image.png',
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      '@type': 'Person',
      name: article.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'serien.de',
      logo: {
        '@type': 'ImageObject',
        url: 'https://serien.de/logo.png',
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://serien.de/artikel/${article.slug}`,
    },
  };
}

export function generateTVSeriesSchema(series: {
  title: string;
  overview?: string;
  posterLocalUrl?: string;
  firstAirDate?: Date;
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  voteAverage?: number;
  genres?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: series.title,
    description: series.overview,
    image: series.posterLocalUrl,
    datePublished: series.firstAirDate?.toISOString(),
    numberOfSeasons: series.numberOfSeasons,
    numberOfEpisodes: series.numberOfEpisodes,
    aggregateRating: series.voteAverage
      ? {
          '@type': 'AggregateRating',
          ratingValue: series.voteAverage,
          bestRating: 10,
        }
      : undefined,
    genre: series.genres,
  };
}

export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
