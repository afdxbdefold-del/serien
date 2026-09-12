# SEO-Rettungsbericht serien.de

Stand: 12. September 2026

Arbeitsbranch: `codex/takeover`

Status: Bestandsaufnahme und lokale Vorbereitung; **nicht deployed**

Dieses Dokument fasst die bestätigten Daten aus Google Search Console (GSC),
der Live-Prüfung, der Inhaltsanalyse und der Coolify-Bestandsaufnahme zusammen.
Es ist ein Arbeitsstand für die geordnete Rettung von serien.de. Es wurden
keine Produktionsdaten verändert, keine Container neu gestartet, keine
Migrationen ausgeführt und weder `main` noch Produktion deployed.

## 1. Kurzurteil

serien.de ist nicht vollständig aus Google entfernt und kann technisch gerettet
werden. Der Sichtbarkeitsverlust ist jedoch erheblich und lässt sich nicht mit
einem einzelnen Sitemap- oder Meta-Tag-Fix beheben. Gleichzeitig wirken drei
Problemgruppen:

1. widersprüchliche technische Indexierungssignale, insbesondere Canonicals,
   `noindex`, Sitemaps, Robots-Regeln und Legacy-URLs;
2. sehr große Mengen schematisch erzeugter, teilweise doppelter oder sachlich
   falsch zugeordneter News;
3. schwache Auffindbarkeit vieler Artikel über die interne Verlinkung sowie
   erhebliche mobile Performance-Probleme.

Google Search Console zeigt keine manuelle Maßnahme und kein erkanntes
Sicherheitsproblem. Das ist wichtig: Es liegt kein bestätigter manueller
Penalty-Fall vor. Die Daten sprechen stattdessen für algorithmische
Qualitäts-/Relevanzverluste und technische Indexierungsprobleme.

Die Rettung muss kontrolliert erfolgen. Eine pauschale Löschung oder
Massen-`noindex`-Aktion wäre ohne URL-Daten aus GSC und ohne geprüfte Sicherung
zu riskant.

## 2. Bestätigte GSC-Daten

### Leistungsentwicklung: letzte drei Monate gegen vorherige drei Monate

| Kennzahl | Letzte 3 Monate | Vorherige 3 Monate | Veränderung |
|---|---:|---:|---:|
| Klicks | 281 | 2.090 | −86,6 % |
| Impressionen | 13.900 | 79.200 | −82,4 % |
| Durchschnittliche Position | 47,4 | 28,4 | um 19 Positionen verschlechtert |

Im kürzeren 28-Tage-Vergleich liegt die Seite auf niedrigem Niveau weitgehend
seitwärts: 76 statt 84 Klicks, 3.590 statt 3.330 Impressionen, 2,1 statt
2,5 Prozent CTR und eine durchschnittliche Position von 50,5 statt 42,1. Der
Einbruch begann damit deutlich vor dem Publikationsstillstand vom 27. August.

Discover weist in beiden Dreimonatszeiträumen 0 Klicks und 0 Impressionen aus.
Google News ist nicht vollständig weg, sank aber auf 50 statt 80 Klicks und
857 statt 1.710 Impressionen. Das stützt den Befund „massiver Vertrauens- und
Rankingverlust“, nicht „vollständige Deindexierung“.

Der Verlust ist auf URL-Ebene sichtbar. Beispielsweise fiel
`/staffel-2-von-unchosen-neue-hinweise-geben-fans-hoffnung` von 642 auf 0
Klicks, `/storage-wars-star-darrell-sheets-mit-67-jahren-gestorben` von 131
auf 0 und `/das-haus-david-staffel-3-kommt-noch-2026` von 121 auf 5. Diese
Seiten gehören deshalb in die erste kleine manuelle Prüfcharge; die Zahlen
allein rechtfertigen noch keine Löschung.

Der deutlichste Tagesbruch ist am **27. April 2026** sichtbar: Nach einem
Stand von 214 Klicks und 2.561 Impressionen wurden nur noch 8 Klicks und 473
Impressionen ausgewiesen. Der Rückgang betrifft damit nicht nur die
Klickrate, sondern vor allem Reichweite und Rankings.

