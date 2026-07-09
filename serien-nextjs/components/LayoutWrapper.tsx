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
import ThemePageSidebar from './ThemePageSidebar';

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
  
  // Check if this is an article page (has a slug, not a special route)
  const specialRoutes = [
    '/', '/about', '/datenschutz', '/impressum', '/kalender', '/serienfinder',
    '/autoren', '/autor', '/figur', '/figuren', '/person', '/personen', 
    '/serie', '/genre', '/neue-serien', '/admin'
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
      {isThemePage ? (
        /* Themenseiten bekommen dieselbe Grid-Struktur wie die Startseite:
           Content-Column links (1fr, gecapt auf 1000 px durch Themen-
           seiten-eigene max-w-Container), Sidebar-Column rechts 300 px.
           Grid ist zentriert bei max-w-[1332px] (1000 + 32 gap + 300).
           Damit müssen die ~30 einzelnen Themenseiten NICHT angefasst
           werden — sie sitzen einfach in der linken Cell. */
        <main
          id="main-content"
          className="flex-1 lg:mx-auto lg:max-w-[1332px] lg:w-full lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8 lg:px-6"
          role="main"
          tabIndex={-1}
        >
          <div className="min-w-0">{children}</div>
          <ThemePageSidebar />
        </main>
      ) : (
        <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
          {children}
        </main>
      )}
      {/* Zusätzlicher Megabanner Bottom auf Themenseiten — analog Top. */}
      {isThemePage && <ThemePageAdBottom />}
      <Footer />
      <PushNotificationPrompt />
    </ThemeProvider>
  );
}
