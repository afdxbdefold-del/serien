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
    sitemap: 'https://serien.de/sitemap.xml',
  };
}