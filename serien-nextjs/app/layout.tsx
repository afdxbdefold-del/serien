import './globals.css';
import LayoutWrapper from '@/components/LayoutWrapper';
import { generateWebSiteSchema, generateOrganizationSchema } from '@/lib/schema-generator';

export const metadata = {
  title: 'Serien-News, Trailer & Updates | serien.de',
  description: 'Serien.de – News, Trailer & Updates zu deinen Lieblingsserien.',
  metadataBase: new URL('https://serien-de.vercel.app'),
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
      <body className="flex flex-col min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
