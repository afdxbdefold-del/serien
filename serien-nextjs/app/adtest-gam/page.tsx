/**
 * Test-Page für die Google Ad Manager (GPT.js) + Yieldlab Integration.
 *
 * Analog zu /adtest-prebid — Server-Component nur als Shell, kein SSR-
 * Fetch, kein AdSense, kein TheMoneytizer. Der komplette GAM-Lifecycle
 * läuft im Client-Component GamTest.
 *
 * Route: /adtest-gam
 * .html-Alias: /adtest-gam.html (siehe next.config.ts rewrites)
 *
 * CMP: LayoutWrapper skipped Header/Footer für alle `/adtest-*`-Routen.
 * Die CMP-Switch-Logik in app/layout.tsx erzwingt InMobi Choice auf allen
 * adtest-Routen — das gleiche Vendor-Set wie Production-Desktop, damit
 * Yieldlab-Bids in GAM konsistent zum Rest der Site laufen.
 *
 * noindex via Metadata damit Google den Slot nicht crawlt.
 */
import type { Metadata } from 'next';
import GamTest from './GamTest';

export const metadata: Metadata = {
  title: 'GAM + Yieldlab Test',
  description: 'Isolierter Google Ad Manager (GPT.js) + Yieldlab Auction-Test (intern)',
  robots: { index: false, follow: false, noarchive: true },
};

// Force-dynamic damit Next.js diese Seite NICHT prerendert/statisch cached.
export const dynamic = 'force-dynamic';

export default function AdTestGamPage() {
  return <GamTest />;
}
