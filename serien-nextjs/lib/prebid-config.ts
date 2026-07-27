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
/**
 * SCHAIN-Varianten – schneller Umschalter für A/B-Tests mit Yieldlab.
 *
 * Verifiziert live gegen die öffentlichen sellers.json-Dateien
 * (Stand 2026-07): afconsulting.info, advertising-alliance.de, yieldlab.net.
 *
 * VARIANT `v1_yieldlab_direct`  (alt, 1-Node):
 *   Direktverkauf an Yieldlab. Ergab bislang `noBid`, weil weder Advertising
 *   Alliance noch AF Consulting in der Kette auftauchen.
 *
 * VARIANT `v2_alliance_chain`   (2-Node, IAB-pur):
 *   serien.de → AF Consulting → Advertising Alliance.
 *   Reine IAB-Spec-Interpretation (empfangende SSP wird nicht als Node
 *   geführt). Yieldlab validiert aber die eigene sellers.json und wirft
 *   dann „schain invalid", weil sie sich selbst als terminaler Node erwarten.
 *
 * VARIANT `v3_full_chain`       (3-Node, inkl. Yieldlab)  ✅ AKTIV
 *   serien.de → AF Consulting → Advertising Alliance → Yieldlab.
 *   Alle `sid`-Werte 1:1 aus den jeweiligen sellers.json übernommen.
 *
 * Wechseln: einfach `PREBID_SCHAIN_VARIANT` unten umsetzen.
 */
export const PREBID_SCHAIN_VARIANT:
  | 'v1_yieldlab_direct'
  | 'v2_alliance_chain'
  | 'v3_full_chain'
  | 'v4_direct_alliance' = 'v4_direct_alliance';

/**
 * Publisher-ID von serien.de bei AF Consulting.
 * Verifiziert in afconsulting.info/sellers.json → seller_id: "serien.de".
 */
const AFC_PUBLISHER_ID_FOR_SERIEN_DE = 'serien.de';

const SCHAIN_V1_YIELDLAB_DIRECT = {
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
        domain: 'afconsulting.info',
      },
    ],
  },
} as const;

const SCHAIN_V2_ALLIANCE_CHAIN = {
  validation: 'strict' as const,
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      { asi: 'afconsulting.info',       sid: AFC_PUBLISHER_ID_FOR_SERIEN_DE, hp: 1 },
      { asi: 'advertising-alliance.de', sid: 'afconsulting',                 hp: 1 },
    ],
  },
} as const;

const SCHAIN_V3_FULL_CHAIN = {
  validation: 'strict' as const,
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      // 1) serien.de wird von AF Consulting vermarktet
      { asi: 'afconsulting.info',       sid: AFC_PUBLISHER_ID_FOR_SERIEN_DE, hp: 1 },
      // 2) AF Consulting reicht an Advertising Alliance (Zwischenvermarkter)
      { asi: 'advertising-alliance.de', sid: 'afconsulting',                 hp: 1 },
      // 3) Advertising Alliance ist bei Yieldlab mit seller_id 35673 gelistet
      { asi: 'yieldlab.net',            sid: '35673',                        hp: 1 },
    ],
  },
} as const;

/**
 * VARIANT `v4_direct_alliance` — Stand Feb 2026 ✅ AKTIV.
 *
 * AF Consulting wurde aus advertising-alliance.de/sellers.json entfernt,
 * daher fällt Node 1+2 der alten v3-Chain weg. serien.de ist jetzt direkt
 * bei Advertising Alliance geführt (seller_id: "serien.de", PUBLISHER-Typ),
 * die wiederum bei Yieldlab mit seller_id 35673 gelistet ist.
 *
 * Kette:
 *   serien.de → Advertising Alliance → Yieldlab
 */
const SCHAIN_V4_DIRECT_ALLIANCE = {
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

export const PREBID_SCHAIN_CONFIG =
  PREBID_SCHAIN_VARIANT === 'v4_direct_alliance'
    ? SCHAIN_V4_DIRECT_ALLIANCE
    : PREBID_SCHAIN_VARIANT === 'v3_full_chain'
    ? SCHAIN_V3_FULL_CHAIN
    : PREBID_SCHAIN_VARIANT === 'v2_alliance_chain'
    ? SCHAIN_V2_ALLIANCE_CHAIN
    : SCHAIN_V1_YIELDLAB_DIRECT;

/** Auction-Timeout in ms */
export const PREBID_TIMEOUT_MS = 1200;
