# Ad-Stack — vollständige Referenz

## 1. Überblick

serien.de ist werbefinanziert. Kein Google AdSense mehr (Feb 2026 vollständig
entfernt wegen Invalid-Traffic-Sperre durch Bot-Netzwerke — siehe
`middleware.ts` Ad-Fraud-Firewall unten). Aktueller Demand-Stack:

- **Yieldlab** (via Prebid.js Header-Bidding, Vermarkter: **Advertising
  Alliance**)
- **TheMoneytizer** (eigenes Header-Bidding-Wrapper-System + CMP)
- **Primis/Freestar (pub.network)** — Outstream-Video-Ads

## 2. ads.txt

Generiert dynamisch über `app/api/ads/route.ts`, per Rewrite in
`next.config.ts` unter `/ads.txt` erreichbar:
```js
{ source: '/ads.txt', destination: '/api/ads' }
```
Enthält u. a. TheMoneytizer, Advertising Alliance/Yieldlab, Primis, Admixer
und ~40 SSP-Reseller-Zeilen. TheMoneytizer erwartet zusätzlich eine
PHP-artige Verifier-URL — dafür gibt es die zweite Route `app/api/ads-tm/route.ts`,
gemappt via:
```js
{ source: '/ads_tm.php', destination: '/api/ads-tm' }
```

**Historischer Bug (behoben, März 2026)**: Die Zeile
`advertising-alliance.de, 35673, DIRECT` war ungültig — AAs eigene
`sellers.json` kennt diese Seller-ID nicht unter dieser Rolle. Korrekte
Kette:
```
advertising-alliance.de, serien.de, DIRECT
yieldlab.net, 35673, RESELLER
```
Bei jeder ads.txt-Änderung: gegen die tatsächliche `sellers.json` des
jeweiligen Vermarkters validieren (z. B. via `/api/adtest/chain-check`, siehe
unten), nicht nur gegen Dokumentation/E-Mails vom Vermarkter.

## 3. Yieldlab / Prebid.js Supply-Chain (Schain)

Zentrale Konfiguration: **`lib/prebid-config.ts`** — bewusst OHNE
Env-Variablen, weil der Test rein clientseitig läuft und die Werte im
DevTools ohnehin sichtbar wären:

```ts
export const YIELDLAB_TEST_SLOT = {
  containerId: 'ad-yieldlab-300x250',
  size: [300, 250] as [number, number],
  adslotId: '18384401',
  supplyId: '35673',
};

export const PREBID_SCHAIN_CONFIG = {
  validation: 'strict',
  config: {
    ver: '1.0',
    complete: 1,
    nodes: [
      { asi: 'advertising-alliance.de', sid: 'serien.de', hp: 1, name: 'serien', domain: 'serien.de' },
      { asi: 'yieldlab.net',            sid: '35673',     hp: 1 },
    ],
  },
};

export const PREBID_TIMEOUT_MS = 1200;
```

**Feld-Semantik (IAB Supply Chain Object Spec)**: `asi` = Domain des
Sellers/SSP an dieser Kettenposition, `sid` = Seller-ID BEI diesem `asi`
(muss exakt mit dessen `sellers.json`-`seller_id`-Feld übereinstimmen),
`hp` = 1 (paid), `name`/`domain` nur beim ersten (Publisher-)Node gesetzt.

**Historischer Root-Cause-Fund (März 2026)**: Yieldlab meldete, dass
eingehende Requests eine falsche Drittdomain (`afconsulting.info`) in der
Schain enthielten — Überbleibsel einer alten Config-Variante. `lib/prebid-config.ts`
wurde komplett bereinigt: **nur noch eine aktive Konfiguration, kein
Varianten-Switch mehr**, damit alte Werte nicht wieder unbeabsichtigt aktiv
werden können.

## 4. Diagnose-Tools

### `/api/adtest/chain-check` (`app/api/adtest/chain-check/route.ts`)
Serverseitiger Live-Check der `sellers.json` von Advertising Alliance UND
Yieldlab. Existiert, weil ein direkter Client-Fetch der externen
`sellers.json`-Dateien an CORS scheitert — die Prüfung muss serverseitig
laufen und wird von den Testseiten per eigenem Fetch aufgerufen.

### `/adtest-direct` (`app/adtest-direct/`)
Testseite für den direkten (Non-Prebid) Ad-Tag. Zeigt Chain-Check-Ergebnis.

### `/adtest-prebid` (`app/adtest-prebid/`)
Testseite für den Prebid.js-Auktionspfad. Zeigt zusätzlich:
- aktive Schain-Nodes (aus `lib/prebid-config.ts`)
- Vendor-70-Consent-Status (Yieldlab ist TCF Vendor ID 70)
- rohen Schain-Query-Parameter, wie er tatsächlich an Yieldlab gesendet wird
- Bid/NoBid-Status pro Slot

### `/adtest-gam`, `/adtest-gam-prebid`
Weitere Ad-Test-Varianten (Google Ad Manager-Pfad, falls dieser Demand-Kanal
zusätzlich getestet wird — Details direkt im jeweiligen `page.tsx` prüfen).

Alle vier `/adtest-*`-Seiten sind zusätzlich per `.html`-Suffix erreichbar
(Rewrite in `next.config.ts`, z. B. `/adtest-prebid.html` → `/adtest-prebid`),
weil manche Vermarkter-Testtools klassische `.html`-URLs erwarten.

