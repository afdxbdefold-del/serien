import { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://serien.de'),
  title: {
    default: 'serien.de - Deine Quelle für TV-Serien News',
    template: '%s | serien.de',
  },
  description: 'Aktuelle News, Trailer und Updates zu deinen Lieblingsserien. Folge Serien und verpasse keine wichtigen Updates mehr.',
  keywords: ['Serien', 'TV-Serien', 'Streaming', 'Netflix', 'Amazon Prime', 'Disney+', 'HBO Max', 'Serien News', 'Trailer'],
  authors: [{ name: 'serien.de Redaktion' }],
  creator: 'serien.de',
  publisher: 'serien.de',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: 'https://serien.de',
    siteName: 'serien.de',
    title: 'serien.de - Deine Quelle für TV-Serien News',
    description: 'Aktuelle News, Trailer und Updates zu deinen Lieblingsserien.',
    images: [
      {
        url: 'https://serien.de/og-image.png',
        width: 1200,
        height: 630,
        alt: 'serien.de',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'serien.de - Deine Quelle für TV-Serien News',
    description: 'Aktuelle News, Trailer und Updates zu deinen Lieblingsserien.',
    creator: '@serien_de',
    images: ['https://serien.de/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
    // bing: 'your-bing-verification-code',
  },
};

export default function RootLayoutMetadata() {
  return null;
}