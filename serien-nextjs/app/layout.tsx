import './globals.css';
import { headers } from 'next/headers';
import LayoutWrapper from '@/components/LayoutWrapper';
import AnalyticsTracker from '@/components/AnalyticsTracker';
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
  alternates: {
    canonical: '/',
    languages: {
      'de-DE': '/',
    },
  },
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = generateWebSiteSchema();
  const orgSchema = generateOrganizationSchema();

  // Determine current path (set by middleware) so we can skip ad scripts on
  // admin pages. User policy: "Ads dürfen nur auf artikelseiten angezeigt
  // werden". /admin/* never renders AdSense — neither the loader script nor
  // any Auto-Ads injection it would trigger.
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') || '';
  const isAdsAllowed = !pathname.startsWith('/admin');
  
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = stored === 'dark' || (stored === 'system' && prefersDark) || (!stored && prefersDark) ? 'dark' : 'light';
                document.documentElement.classList.add(theme);
              })();
            `,
          }}
        />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.json" />
        {/* hreflang — single-language German site; emitted globally so every
            page (including ones that override `alternates`) carries the signal. */}
        <link rel="alternate" hrefLang="de-DE" href="https://serien.de" />
        <link rel="alternate" hrefLang="x-default" href="https://serien.de" />
        
        {/* AdSense - NEVER REMOVE. Hardcoded publisher ID, must always be in <head>.
            EXCEPT on /admin/* — ads policy: only article pages may show ads. */}
        {isAdsAllowed && (
          <>
            <script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805"
              crossOrigin="anonymous"
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `window.adsbygoogle = window.adsbygoogle || [];`
              }}
            />
          </>
        )}

        {/* Google Analytics 4 (G-K7T0SF14YX) */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-K7T0SF14YX"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-K7T0SF14YX');
            `,
          }}
        />
        
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
        <AnalyticsTracker />
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
      </body>
    </html>
  );
}