## 5. TCF-Consent / CMP

CMP-Anbieter: **InMobi Choice**, gehostet unter `themoneytizer.de`
(White-Label für TheMoneytizer). Liefert TCF v2.x-Consent-String über die
Standard-`__tcfapi()`-Browser-API. Yieldlab = **Vendor ID 70** im GVL
(Global Vendor List) — muss in `is_vendor_allowed(70)` als `true` erscheinen,
damit Yieldlab überhaupt bieten darf.

**Diagnose-Historie**: Ein realer Browser-Request mit vollständigem,
gültigem TCF-String wurde einmal mit einer IAB-Decoding-Bibliothek analysiert
— Vendor 70 war korrekt als erlaubt markiert, keine Publisher-Restrictions
gefunden. **Trotzdem antwortete Yieldlab mit explizitem `noBid`.** Das zeigt:
Ein korrekter Consent-String allein garantiert keine Bids — die Ursache für
fehlende Bids liegt oft auf Demand-/Kampagnen-/Floor-Price-Seite des
Vermarkters, nicht im eigenen Consent-Setup.

## 6. Primis / Freestar Outstream-Video

Integriert in `app/layout.tsx` (globales Layout, läuft auf jeder Seite):
- 6× `preconnect`-Head-Links (u. a. `a-d.pub.network`, `btloader.com`)
- CLS-Fix-Stylesheet (`cls.css`) gegen Layout-Shift durch das Ad-Slot-Laden
- Freestar-Config-Snippet + `pubfig.min.js`-Loader im `<head>`
- Primis-Slider-Script (`live.primis.tech`, Player-ID `s=122209`) im `<body>`

Zweck: Outstream-Video-Werbung, die nicht an einen festen In-Content-Slot
gebunden ist, sondern als Slider/Sticky-Player erscheint.

⚠️ **Verifikationsstatus**: Script-Präsenz im gerenderten HTML wurde
technisch bestätigt (serverseitiger HTML-Check + Screenshot-Smoke-Test).
**Tatsächliche Ad-Auslieferung/Revenue wurde damit nicht bewiesen** — nach
Übernahme im echten Live-Traffic beobachten, ob Primis-Impressions/Revenue
im Freestar-/Primis-Dashboard ankommen.

## 7. `middleware.ts` — Ad-Fraud-Firewall

Läuft VOR jedem Seiten-Rendering (auch vor ISR-Cache-Hits), blockt bekannte
Bot-Signaturen und Hochrisiko-Länder mit HTTP 204, bevor überhaupt Ad-Tags
ausgeliefert werden. Hintergrund: AdSense hatte das Konto wegen zu vieler
bot-generierter Ad-Impressions gesperrt (v. a. asiatische Botnetze).

- **Gute Bots** (Googlebot, Bingbot, Applebot, GPTBot, ClaudeBot, etc.)
  werden IMMER durchgelassen (SEO-Signal wichtiger als Ad-Fraud-Schutz für
  diese UAs) — Liste in `BOT_PATTERNS`.
- **Hostile Bots** (ByteSpider, Sogou, MJ12bot, generische HTTP-Client-UAs
  wie `python-requests`, `curl/`, `axios`, sowie `HeadlessChrome`/
  `PhantomJS`/`Selenium`) → sofort HTTP 204 — Liste in
  `HOSTILE_BOT_PATTERNS`.
- **Hochrisiko-Länder** (CN, HK, MO, VN, ID, IN, PK, BD, MY, PH, TH, MM, KH,
  LK, NP, NG, EG, IR) bei generischem (nicht als Such-Bot erkanntem)
  Browser-UA → ebenfalls HTTP 204, sofern `cf-ipcountry` (Cloudflare) oder
  `x-vercel-ip-country` (Vercel, Legacy-Fallback) das Land liefert.
- Block-Events werden mit 10 %-Sampling an `/api/track/adfraud-block`
  gemeldet (Kostenoptimierung — im Admin-Dashboard ×10 hochrechnen).

⚠️ **Wichtige Testing-Konsequenz**: Jeder externe Test/Monitoring/Crawler
(curl ohne UA-Override, Standard-Playwright/Puppeteer mit
`HeadlessChrome`-Signatur) wird von dieser Firewall geblockt und bekommt
HTTP 204 statt der echten Seite. Für Tests/Automatisierung immer einen
echten Desktop-Chrome-User-Agent-String mitschicken.

## 8. Bekannte offene Punkte (Ad-Stack)

- **Yieldlab liefert `noBid`** trotz nachweislich korrektem
  ads.txt/sellers.json/Schain/TCF-Consent (siehe Abschnitt 3+5). Wahrscheinlichste
  Ursache: Floor-Price (50 Cent für Slot `18384401`) oder fehlende
  Demand/Kampagnen für diesen Slot auf Vermarkter-Seite — das ist eine
  externe Frage an Advertising Alliance/Yieldlab, kein Punkt, der sich rein
  im eigenen Code weiter lösen lässt. Bei Übernahme: prüfen, ob es
  inzwischen eine Rückmeldung vom Support-Ticket gibt.
- Primis-Auslieferung/Revenue nicht unabhängig vom Script-Tag-Nachweis
  verifiziert (siehe Abschnitt 6).
