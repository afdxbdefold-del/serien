# Werbung ausschließlich auf Desktop

Stand 25. September 2026: auf `codex/takeover` implementiert, noch nicht deployt.
Keine Produktionskonfiguration, Datenbank oder Werbepartner-Kennung geändert.

## Einheitliche Regel

Werbung darf erst nach einer positiven Geräteprüfung im Browser starten:

- mindestens 1024 CSS-Pixel Viewportbreite;
- primärer feiner Zeiger mit Hover (üblicherweise Maus/Trackpad);
- keine erkennbaren Mobil-/Tablet-Geräte, auch bei größerem Viewport;
- iPadOS mit Mac-User-Agent und Touch wird zusätzlich ausgeschlossen;
- fehlende/fehlerhafte Browserprüfung und Server-Rendering bleiben werbefrei.

Die gemeinsame Policy liegt in `public/desktop-ads-policy.js` und wird sowohl
vom Anwendungsbundle als auch von der eigenständigen Ad-Testseite verwendet.
Windows-Touch-Laptops mit primärer Maus werden nicht allein wegen Touch gesperrt.

## Abgedeckte Ladewege

- TMN-Billboard, Megasky, Corner Video, Footer, Seitenleiste und Megabanner.
- Datenbank-Slots, Infeed und Interstitial; keine Auswahl von Mobile-Inventar.
- Global hinterlegte Script-/iframe-/HTML-Tags: keine aktiven Roh-Tags im
  Server-HTML, erst gerätegeprüfte Client-Aktivierung. Vorhandener Botfilter bleibt.
- Globale Freestar/Primis- und Ezoic-Loader einschließlich Werbe-Stylesheets und
  Preconnects. Auch das zum Ezoic-Paket gehörende Analytics-Skript ist Desktop-only.
- Bestehender InMobi-CMP-Tag vor den Desktop-Werbe-SDKs; kein Mobil-Ausnahmeweg
  für Ad-Testseiten. Keine Änderung an den eigentlichen Consent-Regeln.
- Alle vier React-Ad-Testseiten, die eigenständige HTML-Testseite sowie derzeit
  unreferenzierte ältere Anzeigenkomponenten.

Auf ausgeschlossenen Geräten werden Anzeigenkomponenten gar nicht gemountet:
kein verstecktes Laden, keine Slot-Konfigurationsanfrage und keine leeren
Infeed-Anzeigenkarten. Nach asynchronen Vorgängen erfolgt eine erneute Prüfung.
Beim Wechsel unter die Grenze werden eigene Anzeigencontainer entfernt und
ausstehende eigene Auktionen/Callbacks gesperrt.

Unverändert: `ads.txt`, Kennungen/Formate und Desktop-Platzierungen, das deaktivierte
Recommended-Content-Widget, redaktioneller Inhalt, GA4 und Matomo. Keine
Consent-Konformitätsaussage für die unveränderten Analytics-Einbindungen.

## Tests und Grenzen

- Beide untenstehenden Tests bestanden. Echte Browserprüfung: neun Fälle,
  Desktop bei 1024/1440 Pixeln mit allen erwarteten lokal simulierten Providern;
  schmaler Desktop, Telefon, Android-Tablet, großes iPad mit Maus, mobiles
  Client-Hint sowie fehlende/werfende Media-API jeweils null Werbe- und
  Slot-Anfragen. SSR bleibt leer, redaktioneller Inhalt sichtbar.
- `npm run test:ads`: Geräte-Matrix, SSR, identische Standalone-Policy,
  HTML-Injection-Sperre, keine mobilen Slot-Requests, Cache- und Response-Rennen.
- `npm run test:ads:browser`: isolierte echte React-Komponenten in einem separaten
  Headless-Browser. Sämtliche Anfragen werden lokal beantwortet, DNS ist gesperrt;
  keine echten Werbeaufrufe, Modellläufe oder Datenbankzugriffe.
- Die Tests messen Geräteauslieferung und Loader-Verhalten, keine tatsächliche
  Anzeigenfüllrate, Einnahmen oder Performance echter Fremd-SDKs.
- Geräteerkennung ist eine konservative Heuristik, kein physischer Gerätenachweis.
- Bereits auf einem erlaubten Desktop gestartete Fremd-SDKs können nicht durch
  Entfernen eines Script-Tags zuverlässig rückwirkend entladen werden. Die Sperre
  verhindert deren initiales Laden auf Mobilgeräten/Tablets; für einen vollständig
  frischen Netzwerknachweis immer eine neue Browserseite verwenden.
- Historische Artikel-HTML-Einbettungen und Werbeinhalte innerhalb fremder
  redaktioneller Video-Embeds wurden nicht anhand der Produktionsdaten verändert.

## Vor dem Live-Rollout

1. Aktuelle DB-/Volume-Sicherung und Wiederherstellbarkeit erneut verifizieren.
2. Serverplatz lesend prüfen. Beim vorherigen Rollout waren am Ende nur etwa
   4,3 GiB frei; kein weiterer Build ohne ausreichende Reserve. Keine pauschale
   Löschung von Backups, Docker-Volumes oder Images.
3. Kontrolliert ausschließlich `codex/takeover` deployen, `main` unverändert.
4. Öffentlich auf echten Mobil-/Tablet-/Desktop-Konfigurationen Netzwerk und
   Darstellung prüfen; Desktop-Consent und vorhandene global hinterlegte Tags
   auf Kompatibilität kontrollieren. Einnahmeneffekt erst anhand echter Messwerte
   beurteilen.
