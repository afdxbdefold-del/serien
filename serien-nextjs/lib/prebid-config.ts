/**
 * Yieldlab / Prebid.js Test-Slot — zentral editierbare Konfiguration.
 *
 * Diese Datei wird vom Client-Component `app/adtest-prebid/PrebidTest.tsx`
 * importiert. Wenn der Yieldlab-Vermarkter neue Schain-Werte (asi / sid)
 * oder eine andere adslotId / supplyId liefert, NUR hier ändern.
 *
 * Bewusst KEINE env-Variablen, weil der Test rein clientseitig läuft und
 * die Werte ohnehin im DevTools sichtbar wären.
 */

export const YIELDLAB_TEST_SLOT = {
  /** Container-ID im DOM */
  containerId: 'ad-yieldlab-300x250',
  /** Format */
  size: [300, 250] as [number, number],
  /** Yieldlab Slot-ID (vom Vermarkter) */
  adslotId: '18384401',
  /** Yieldlab Supply-ID (vom Vermarkter) */
  supplyId: '35673',
} as const;

/**
 * Sellers.json / Schain-Konfiguration (IAB Supply Chain Object).
 *
 * Kette verifiziert 2026-03 live gegen advertising-alliance.de/sellers.json
 * UND yieldlab.net/sellers.json (siehe /api/adtest/chain-check):
 *
 *   serien.de → advertising-alliance.de (PUBLISHER, seller_id="serien.de")
 *             → yieldlab.net (INTERMEDIARY, seller_id="35673")
 *
 * AF Consulting (afconsulting.info) ist KOMPLETT ENTFERNT — die Entität
 * existiert nicht mehr in AA's sellers.json und darf in keinem Node mehr
 * auftauchen. Yieldlab meldete 2026-03, dass eingehende Requests trotzdem
 * noch "afconsulting.info" in der schain hatten (Root-Cause für noBid trotz
 * korrekter ads.txt) — das kam aus einer alten Variante dieser Datei.
 * Diese Datei hat jetzt nur noch EINE Konfiguration, kein Varianten-Switch
 * mehr, damit sowas nicht wieder passieren kann.
 *
 * Feld-Semantik (IAB spec):
 *  - `asi`    = Domain des Sellers/SSP in dieser Chain-Position
 *  - `sid`    = Seller-ID BEI diesem `asi` (muss 1:1 mit dessen sellers.json
 *               `seller_id`-Feld matchen)
 *  - `hp`     = 1 (paid)
 *  - `name`/`domain` = optional, nur beim ersten (Publisher-)Node gesetzt
 */
export const PREBID_SCHAIN_CONFIG = {
  validation: 'strict' as const,
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      { asi: 'advertising-alliance.de', sid: 'serien.de', hp: 1, name: 'serien', domain: 'serien.de' },
      { asi: 'yieldlab.net',            sid: '35673',     hp: 1 },
    ],
  },
} as const;

/** Auction-Timeout in ms */
export const PREBID_TIMEOUT_MS = 1200;
