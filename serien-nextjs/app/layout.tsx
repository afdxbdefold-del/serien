import './globals.css';
import Script from 'next/script';
import LayoutWrapper from '@/components/LayoutWrapper';
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
        {/* Pre-connect: nur noch InMobi Choice (Desktop-CMP) + GA-Tag-Manager.
            Funding-Choices-Preconnect wurde Feb 2026 entfernt — Mobile bekommt
            gar keinen CMP mehr (keine Ads auf Mobile → kein Consent nötig). */}
        <link rel="preconnect" href="https://cmp.inmobi.com" crossOrigin="" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="" />

          {/* CMP-Loader: NUR Desktop (≥1024 px) UND /adtest-* Test-Routen
              bekommen InMobi Choice (TheMoneytizer's CMP für TCF 2.3).
              Mobile bekommt KEINEN CMP mehr — auf Mobile gibt es keine Ads,
              also auch kein Consent-Bedarf. Analytics-Tools (GA4, Mouseflow,
              Ezoic Analytics) laufen ohne CMP-String im "no-consent"-Modus. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var isDesktop=window.matchMedia&&window.matchMedia('(min-width: 1024px)').matches;var isAdTest=window.location.pathname.indexOf('/adtest-')===0;if(!(isDesktop||isAdTest))return;/* InMobi Choice. Consent Manager Tag v3.0 (for TCF 2.3) */
(function(){var host="www.themoneytizer.de";var element=document.createElement('script');var firstScript=document.getElementsByTagName('script')[0];var url='https://cmp.inmobi.com'.concat('/choice/','6Fv0cGNfc_bw8','/',host,'/choice.js?tag_version=V3');var uspTries=0;var uspTriesLimit=3;element.async=true;element.type='text/javascript';element.src=url;firstScript.parentNode.insertBefore(element,firstScript);function makeStub(){var TCF_LOCATOR_NAME='__tcfapiLocator';var queue=[];var win=window;var cmpFrame;function addFrame(){var doc=win.document;var otherCMP=!!(win.frames[TCF_LOCATOR_NAME]);if(!otherCMP){if(doc.body){var iframe=doc.createElement('iframe');iframe.style.cssText='display:none';iframe.name=TCF_LOCATOR_NAME;doc.body.appendChild(iframe);}else{setTimeout(addFrame,5);}}return !otherCMP;}function tcfAPIHandler(){var gdprApplies;var args=arguments;if(!args.length){return queue;}else if(args[0]==='setGdprApplies'){if(args.length>3&&args[2]===2&&typeof args[3]==='boolean'){gdprApplies=args[3];if(typeof args[2]==='function'){args[2]('set',true);}}}else if(args[0]==='ping'){var retr={gdprApplies:gdprApplies,cmpLoaded:false,cmpStatus:'stub'};if(typeof args[2]==='function'){args[2](retr);}}else{if(args[0]==='init'&&typeof args[3]==='object'){args[3]=Object.assign(args[3],{tag_version:'V3'});}queue.push(args);}}function postMessageEventHandler(event){var msgIsString=typeof event.data==='string';var json={};try{if(msgIsString){json=JSON.parse(event.data);}else{json=event.data;}}catch(ignore){}var payload=json.__tcfapiCall;if(payload){window.__tcfapi(payload.command,payload.version,function(retValue,success){var returnMsg={__tcfapiReturn:{returnValue:retValue,success:success,callId:payload.callId}};if(msgIsString){returnMsg=JSON.stringify(returnMsg);}if(event&&event.source&&event.source.postMessage){event.source.postMessage(returnMsg,'*');}},payload.parameter);}}while(win){try{if(win.frames[TCF_LOCATOR_NAME]){cmpFrame=win;break;}}catch(ignore){}if(win===window.top){break;}win=win.parent;}if(!cmpFrame){addFrame();win.__tcfapi=tcfAPIHandler;win.addEventListener('message',postMessageEventHandler,false);}}makeStub();var uspStubFunction=function(){var arg=arguments;if(typeof window.__uspapi!==uspStubFunction){setTimeout(function(){if(typeof window.__uspapi!=='undefined'){window.__uspapi.apply(window.__uspapi,arg);}},500);}};var checkIfUspIsReady=function(){uspTries++;if(window.__uspapi===uspStubFunction&&uspTries<uspTriesLimit){console.warn('USP is not accessible');}else{clearInterval(uspInterval);}};if(typeof window.__uspapi==='undefined'){window.__uspapi=uspStubFunction;var uspInterval=setInterval(checkIfUspIsReady,6000);}})();})();`,
          }}
        />

        {/* AdSense-Loader wurde aus dem Root-<head> entfernt (Juni 2026) —
            er hat SPA-Navigation zwischen Artikelseiten kaputt gemacht (Ads
            kamen erst nach F5 wieder). Der Loader sitzt jetzt wieder direkt
            in `app/[slug]/page.tsx` via <Script strategy="afterInteractive">,
            sodass Next.js seinen Page-Mount-Lifecycle synchron mit den
            ClientAdSlot-Komponenten verwaltet. Preconnect bleibt site-wide,
            damit der TLS-Handshake bei der ersten Artikel-Navigation
            schon im Hintergrund läuft. */}

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

        {/* Mouseflow deaktiviert (Feb 2026, Cost-Optimierung) — Session-
            Recordings + Heatmaps werden über GA4 / Ezoic Analytics abgedeckt. */}

        {/* Ezoic Standalone SDK + Analytics.
            Gatekeeper-CMP-Zeilen bewusst NICHT eingebaut — Site nutzt bereits
            InMobi Choice (Desktop) + Google Funding Choices (Mobile). Ein
            dritter CMP würde __tcfapi-Race-Conditions, doppelte Consent-
            Overlays und Yieldlab-Prebid-noBids verursachen.
            Ezoic fällt hier auf die bestehende TCF-Consent-Kette zurück.
            Alle drei Scripts als afterInteractive → blockieren weder LCP
            noch INP. */}
        <Script
          id="ezoic-sa"
          src="https://www.ezojs.com/ezoic/sa.min.js"
          strategy="afterInteractive"
        />
        <Script id="ezstandalone-init" strategy="afterInteractive">
          {`
            window.ezstandalone = window.ezstandalone || {};
            ezstandalone.cmd = ezstandalone.cmd || [];
          `}
        </Script>
        <Script
          id="ezoic-analytics"
          src="https://ezoicanalytics.com/analytics.js"
          strategy="afterInteractive"
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
