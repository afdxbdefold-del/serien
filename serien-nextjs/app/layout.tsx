import './globals.css';
import Script from 'next/script';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = generateWebSiteSchema();
  const orgSchema = generateOrganizationSchema();
  // AdSense script is intentionally NOT loaded here in the root layout —
  // it's now scoped to article pages only (see app/[slug]/page.tsx). This
  // keeps the root layout static-renderable and avoids `Cache-Control:
  // no-store` propagating to every route via headers().
  
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        {/* GateKeeperConsent CMP — MUST load before any ad / analytics script
            so consent state is established first. `data-cfasync="false"` tells
            Cloudflare Rocket Loader to leave the tag untouched (CMP must be
            blocking + render-critical). Plain <script> tags so Next.js does
            not move them with its Script component strategies. */}
        <script
          data-cfasync="false"
          src="https://cmp.gatekeeperconsent.com/min.js"
        />
        <script
          data-cfasync="false"
          src="https://the.gatekeeperconsent.com/cmp.min.js"
        />

        {/* Ezoic Standalone Ads — must load AFTER the GateKeeper CMP (so it
            can read consent state) and BEFORE the rest of the page renders.
            `ezstandalone.cmd` queue is initialised inline so any later
            `ezstandalone.showAds(...)` calls from ad components are safe
            even if sa.min.js is still loading. */}
        <script async src="https://www.ezojs.com/ezoic/sa.min.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ezstandalone = window.ezstandalone || {}; ezstandalone.cmd = ezstandalone.cmd || [];`,
          }}
        />
        <script src="https://ezoicanalytics.com/analytics.js" />

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
        {/* Ezoic site verification — required for Ezoic dashboard to confirm
            ownership of serien.de. Must remain in <head> permanently. */}
        <meta name="ezoic-site-verification" content="yzQjDFf6oMSKH59CPmqpphmHzzbu9s" />
        <link rel="manifest" href="/manifest.json" />
        {/* hreflang — single-language German site; emitted globally so every
            page (including ones that override `alternates`) carries the signal. */}
        <link rel="alternate" hrefLang="de-DE" href="https://serien.de" />
        <link rel="alternate" hrefLang="x-default" href="https://serien.de" />
        
        {/* AdSense loader is scoped to /[slug] (article pages) — not loaded
            in root layout per ads policy "only on article pages". */}

        {/* Google Analytics 4 (G-K7T0SF14YX) — afterInteractive to avoid TBT */}
        <Script
          id="ga4-loader"
          src="https://www.googletagmanager.com/gtag/js?id=G-K7T0SF14YX"
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
            gtag('config', 'G-K7T0SF14YX');
          `}
        </Script>
        
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