### Seitenindexierung

| Status | URLs |
|---|---:|
| Nicht indexiert | 40.958 |
| Indexiert | 22.934 |

Die GSC-Aufschlüsselung der 40.958 nicht indexierten URLs lautet:

| GSC-Grund | URLs |
|---|---:|
| Gecrawlt – zurzeit nicht indexiert | 17.581 |
| Durch `noindex` ausgeschlossen | 9.638 |
| Duplikat – Google hat eine andere kanonische Seite ausgewählt | 6.308 |
| Durch `robots.txt` blockiert | 1.975 |
| Alternative Seite mit richtigem kanonischen Tag | 1.793 |
| Gefunden – zurzeit nicht indexiert | 1.214 |
| Nicht gefunden (404) | 1.041 |
| Seite mit Weiterleitung | 793 |
| Duplikat – Nutzer hat keine kanonische Seite festgelegt | 348 |
| Soft 404 | 267 |

Zusätzlich meldet GSC **44 indexierte URLs trotz Blockierung durch
`robots.txt`**. Diese 44 gehören nicht zu den 40.958 nicht indexierten URLs.

In GSC sind **6.604 Sitemap-URLs** erfasst. Die hohe Gesamtzahl bekannter URLs
bei gleichzeitig 40.958 ausgeschlossenen URLs zeigt, dass Google wesentlich
mehr URL-Varianten kennt als die aktuell per Sitemap vorgesehenen Seiten.

## 3. Zeitliche Korrelation mit Commit vom 26. April 2026

Der Commit `34994a12b3fcdf4d612ad4fb1af522eb89edfcfa` vom 26. April 2026 änderte
unter anderem die globale Metadata-/Canonical-Konfiguration, fügte global auf
die Startseite zeigende Sprachalternativen ein und ersetzte die bisherige
Sitemap durch einen Index mit mehreren neuen Teil-Sitemaps. Der scharfe
GSC-Rückgang ist ab dem Folgetag, dem 27. April 2026, sichtbar.

Googles offizielles Ranking-Statusarchiv weist für den 27. April kein eigenes
Update oder Ranking-Incident aus. Das dort dokumentierte März-Core-Update
begann am 27. März und dauerte gut zwölf Tage; das nächste Core-Update startete
erst am 21. Mai. Der Tagesbruch darf deshalb nicht ohne weitere Belege einem
bestätigten Google-Update zugeschrieben werden.

Das ist eine **auffällige zeitliche Korrelation, aber kein Beweis für eine
alleinige oder direkte Ursache**. Der Commit ist ein priorisierter
Untersuchungspunkt, weil seine Änderungen fachlich zu den großen
GSC-Ausschlussgruppen „Duplikat/Kanonical“, `noindex` und Robots passen. Parallel
waren jedoch bereits massenhaft automatisierte Inhalte, URL-Dubletten und
Qualitätsprobleme vorhanden. Eine monokausale Bewertung wäre daher nicht
belastbar.

Der Einbruch war kein Publikationsausfall: Die Produktionsdatenbank enthält für
den 26., 27., 28. und 29. April jeweils 43, 48, 43 und 64 veröffentlichte
Artikel. Die Seitenausgabe lief also weiter, während die Google-Reichweite
abriss.

## 4. Live festgestellte technische SEO-Probleme

- Die Serien-Sitemap enthielt 2.308 URLs: 1.154 Basis-Slugs und 1.154
  Kind-/Detail-URLs. Eine Stichprobe von 131 URLs antwortete zwar mit HTTP 200
  und selbstreferenzierendem Canonical, zugleich aber mit `noindex`. Die
  Sitemap forderte Google damit zum Crawlen von Seiten auf, die nicht indexiert
  werden sollten.
- Auch vier statische Sitemap-URLs waren mit `noindex` versehen.
- Die News-Übersicht besitzt keine wirksame öffentliche Pagination:
  `?page=2` und selbst sehr hohe Seitennummern liefern dieselben 30 Einträge.
