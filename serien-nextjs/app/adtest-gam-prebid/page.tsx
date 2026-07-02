/**
 * Test-Page für Prebid.js + Google Ad Manager (GAM) Header Bidding.
 *
 * Kombiniert prebid.js (Yieldlab-Auction im Client) + gpt.js (GAM als
 * Ad-Server). Prebid-Winning-Bids werden via `pbjs.setTargetingForGPTAsync()`
 * als Key-Value-Targeting (`hb_pb`, `hb_bidder`, `hb_adid`, …) an GAM
 * übergeben. GAM matched dann eine Line-Item, die den Prebid-Universal-
 * Creative-Renderer lädt — der wiederum liefert das Yieldlab-Creative
 * SafeFrame-sicher aus.
 *
 * Warum diese Route existiert:
 * GAM hat SafeFrame seit Anfang 2025 als Default und lässt sich für neue
 * Line-Items nicht mehr deaktivieren. Klassische `document.write`-basierte
 * Yieldlab-Sync-Tags rendern deshalb in GAM stumm (isEmpty=false, aber
 * unsichtbar). Header Bidding via Prebid Universal Creative ist der
 * saubere Workaround.
 *
 * GAM-Setup (siehe Anleitung an User):
 *  1. Line-Item mit Targeting `hb_pb IS PRESENT`
 *  2. Creative = Prebid Universal Creative-Snippet
 *  3. Werbebuchung aktiv
 *
 * Route: /adtest-gam-prebid  ·  Alias: /adtest-gam-prebid.html
 */
import type { Metadata } from 'next';
import GamPrebidTest from './GamPrebidTest';

export const metadata: Metadata = {
  title: 'GAM + Prebid + Yieldlab Header-Bidding Test',
  description: 'Prebid.js Header Bidding gegen Yieldlab, Auslieferung via Google Ad Manager (intern)',
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = 'force-dynamic';

export default function AdTestGamPrebidPage() {
  return <GamPrebidTest />;
}
