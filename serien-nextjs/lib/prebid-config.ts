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
 * Kette ist einnodig: Publisher (AF Consulting, Betreiber von serien.de)
 * liefert direkt an Yieldlab, kein Reseller dazwischen.
 *
 * Feld-Semantik (IAB spec):
 *  - `asi`   = Domain des NÄCHSTEN Sellers/SSP in der Chain — hier `yieldlab.net`
 *  - `sid`   = eure Publisher/Seller-ID BEI Yieldlab (numerisch, aus dem
 *              Yieldlab-Konto-Backend). Muss identisch mit dem `seller_id`-
 *              Eintrag in `https://yieldlab.net/sellers.json` sein.
 *              ⚠️  Aktuell mit `supplyId` (35673) belegt — das ist der
 *              wahrscheinlichste Kandidat, MUSS aber gegen Yieldlab-Portal
 *              (Konto → Publisher-ID) verifiziert werden.
 *  - `hp`    = 1 (paid — AF Consulting bekommt Geld für diese Impressions)
 *  - `rid`   = optional; per-Auction Request-ID (leer lassen für statische Config)
 *  - `name`  = optional; juristische Entität des Sellers
 *  - `domain`= optional; Business-Domain des Sellers
 *
 * Bei Änderung nur `nodes[]` editieren.
 */
export const PREBID_SCHAIN_CONFIG = {
  validation: 'strict' as const,
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      {
        asi: 'yieldlab.net',
        sid: '35673',
        hp: 1,
        rid: '',
        name: 'AF Consulting',
        domain: 'af-consulting.de',
      },
    ],
  },
} as const;

/** Auction-Timeout in ms */
export const PREBID_TIMEOUT_MS = 1200;