- Von 4.232 geprüften Artikel-URLs waren nur 118 direkt und lediglich 268
  innerhalb von zwei Klicks über die untersuchten öffentlichen Seiten
  erreichbar. Der größte Teil des Archivs ist für Crawler intern kaum
  erschlossen.
- Die Serien-Pagination überschneidet sich stark: Seite 1 und 2 teilen je nach
  Sortierung 40 bis 43 von 50 Einträgen. Pagination-URLs kanonisieren zudem auf
  die Root-Seite; sehr hohe Seiten liefern HTTP 200 mit leerem Inhalt.
- Alte `?p=`-URLs liefern die Startseite mit HTTP 200 und Startseiten-Canonical
  statt eines gezielten Redirects oder eines eindeutigen 404/410. Das erzeugt
  Soft-404- und Duplikatsignale und verliert vorhandene URL-Signale.
- Die globale `hreflang`-Ausgabe verwies auf jeder Seite auf die Startseite und
  widersprach damit den individuellen URLs.
- Normale Google- und Bing-Crawler erhielten HTTP 200. AdsBot- und
  Lighthouse-Kennungen wurden durch die Middleware dagegen mit HTTP 204
  beantwortet. Das ist kein vollständiger Google-Block, erschwert aber
  Werbe-/Qualitätsprüfungen und Diagnose.
- Ein mobiler Lighthouse-Lauf lag bei Performance 37, First Contentful Paint
  5,2 Sekunden, Largest Contentful Paint 26,4 Sekunden und Total Blocking Time
  1.260 Millisekunden. Von 140 Requests und 3,16 MiB entfielen 96 Requests und
  2,37 MiB auf Drittanbieter; die Werbeintegration ist der größte einzelne
  Belastungsblock.
- Die GSC-Felddaten zeigen gleichzeitig je 111 als „gut“ eingestufte mobile
  und Desktop-URLs und keine als schlecht eingestufte Gruppe. Der schlechte
  Labortest bleibt ein reales Risiko, ist aber damit kein belegter alleiniger
  Auslöser des Google-Absturzes.
- In einer Stichprobe von 144 Artikeln war das Article-Schema grundsätzlich
  vorhanden. Bei 110 von 144 fehlte jedoch `dateModified`; bei mindestens einem
  aktuellen Artikel stimmten sichtbares Hero-Bild und Bildmetadaten nicht
  überein.

Die Live-Seite ist damit nicht pauschal deindexiert. Mindestens ein neuerer
Artikel war über Google News auffindbar. Das ändert nichts an den massiven
systemischen Problemen.

## 5. Inhalts- und Vertrauensbefunde

Die API-/Datenanalyse ergab 4.271 veröffentlichte Artikel. Davon stammen 3.355
aus 2026; allein von April bis Juni wurden 2.915 Artikel veröffentlicht, an
einzelnen Tagen bis zu 80. 3.231 Artikel tragen den Pipeline-v2-Fingerprint,
entsprechend 75,7 % des Gesamtbestands und 96,3 % der 2026er Artikel.
Eine zusätzliche reine Leseabfrage der Produktionsdatenbank bestätigte 4.271
veröffentlichte, 11 als Entwurf und 10 als archiviert markierte Artikel. Der
letzte veröffentlichte Datensatz lag am 5. September 2026 um 16:11 Uhr
(Europe/Berlin).

Weitere bestätigte Befunde:

- Die automatische Veröffentlichung endete am 27. August 2026. Danach wurden
  bis zum Prüfzeitpunkt nur zwei manuelle Artikel am 1. und 5. September
  veröffentlicht. Der Publikationsstillstand erklärt nicht den bereits seit
  April bestehenden Sichtbarkeitsbruch, hat aber weiteres unkontrolliertes
  Wachstum vorläufig begrenzt.
- 52 sehr ähnliche Titelpaare betreffen 82 Artikel; zusätzlich wurden
  identische beziehungsweise weitgehend identische Textcluster bestätigt.
- Bei 371 von 4.271 Artikeln ist die zugeordnete Serienentität wahrscheinlich
  falsch. Besonders auffällig sind alte/UUID-basierte Datensätze. Beispiele
  betreffen unter anderem „Wednesday“, „Your Honor“ und „Post Mortem“.
