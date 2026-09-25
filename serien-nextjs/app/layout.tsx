import './globals.css';
import Script from 'next/script';
import LayoutWrapper from '@/components/LayoutWrapper';
import DesktopAdProviders from '@/components/DesktopAdProviders';
import { generateWebSiteSchema, generateOrganizationSchema } from '@/lib/schema-generator';
import { Inter } from 'next/font/google';

// Optimized font loading
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

// Public canonical URL — must always be the production domain in OG/Twitter/Schema,
// even when the build runs on a Vercel preview (`NEXT_PUBLIC_BASE_URL` may then
// point to `*.vercel.app`). The OG URL Next.js composes from `metadataBase` is
// what social platforms display, so pinning this to `https://serien.de`
// prevents preview-domain leakage on every page.
const CANONICAL_BASE_URL = 'https://serien.de';
const baseUrl = CANONICAL_BASE_URL;

export const metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien.',
  metadataBase: new URL(CANONICAL_BASE_URL),
  icons: {
    icon: [
      { url: '/favicon-v2.ico?v=2', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    siteName: 'serien.de',
    url: CANONICAL_BASE_URL,
    images: [
      {
        url: '/og-image.png?v=3',
        width: 1200,
        height: 630,
        alt: 'serien.de - Serien-News, Reviews & Streaming',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@serien_de',
    creator: '@serien_de',
    images: ['/twitter-card.png?v=3'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = generateWebSiteSchema();
  const orgSchema = generateOrganizationSchema();
  // AdSense wurde vollständig aus der Seite entfernt (Feb 2026) — kein
  // Loader, keine Slot-Komponenten, keine adsbygoogle-Rückstände.

  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />
        {/* Prevent flash of wrong theme — dark is the site default; light is
            opt-in via the theme switcher (stored as 'light' in localStorage). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  const root = document.documentElement;
                  if (stored === 'light') {
                    root.classList.remove('dark');
                    root.classList.add('light');
                  } else {
                    // 'dark' (explicit) or 'system' or unset → dark by default
                    root.classList.remove('light');
                    root.classList.add('dark');
                  }
                } catch (e) { /* localStorage unavailable */ }
              })();
            `,
          }}
        />
        <meta name="theme-color" content="#0f0f17" />
        <link rel="manifest" href="/manifest.json" />
        {/* Google Analytics 4 (G-5500N1BENS) — afterInteractive to avoid TBT */}
        <Script
          id="ga4-loader"
          src="https://www.googletagmanager.com/gtag/js?id=G-5500N1BENS"
          strategy="afterInteractive"
        />
        <Script
          id="ga4-init"
          strategy="afterInteractive"
        >
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-5500N1BENS');
          `}
        </Script>

        {/* Mouseflow bleibt deaktiviert. Werbeprovider werden separat erst
            nach bestätigter Desktop-Prüfung aktiviert. */}

        {/* Global Schema.org markup */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { ...websiteSchema, '@context': undefined },
                { ...orgSchema, '@context': undefined },
              ],
            }),
          }}
        />

      </head>
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen text-gray-900 dark:text-gray-100 transition-colors`}>
        <DesktopAdProviders />
        <LayoutWrapper>{children}</LayoutWrapper>
        {/* Server-rendered footer nav for Google crawler (visible in first HTML pass) */}
        <nav aria-label="Rechtliche Informationen" className="sr-only">
          <a href="/about">Über uns</a>
          <a href="/impressum">Impressum</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="/nutzungsbedingungen">Nutzungsbedingungen</a>
          <a href="/redaktionelle-richtlinien">Redaktionelle Richtlinien</a>
          <a href="/autoren">Autoren</a>
        </nav>
        {/* Matomo Analytics (self-hosted via speedcache.io, Site-ID 37).
            lazyOnload → lädt erst nach vollständigem Page-Load, blockiert
            weder LCP noch die Ad-Auction. */}
        <Script id="matomo-analytics" strategy="lazyOnload">
          {`
            var _paq = window._paq = window._paq || [];
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function() {
              var u="https://analytics1.speedcache.io/";
              _paq.push(['setTrackerUrl', u+'matomo.php']);
              _paq.push(['setSiteId', '37']);
              var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
              g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
            })();
          `}
        </Script>
      </body>
    </html>
  );
}
