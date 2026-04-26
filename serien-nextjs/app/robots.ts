import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/admin/',
          '/onboarding/',
          '/einstellungen/',
        ],
      },
    ],
    sitemap: [
      'https://serien.de/sitemap.xml',
      'https://serien.de/news-sitemap.xml',
      'https://serien.de/sitemap-news.xml',
      'https://serien.de/sitemap-series.xml',
      'https://serien.de/sitemap-characters.xml',
      'https://serien.de/sitemap-persons.xml',
      'https://serien.de/sitemap-static.xml',
    ],
  };
}