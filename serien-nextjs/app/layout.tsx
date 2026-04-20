import './globals.css';
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

// Use environment variable for base URL (set in Vercel)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://serien.de';

export const metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien.',
  metadataBase: new URL(baseUrl),
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
    images: ['/twitter-card.png?v=3'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const websiteSchema = generateWebSiteSchema();
  const orgSchema = generateOrganizationSchema();
  
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
        
        {/* AdSense Script - Load synchronously, no defer */}
        {(() => {
          const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || 'ca-pub-8583619451045805';
          return (
            <>
              <script
                src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
                crossOrigin="anonymous"
              />
              <script
                dangerouslySetInnerHTML={{
                  __html: `window.adsbygoogle = window.adsbygoogle || [];`
                }}
              />
            </>
          );
        })()}
        
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
      <body className={`${inter.variable} font-sans flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`}>
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
