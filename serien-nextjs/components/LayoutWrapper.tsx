'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { ThemeProvider } from './ThemeProvider';
import PushNotificationPrompt from './PushNotificationPrompt';
import SkipLink from './SkipLink';
import MobileTopAd from './MobileTopAd';
import ClientAdSlot from './ClientAdSlot';
import GlobalDesktopAds from './GlobalDesktopAds';
import { ThemePageAdTop, ThemePageAdBottom } from './ThemePageAds';
import RecommendedContentTMN from './RecommendedContentTMN';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

/**
 * Legal- und Konto-Seiten: hier bewusst KEINE zusätzlichen Content-Ads.
 * Nur die globalen Slots (Billboard, Skyscraper, Corner, Slide-in) via
 * <GlobalDesktopAds /> laufen dort weiter. */
const AD_FREE_CONTENT_ROUTES = new Set([
  '/impressum',
  '/datenschutz',
  '/nutzungsbedingungen',
  '/redaktionelle-richtlinien',
  '/about',
  '/einstellungen',
]);

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  // Ad-Test-Seiten (Yieldlab/Prebid Auction-Tests) sollen isoliert
  // rendern — KEIN Header, KEIN Footer, KEIN below_breadcrumb-Slot,
  // damit Vermarkter saubere Auction-Logs sehen.
  const isAdTestRoute = pathname?.startsWith('/adtest-');
  
  // Non-Article-Routen: alle bekannten Public-Routen, die KEINE Artikel-
  // Detail-Slugs sind. Diese Liste ist positive Whitelist — was hier NICHT
  // drin steht und keinen Bindestrich in einem "-serien"-Suffix hat, wird
  // als Artikel behandelt (isArticlePage=true → Grid-Layout des Artikels).
  //
  // Wichtig: /news, /trending, /top-10, /top-100-*, /the-walking-dead,
  // /in-90-tagen-zum-altar etc. sind Themen-Hubs, KEINE Artikel.
  const specialRoutes = [
    '/', '/about', '/datenschutz', '/impressum', '/nutzungsbedingungen',
    '/redaktionelle-richtlinien', '/einstellungen',
    '/kalender', '/serienfinder', '/serien', '/neue-serien', '/news',
    '/trending', '/figuren', '/figur', '/personen', '/person', '/autoren',
    '/autor', '/serie', '/genre', '/admin',
    '/top-10', '/top-100-serien', '/top-100-netflix', '/top-100-amazon-prime',
    '/top-100-disney-plus',
    '/the-walking-dead', '/in-90-tagen-zum-altar',
    '/x-news',
  ];
  const isArticlePage = pathname && !specialRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  ) && !pathname.includes('-serien');

  // Themenseiten = alle Public-Routen, die KEIN Artikel, KEINE Homepage,
  // KEINE Legal-/Konto-Seite und KEINE Admin/AdTest-Route sind.
  // Beispiele: /netflix-serien, /beste-crime-serien, /top-10, /trending,
  // /serien, /kalender, /serienfinder, /figuren, /personen, /neue-serien,
  // /the-walking-dead, /in-90-tagen-zum-altar, /news, /autor/*, /serie/*
  const isLegalPage = pathname ? AD_FREE_CONTENT_ROUTES.has(pathname) : false;
  const isHomePage = pathname === '/';
  const isThemePage =
    !!pathname &&
    !isAdminRoute &&
    !isAdTestRoute &&
    !isArticlePage &&
    !isHomePage &&
    !isLegalPage;

  // Admin routes have their own full-page layout
  if (isAdminRoute || isAdTestRoute) {
    return <>{children}</>;
  }

  // Public routes get the standard header/footer
  return (
    <ThemeProvider>
      <SkipLink />
      {isArticlePage && <MobileTopAd />}
      <Header />
      {/* below_breadcrumb Slot: NUR auf Artikelseiten, direkt unter dem
          Header, mobile-only, Full-Width #121318 BG. */}
      {isArticlePage && (
        <div className="md:hidden w-full bg-[#121318] flex justify-center py-3 px-2">
          <ClientAdSlot position="below_breadcrumb" />
        </div>
      )}
      {/* Globale Desktop-Ads (Billboard Header, Skyscraper links/rechts,
          Corner Video, Footer Slide-in). Rendert auf ALLEN Public-Seiten,
          nicht nur Artikel. Content-abhängige Slots (Megabanner, In-Content,
          Sidebar Halfpage, Bottom-Rect) bleiben auf der Artikelseite. */}
      <GlobalDesktopAds />
      {/* Zusätzlicher Megabanner Top NUR auf Themenseiten
          (Streamer-Landings, Genre-Seiten, Top-Listen, Übersichten).
          Homepage und Artikelseite haben ihren eigenen Inline-Ad-Stack;
          Legal-/Konto-Seiten bewusst ohne Content-Ads. */}
      {isThemePage && <ThemePageAdTop />}
      <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
        {children}
      </main>
      {/* Zusätzlicher Megabanner Bottom auf Themenseiten — analog Top. */}
      {isThemePage && <ThemePageAdBottom />}
      {/* Recommended-Content Widget (TheMoneytizer Format 16) — auf
          allen Public-Seiten außer Legal-/Konto-Seiten. Läuft direkt
          vor dem Footer, im 1000-px-Content-Container. */}
      {!isLegalPage && <RecommendedContentTMN />}
      <Footer />
      <PushNotificationPrompt />
    </ThemeProvider>
  );
}
