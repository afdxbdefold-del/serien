'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { ThemeProvider } from './ThemeProvider';
import PushNotificationPrompt from './PushNotificationPrompt';
import SkipLink from './SkipLink';
import MobileTopAd from './MobileTopAd';
import ClientAdSlot from './ClientAdSlot';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  
  // Check if this is an article page (has a slug, not a special route)
  const specialRoutes = [
    '/', '/about', '/datenschutz', '/impressum', '/kalender', '/serienfinder',
    '/autoren', '/autor', '/figur', '/figuren', '/person', '/personen', 
    '/serie', '/genre', '/neue-serien', '/admin'
  ];
  const isArticlePage = pathname && !specialRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  ) && !pathname.includes('-serien');

  // Admin routes have their own full-page layout
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Public routes get the standard header/footer
  return (
    <ThemeProvider>
      <SkipLink />
      {isArticlePage && <MobileTopAd />}
      <Header />
      {/* below_breadcrumb Slot: direkt unter dem Header, mobile-only,
          Full-Width #121318 BG. Container wird auf md+ ausgeblendet,
          ClientAdSlot selbst respektiert zusätzlich das mobileOnly-Flag
          aus der DB. */}
      <div className="md:hidden w-full bg-[#121318] flex flex-col items-center py-3 px-2">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 mb-1 leading-none">Anzeige</span>
        <ClientAdSlot position="below_breadcrumb" />
      </div>
      <main id="main-content" className="flex-1" role="main" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <PushNotificationPrompt />
    </ThemeProvider>
  );
}
