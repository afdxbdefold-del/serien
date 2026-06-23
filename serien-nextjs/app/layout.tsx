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
        {/* Pre-connect to all critical third-party origins so the TLS+DNS
            handshake happens in parallel with the rest of the HTML parse.
            Saves ~300 ms per origin on cold-start mobile (4G). Order: CMP
            first (most critical), GA last. */}
        <link rel="preconnect" href="https://fundingchoicesmessages.google.com" crossOrigin="" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />

        {/* Google Funding Choices CMP (TCF 2.2 + Google Consent Mode v2) —
            ersetzt GateKeeperConsent/Ezoic. Pflicht für DACH-AdSense-Publisher.
            Lädt die in der Funding-Choices-Konsole konfigurierten Banner
            (kostenlos für AdSense-Kunden, kein Drittanbieter-Branding).
            Doku: https://support.google.com/fundingchoices/answer/9180935 */}
        <script
          async
          src="https://fundingchoicesmessages.google.com/i/pub-8583619451045805?ers=1"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function signalGooglefcPresent(){if(!window.frames['googlefcPresent']){if(document.body){const i=document.createElement('iframe');i.style='width:0;height:0;border:none;z-index:-1000;left:-1000px;top:-1000px;';i.style.display='none';i.name='googlefcPresent';document.body.appendChild(i);}else{setTimeout(signalGooglefcPresent,0);}}}signalGooglefcPresent();})();`,
          }}
        />

        {/* Google AdSense Loader — site-wide im <head> per offizieller Google-
            Empfehlung (https://support.google.com/adsense/answer/9274516).
            Async + crossorigin blockt nichts, und auf Seiten ohne `<ins
            class="adsbygoogle">`-Slots wird KEIN Ad gerendert. Dadurch ist
            site-wide sicher und sauberer als ein per-Page-Loader, der bei
            jedem Pageview neu nachgeladen wird. Funding-Choices CMP läuft
            davor und steuert das Consent-Signal via Consent-Mode v2. */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8583619451045805"
          crossOrigin="anonymous"
        />

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
