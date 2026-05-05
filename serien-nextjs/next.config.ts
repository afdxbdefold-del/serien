import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Compression
  compress: true,
  
  // Force consistent trailing slash (no trailing slash)
  trailingSlash: false,
  
  // Optimized images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
      { protocol: 'https', hostname: '**.vercel-storage.com' },
      { protocol: 'https', hostname: 'image.tmdb.org' },
      { protocol: 'https', hostname: 'integrations.emergentagent.com' },
    ]
  },

  // Rewrites for ads.txt
  async rewrites() {
    return [
      {
        source: '/ads.txt',
        destination: '/api/ads',
      },
    ];
  },
  
  // Redirects for canonical URLs (SEO)
  async redirects() {
    return [
      // Remove trailing slashes (308 permanent redirect)
      {
        source: '/:path+/',
        destination: '/:path+',
        permanent: true,
      },
      // Redirect www to non-www (if using custom domain)
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.serien.de',
          },
        ],
        destination: 'https://serien.de/:path*',
        permanent: true,
      },
      // /neue-videos was deprecated Feb 2026 — 301 to homepage so Google can drop the indexed URL.
      {
        source: '/neue-videos',
        destination: '/',
        permanent: true,
      },
      // Unchosen Staffel 1 Ende erklärt — slug rename (29.04.2026). Keep old URL
      // alive for indexed links + social shares.
      {
        source: '/warum-unchosen-echte-aussteiger-so-tief-erschuettert',
        destination: '/das-ende-von-unchosen-staffel-1-erklaert',
        permanent: true,
      },
      // SNL / Talkshow-Klatsch-Cleanup (03.05.2026). Phase B+ Topic-Out-of-
      // Scope-Filter macht solche Artikel zukünftig unmöglich — die vier
      // Bestands-Artikel werden 301 auf Serien-Hub bzw. /news umgeleitet,
      // damit indexierte Discover-Links nicht ins Leere laufen.
      {
        source: '/snl-buehne-denim-outfit-olivia-rodrigo-heated-rivalry-star-storrie-trifft-ins-schwarze',
        destination: '/serie/heated-rivalry',
        permanent: true,
      },
      {
        source: '/aimee-lou-wood-ueberrascht-snl-u-k-warum-the-white-lotus-jetzt-folgt',
        destination: '/serie/the-white-lotus',
        permanent: true,
      },
      {
        source: '/padilla-fuerchtete-ihren-rauswurf-bei-saturday-night-live',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/ki-debatte-was-ferrell-bei-saturday-night-live-voraussagte',
        destination: '/news',
        permanent: true,
      },
      // Celebrity Wheel of Fortune Cleanup (Feb 2026). TMDB liefert leere Genres
      // für US-Game-Shows → Genre-Filter greift nicht. Fix: DB-Blocklist
      // (`blocklist_entries`) blockt zukünftige Crawls. Diese 7 Bestands-Artikel
      // werden 301 auf /news umgeleitet, damit Discover-Indexed-Links nicht
      // ins Leere laufen.
      {
        source: '/rummel-verspielt-sein-motorrad-warum-celebrity-wheel-of-fortune-schockiert',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/chad-verliert-reisen-bei-celebrity-wheel-of-fortune-warum',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/darum-gewinnt-dieser-pensionaer-celebrity-wheel-of-fortune',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/89-000-dollar-wheel-of-fortune-erlebt-einen-seltenen-moment',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/warum-celebrity-wheel-of-fortune-mit-diane-epps-gerade-so-viele-bewegt',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/wegen-kristen-fisher-reden-wieder-viele-ueber-celebrity-wheel-of-fortune',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/warum-seacrest-bei-celebrity-wheel-of-fortune-lachtraenen-ausloest',
        destination: '/news',
        permanent: true,
      },
      // Show-Age-Cutoff Cleanup (Feb 2026): Boulevard-Gossip über >10y abgesetzte
      // US-Sitcoms (Happy Days etc.). Strukturelle Pipeline-Sperre via
      // `lib/show-age-cutoff.ts` greift ab nächstem Cron — diese Bestands-URL
      // wird 301 auf /news umgeleitet.
      {
        source: '/warum-happy-days-nach-42-jahren-noch-echte-freundschaften-traegt',
        destination: '/news',
        permanent: true,
      },
      // US-Daytime/Late-Night/SNL-Brand-Cleanup (Feb 2026): NBC/ABC-Daytime-
      // Talkshows wie Today, GMA, The View laufen nie auf DACH-Streamern.
      // Strukturelle Sperre via `lib/us-daytime-talk-brands.ts` greift ab
      // nächstem Cron-Run — diese 2 Bestands-URLs werden 301 auf /news.
      {
        source: '/warum-today-with-jenna-sheinelle-gerade-so-viele-zuschauer-anspricht',
        destination: '/news',
        permanent: true,
      },
      {
        source: '/play-for-today-enthuellt-warum-jenna-bush-hager-schweigt',
        destination: '/news',
        permanent: true,
      },
    ];
  },
  
  // Performance headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          }
        ]
      },
      {
        source: '/img/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ];
  },

  serverExternalPackages: ['@prisma/client', 'prisma'],
};

export default nextConfig;
