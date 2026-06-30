# Prebid.js + Yieldlab Test-Integration

Isolierter Auction-Test damit der Vermarkter / Yieldlab prüfen kann, ob
programmatische Bid-Requests mit Consent, Schain, adslotId und supplyId
korrekt ankommen.

## Test-URLs

- Primär: <https://serien.de/adtest-prebid>
- Alias (für Vermarkter mit `.html`-Suffix): <https://serien.de/adtest-prebid.html>
- Mit Verbose-Logging: <https://serien.de/adtest-prebid?pbjs_debug=true>

## Was die Seite tut

1. Lädt `/prebid.js` (Custom-Build, 207 KB, alle Module inline)
2. Wartet auf `window.__tcfapi` (IAB-TCF v2) bis max. 5 s
3. Setzt `pbjs.setConfig({ debug, consentManagement.gdpr, schain })`
4. Fügt EINEN AdUnit hinzu (Yieldlab 300×250, slot 18384401, supply 35673)
5. `pbjs.requestBids({ timeout: 1200 })`
6. Im `bidsBackHandler`:
   - Logged `getBidResponses()` + `getHighestCpmBids()` in der Console
   - Bei Bid: rendert das Creative in einen sandboxed iframe via `pbjs.renderAd()`
   - Ohne Bid: blendet den Slot aus (`display:none`) — KEIN Layout-Shift, kein leerer Frame

## Strikte Garantien

- **Kein SSR** — der gesamte Prebid-Lifecycle läuft erst im Browser (Client Component)
- **Kein AdSense** in diesem Slot (Page steht außerhalb der Article-Page-Injection)
- **Kein TheMoneytizer** (keine `<GlobalTags>` auf dieser Page)
- **Kein Auto-Refresh** (nur 1 `requestBids`-Call pro Page-Load)
- **Kein Bid-Request ohne Consent** — wenn `__tcfapi` fehlt, wird Auction abgebrochen + Slot ausgeblendet
- **Nur 1 Slot** — bewusst minimal für saubere Vermarkter-Verifikation
- **noindex** — Metadata setzt `robots: noindex, nofollow, noarchive`

## Zentrale Config-Stellen

| Was | Datei | Konstante |
|---|---|---|
| Slot-/Supply-ID, Size | `lib/prebid-config.ts` | `YIELDLAB_TEST_SLOT` |
| Schain (ASI/SID) | `lib/prebid-config.ts` | `PREBID_SCHAIN_CONFIG` |
| Auction-Timeout | `lib/prebid-config.ts` | `PREBID_TIMEOUT_MS` |
| Test-Page Layout | `app/adtest-prebid/PrebidTest.tsx` | — |
| .html-Rewrite | `next.config.ts` | rewrites array |
| Header/Footer Skip | `components/LayoutWrapper.tsx` | `isAdTestRoute` |

## Custom-Build neu generieren

```bash
cd /app/serien-nextjs/node_modules/prebid.js
./node_modules/.bin/gulp build \
  --modules=yieldlabBidAdapter,consentManagementTcf,schain,currency,priceFloors
cp build/dist/prebid.js ../../public/prebid.js
```

Prebid.js v9.53.5 / Build-Zeit ~10 s / Bundle 207 KB.

## Debug-Commands (in DevTools)

```js
pbjs.getBidResponses()                                    // alle Responses
pbjs.getHighestCpmBids('ad-yieldlab-300x250')             // Winner
pbjs.onEvent('bidResponse', b => console.log('bid:', b))  // Live-Tail
pbjs.getConfig('schain')                                  // aktive Schain
```

## Erwartete Console-Logs (Happy Path)

```
[prebid-test] Prebid initialized { version: "v9.53.5" }
[prebid-test] Consent config loaded { gdprApplies: true, tcStringLen: 600 }
[prebid-test] setConfig done { schain: {...}, timeout: 1200 }
[prebid-test] Yieldlab adUnit added [...]
[prebid-test] Bid responses: {...}
[prebid-test] Winning bids: [{...}]
[prebid-test] renderAd ok { adId: "..." }
```

## Erwartete Console-Logs (kein Bid)

```
[prebid-test] No Yieldlab bid
```
→ Status-Panel zeigt `no-bid`, Slot wird ausgeblendet.
