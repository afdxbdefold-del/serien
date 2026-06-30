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
 * Sellers.json / Schain-Konfiguration.
 *
 * Platzhalter — ASI/SID müssen vom Vermarkter bestätigt werden.
 * Bei Änderung lediglich `nodes[]` editieren.
 */
export const PREBID_SCHAIN_CONFIG = {
  validation: 'strict' as const,
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      {
        asi: 'af-consulting.de',
        sid: 'serien.de',
        hp: 1,
      },
    ],
  },
} as const;

/** Auction-Timeout in ms */
export const PREBID_TIMEOUT_MS = 1200;