- In einer Stichprobe von 94 sichtbaren „Quelle“-Angaben war keine einzige
  Quelle klickbar; angezeigt wurde regelmäßig der Sender oder Streamingdienst
  der zugeordneten Serie statt der journalistischen Ursprungsquelle.
- Es wurden konkrete sachlich riskante Artikel gefunden, darunter falsche
  Zuordnungen von Personen-/Branchenmeldungen zu unpassenden Serien sowie eine
  unbelegte Meldung zu einer sechsten „Fargo“-Staffel in Texas.
- 874 ältere Archivartikel erhielten `lastmod`-Zeitpunkte mehr als ein Jahr
  nach der ursprünglichen Veröffentlichung; 839 davon konzentrieren sich auf
  den 20. März 2026. Das wirkt wie ein technischer Backfill und nicht wie eine
  echte redaktionelle Aktualisierung.
- Die Autorenverteilung der 2026er Artikel wirkt gleichmäßig zufällig statt
  redaktionell verantwortet. Das schwächt nachvollziehbare Autorenschaft.
- Bilder fehlen nicht flächendeckend, sind aber häufig wiederverwendet: 46,3 %
  der Bild-URLs kommen mehrfach vor. Die Herkunftsangabe stimmt bei einzelnen
  generierten beziehungsweise migrierten Bildern nicht mit der tatsächlichen
  Provenienz überein.

Diese Befunde sind ein akutes Qualitätsrisiko. Technische Reparaturen können
Google wieder konsistentere Signale geben, aber Vertrauen und Rankings werden
nur zurückkehren, wenn zugleich der veröffentlichte Bestand fachlich bereinigt
und die automatische Pipeline redaktionell kontrolliert wird.

## 6. Tatsächliche Produktionsarchitektur

