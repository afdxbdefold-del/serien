/**
 * Isolierter Yieldlab-Direct-Tag Test.
 *
 * Zweck: Prüft, ob der offizielle Yieldlab-Tag von Advertising Alliance
 * für serien.de (adslotId 18384401, supplyId 35673) OHNE Prebid.js,
 * OHNE TheMoneytizer, OHNE AdSense überhaupt ein Creative ausliefert.
 *
 * Original-Tag (von AA am 2026-02 geliefert):
 *   <script src="https://ad.yieldlab.net/d/18384401/35673/?ts=[zeitstempel]"></script>
 *
 * Wir ersetzen `[zeitstempel]` durch einen Unix-Timestamp und injizieren
 * das <script> in einen dezidierten Container-DIV — damit Yieldlab per
 * `document.write` das Creative genau dort einfügt.
 *
 * Ergebnisschlüssel:
 *   • Creative erscheint → Yieldlab-Backend ist ok, Prebid-Integration
 *     hat ein separates Problem (schain / TCF Vendor 70 / etc.).
 *   • Nichts erscheint / leere Response → Setup-Problem bei Yieldlab
 *     bzw. Advertising Alliance (Slot inaktiv, Domain nicht freigegeben,
 *     keine Kampagne).
 *
 * KEIN Prebid, KEIN CMP-Coupling, KEIN Auto-Refresh. Nur die reine
 * SSP-Response wird gemessen.
 *
 * noindex.
 */
import type { Metadata } from 'next';
import DirectTagTest from './DirectTagTest';

export const metadata: Metadata = {
  title: 'Yieldlab Direct Tag Test',
  description: 'Isolierter Yieldlab Direct-Tag Auslieferungs-Test (intern)',
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = 'force-dynamic';

export default function AdTestDirectPage() {
  return <DirectTagTest />;
}
