/**
 * Test-Page für die Prebid.js + Yieldlab Auction.
 *
 * Server-Component nur als Shell — KEINE Daten-Fetches im SSR, KEINE
 * Ads, KEIN AdSense, KEIN TheMoneytizer. Der gesamte Prebid-Lifecycle
 * läuft im Client-Component PrebidTest, das nur im Browser mountet.
 *
 * Route: /adtest-prebid (Next.js normalisiert ohne .html-Suffix; falls
 *        Yieldlab/Vermarkter explizit /adtest-prebid.html anfragen,
 *        existiert ein Rewrite in next.config.ts).
 *
 * noindex via Metadata damit Google den Slot nicht crawlt.
 */
import type { Metadata } from 'next';
import PrebidTest from './PrebidTest';

export const metadata: Metadata = {
  title: 'Prebid Yieldlab Test',
  description: 'Isolierter Prebid.js + Yieldlab Auction-Test (intern)',
  robots: { index: false, follow: false, noarchive: true },
};

// Force-dynamic damit Next.js diese Seite NICHT prerendert/statisch
// cached — der Test soll auf jedem Hit frisch initialisieren.
export const dynamic = 'force-dynamic';

export default function AdTestPrebidPage() {
  return <PrebidTest />;
}
