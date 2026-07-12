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
          // Feb 2026: Person- + Figur-Seiten aus dem Crawling ausgeschlossen.
          // Liefern keinen organischen Traffic, kosten aber Crawl-Budget.
          // Ergänzung zu den bereits gesetzten noindex,nofollow Meta-Tags —
          // Disallow verhindert das Crawling KOMPLETT (auch die Meta-Tags
          // müsste Google erst laden um sie zu sehen; mit Disallow spart sich
          // Google diesen Round-Trip).
          '/person/',
          '/personen',
          '/figur/',
          '/figuren',
        ],
      },
    ],
    sitemap: [
      'https://serien.de/sitemap.xml',
      'https://serien.de/news-sitemap.xml',
      'https://serien.de/sitemap-series.xml',
      'https://serien.de/sitemap-static.xml',
    ],
  };
}