| Bereich | Bestätigter Live-Stand |
|---|---|
| Hosting | Hetzner-Server, verwaltet über Coolify |
| Coolify-Zugang | `http://168.119.171.20:8000/`; Port 8000 spricht nur HTTP |
| Anwendung | eine laufende Next.js-Anwendung, Basisverzeichnis `/serien-nextjs`, Dockerfile `/Dockerfile`, Port 3000 |
| Laufzustand | Anwendung und PostgreSQL-Container liefen beim Audit `healthy`; beide hatten 0 Neustarts. Der App-Healthcheck prüft allerdings nur den Next.js-Prozess, nicht Datenbank, Storage oder News-Pipeline. |
| Produktionsbranch | `main`, Commit `625bebd85fc95a7680cc5e6c64120e3b57361dcd` zum Prüfzeitpunkt |
| Deployment | `Deploy on push (webhooks)` aktiv; ein Push auf `main` kann unmittelbar Produktion deployen |
| Arbeitsbranch | ausschließlich `codex/takeover`; nicht als Produktivbranch konfiguriert |
| Datenbank | separater laufender Coolify-Service mit `postgres:17-alpine`; effektiver Datenbankname `postgres` |
| Persistenz | Volume `postgres-data-oun4xzvaum4o58fglnuqks6y` an `/var/lib/postgresql/data`; die App selbst hat kein persistentes Volume |
| Automatisierung | Coolify Scheduled Tasks rufen `/api/cron/*` auf; kein zusätzlicher Worker-/Supervisor-Container |
| Bekannter Cron-Stand | zehn aktive Tasks waren inventarisiert; `downgrade-stale` und `videos` scheiterten wiederholt mit HTTP 401, `trends` war nicht angelegt |
| Backups | kein Coolify-Datenbank-Backupplan und dort null Backup-Ausführungen. Auf dem Host liegen sechs manuelle Sicherungssätze vom 1., 5. und 12. September 2026. Der neue Satz `20260912T112834Z` enthält einen 67-MB-Custom-Dump und ein 98-MB-Basebackup mit enthaltenem WAL. Gzip-, Inhalts- und SHA-256-Prüfung bestanden. Sowohl der logische Dump als auch das physische Basebackup wurden in getrennten, netzwerkisolierten PostgreSQL-17-Umgebungen erfolgreich gestartet; beide lieferten exakt 4.292 Artikel (4.271 veröffentlicht, 11 Entwürfe, 10 archiviert) und 44 öffentliche Tabellen. Vier Dateien wurden zusätzlich in den privaten R2-Pfad `publisher-os-backups/serien/20260912T112834Z/` kopiert. R2 zeigt 102,35 MB für das Basebackup und 69,33 MB für den Dump, passend zu den binären Servergrößen. Der verwendete, auf diesen Bucket begrenzte Schreib-Token verfällt nach 24 Stunden und wurde aus der Serversitzung entfernt. |
| Storage | Cloudflare R2 ist vorhanden und erreichbar; der Code und `.env.example` enthalten die R2-Anbindung. Im verifizierten Live-App-Environment waren jedoch keine R2-Variablennamen gesetzt. Vercel Blob und ein Emergent-Altpfad sind dort weiterhin vorhanden. |
| Live-Variablennamen | `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `DATABASE_URL`, `EMERGENT_LLM_KEY`, `FACEBOOK_PAGE_TOKEN_EXPIRES_AT`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `JWT_SECRET`, `NEXT_PUBLIC_BASE_URL`, `OPENAI_API_KEY`, `TMDB_API_KEY`. Werte wurden nicht ausgegeben. |

Secret-Werte wurden weder ausgelesen noch in diesem Dokument festgehalten.

## 7. Lokal vorbereitet, aber nicht live

Auf `codex/takeover` sind erste Sicherungsmaßnahmen umgesetzt und getestet.
Der geprüfte Stand `45c03935` ist nach `origin/codex/takeover` gepusht, aber
nicht deployed:

- globale, auf die Startseite zeigende `hreflang`-Ausgabe entfernt;
- Sitemap-Index bereinigt und die Serien-Sitemap aus der aktiven Einreichung
  genommen, solange deren Ziele `noindex` sind;
- statische `noindex`-Ziele aus der Sitemap entfernt;
- legitime Google-Werbecrawler vor der pauschalen `Adsbot`-Sperre erkannt;
  `Chrome-Lighthouse` erhält ausdrücklich keinen allgemeinen
  Vertrauens-/Firewall-Bypass;
- das News-Archiv um echte serverseitige, selbstkanonische Archivseiten mit
  sichtbaren Vor-/Zurück-Links erweitert; der JavaScript-„Mehr laden“-Knopf
  bleibt nur als zusätzliche Nutzerfunktion bestehen;
- Serienlisten um eine eindeutige sekundäre Sortierung ergänzt und leere,
  überhöhte Seitennummern auf 404 statt leeres HTTP 200 umgestellt;
- die unvollständige Legacy-Route `/streamer/*` per permanentem Redirect auf
  die gepflegte, tatsächlich gefilterte Route `/serien/streamer/*`
  konsolidiert;
- die sichtbare Artikelattribution korrigiert: Eine vorhandene gespeicherte
  Ursprungs-URL wird als klickbare Quelle angezeigt; ein Streamingdienst ohne
  Ursprungs-URL wird nur noch als Plattform bezeichnet;
- Artikel-Hero und Social-/Schema-Bildauswahl auf dieselbe primäre Bild-URL
  ausgerichtet;
- direkte Pipeline-Publikation standardmäßig deaktiviert: Auch ein manueller
  Generatorstart erzeugt zunächst einen Review-Entwurf; nur der explizite
  Produktionsschalter `AUTOMATED_NEWS_PUBLISHING_ENABLED=true` hebt diesen
  Hold auf;
- Datums-, Qualitäts- und Fact-Safety-Gates auf Fail-Closed umgestellt: bei
  fehlender belastbarer Quelle oder Prüfungsfehler bleibt ein Artikel Entwurf;
- zufällige Autorenwahl für automatisierte News entfernt;
- gewöhnliche News aus dem Aufruf der Google Indexing API entfernt;
- einen geschützten Admin-Reviewweg ergänzt: Titel, Text, Quelle,
  Quellzeitpunkt und Hero-Bild können geprüft werden; veröffentlicht wird nur
  nach erneut bestandenen Qualitäts-, Fakten-, Freshness-, HTML- und
  Bild-Gates. Gleichzeitige Änderungen werden über den Versionsstand erkannt;
- HTML aus der Reviewstrecke wird vor dem Speichern strikt gegen eine
  Allowlist geprüft; dynamische Artikel-, Breadcrumb-, FAQ- und
  Newsarchiv-JSON-LD-Daten werden script-sicher serialisiert;
- den News-Cron so erweitert, dass vollständige Quellfehler und – bei bewusst
  aktivierter Automatik – mehr als 36 Stunden ohne Veröffentlichung nicht mehr
  als grüner Erfolg erscheinen;
- Tests für Publikationsfreigabe, HTML-Sicherheit, JSON-LD und strukturierte
  Quelldaten ergänzt.

Die vollständige vorhandene `npm test`-Suite einschließlich der neuen
Publication-, Datums-, JSON-LD- und HTML-Sicherheitstests besteht. Der gezielte
ESLint-Lauf für die neue Admin-Review-Route und -Seite sowie die neuen
Sicherheits-, Newsarchiv-, Pagination- und Cron-Module ist grün. Die bereits
großen Admin-Pipeline-Dateien behalten ihre vorhandene Lint-Schuld. Der
Next.js-Produktionscode kompiliert; die lokale
Buildausführung stoppt anschließend erwartungsgemäß bei der statischen
Seitengenerierung, weil in der sicheren Prüfumgebung keine `DATABASE_URL`
gesetzt ist. Produktionszugangsdaten wurden dafür bewusst nicht verwendet.

Der vollständige TypeScript-Lauf bleibt wegen bereits vorhandener Fehler in
`scripts/pipeline-v2.ts` rot. In den neuen Admin-, P3-, P4-,
HTML-Sicherheits-, Newsarchiv- und Paginationsteilen wurden keine zusätzlichen
TypeScript-Fehler festgestellt. Ein unabhängiger Sicherheitsreview fand im
neuen Admin-Draft-Workflow keine verbleibenden Release-Blocker. Diese
Teilnachweise dürfen trotzdem nicht mit einem bereits live validierten
Gesamtzustand verwechselt werden.

## 8. Priorisierte Rettungsreihenfolge

### Stufe 0 – Produktionssicherheit und Messbasis

1. Der aktuelle PostgreSQL-Dump und das physische Basebackup sind erstellt,
   auf demselben Host verifiziert und zusätzlich in einen privaten R2-Pfad
   kopiert.
2. Integritätsprüfung sowie logischer und physischer Restore-Test sind
   erfolgreich abgeschlossen.
3. GSC-Leistungs- und Seitenexporte sichern, damit jede spätere Wirkung gegen
   eine unveränderte Ausgangsbasis gemessen werden kann.
4. Automatische Publikation bis zur redaktionellen Freigabe geschlossen
   halten. Keine Prisma-Migration gegen Produktion ausführen.

### Stufe 1 – Kleine technische Reparatur mit Rollback

1. Die lokale Canonical-/`hreflang`-/Sitemap-/Bot-Korrektur fachlich reviewen.
2. Nach ausdrücklicher Freigabe über den vorgesehenen Releaseweg deployen;
   `main` nicht beiläufig pushen, weil der Webhook sofort auslösen kann.
3. Nach dem Deploy repräsentative URL-Gruppen live prüfen: Artikel, Serie,
   Pagination, Legacy-URL, Sitemap und News-Sitemap.
4. Erst nach erfolgreicher Live-Prüfung die bereinigte Sitemap in GSC neu
   einreichen. Keine pauschalen Indexierungsanträge für normale News senden.

### Stufe 2 – URL-Inventar und gezielte Bereinigung

1. GSC-URL-Exporte mit Datenbank, Sitemaps, internen Links und Serverstatus
   zusammenführen.
2. URLs nach klaren Klassen behandeln: erhaltenswert, zusammenzuführen,
   korrekt weiterzuleiten, zu überarbeiten oder eindeutig zu entfernen.
3. Zuerst kleine Batches von 25 bis 50 URLs bearbeiten und Wirkung prüfen.
   Keine Massenlöschung und kein flächiges `noindex` ohne Datenabgleich.
4. Legacy-`?p=`-Signale auf die jeweils echte Zielseite übertragen; nur ohne
   belastbares Ziel 404/410 verwenden.
5. Echte Pagination und stabile Sortierung herstellen; leere hohe Seiten nicht
   mit HTTP 200 ausliefern.

### Stufe 3 – Inhaltliche Vertrauensreparatur

1. Nachweislich falsche Serienzuordnungen und sachlich riskante Artikel zuerst
   korrigieren oder aus der Veröffentlichung nehmen.
2. Doppelte Artikel zu einer kanonischen, redaktionell geprüften Fassung
   konsolidieren.
3. Echte, klickbare Ursprungsquellen mit Datum und korrekter Provenienz
   anzeigen.
4. Autorenschaft auf eine nachvollziehbare Redaktion und wenige echte Profile
   konsolidieren; keine zufällige Persona-Zuweisung.
5. `lastmod` nur bei substanzieller inhaltlicher Aktualisierung ändern.
6. Automatische News erst wieder schrittweise freigeben, wenn Quelle, Entität,
   Fakten, Dublettenprüfung, Bildrechte/-herkunft und redaktionelle Abnahme
   nachweisbar funktionieren.

### Stufe 4 – Crawlbarkeit und Performance

1. Ein vollständiges, paginiertes News-Archiv und kontextuelle interne Links
   zu relevanten älteren Artikeln aufbauen.
2. Verwaiste Artikel priorisiert nach vorhandenen Impressionen/Klicks wieder
   erschließen.
3. Werbeskripte verzögert und bedarfsgerecht laden; Drittanbieter-Requests und
   Main-Thread-Blockierung deutlich reduzieren.
4. Mobile Core-Web-Vitals je Seitentyp messen und Regressionen zum
   Release-Gate machen.

### Stufe 5 – Beobachtung

Wöchentlich mindestens folgende Werte festhalten:

- Klicks, Impressionen und durchschnittliche Position;
- indexierte URLs und alle GSC-Ausschlussgründe;
- Anteil „Gecrawlt – zurzeit nicht indexiert“;
- Crawls und Indexierung pro bereinigtem URL-Batch;
- letzter erfolgreich veröffentlichter, redaktionell freigegebener Artikel;
- Cron-Fehler, Container-Neustarts und Anwendungsfehler;
- mobile LCP-, INP-/TBT- und Request-Werte nach Seitentyp.

Erste technische Veränderungen können innerhalb weniger Tage sichtbar werden.
Eine belastbare algorithmische Neubewertung eines großen, problematischen
Archivs ist jedoch eher über Wochen bis Monate zu erwarten. Erfolg bedeutet
nicht kurzfristig „mehr URLs im Index“, sondern weniger widersprüchliche URLs,
mehr indexierte Qualitätsseiten und eine nachhaltige Erholung von Impressionen,
Positionen und Klicks.

## 9. Offizielle Google-Referenzen

- [Google Search Status Dashboard – Ranking history](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)
- [Spamrichtlinien für die Google Websuche](https://developers.google.com/search/docs/essentials/spam-policies)
- [Kanonische URLs zusammenführen](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Sitemap erstellen und einreichen](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## 10. Freigabegrenzen

Ohne ausdrückliche Freigabe bleiben untersagt:

- Änderungen, Merge oder Deployment von `main`;
- Produktionsdeploys, Neustarts und Cron-Auslösungen;
- Prisma-Migrationen oder sonstige Schemaänderungen gegen Produktion;
- Massenänderungen an Artikeln, Canonicals, Redirects oder Indexierungsstatus;
- Secret-Rotation sowie Änderungen an DNS, Cloudflare, R2 oder Coolify-Zugängen.

Backup, Offsite-Kopie und Restore-Test sind damit verifiziert. Die nächste
sichere Entscheidung ist die ausdrücklich freizugebende Änderung von `main`
mit anschließendem kontrolliertem Produktivdeploy der kleinen technischen
Stufe 1.
