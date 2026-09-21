# Pipeline: Live-Bestand und Reparatur, 21. September 2026

## Grenzen der Prüfung

Coolify wurde im angemeldeten lokalen Browser unter
`http://168.119.171.20:8000/` geprüft. Konfiguration und Produktion wurden
zunächst ausschließlich gelesen. Anschließend hat der Betreiber ausdrücklich
einen neuen Dump, eine konsistente physische Sicherung und getrennte
Restore-Tests freigegeben. Keine Migration, kein Git-Push, Deploy, Neustart
der Produktionscontainer, Entpausieren, Secret-Wechsel oder DNS-Eingriff.

## Verifizierte Produktion

| Bereich | Befund |
|---|---|
| Hosting | Ein Hetzner-Host, Coolify 4.3.18, Traefik; eine App und ein Produktions-PostgreSQL-Service |
| Repository/Branch | `afdxbdefold-del/serien`, **`codex/takeover`**, Commit-Auswahl HEAD |
| Laufendes Image | Commit `2d75e26214805a2eb5f02c3ac5f2d6dd39bdd476`; letzter erfolgreicher manueller Deploy am 20.09., 12:42:35 UTC |
| Build | Dockerfile, Basis `/serien-nextjs`, Dockerfile `/Dockerfile`, App-Port 3000 |
| Deploy-Trigger | **Deploy on push aktiv**. Bereits ein Push auf `codex/takeover` kann Produktion verändern. Nicht vor Abnahme pushen. |
| Appname | Enthält noch `:main`; das ist nur ein veralteter Anzeigename, nicht der tatsächliche Git-Branch. |
| Datenbank | `postgres:17-alpine`, effektive Datenbank `postgres`, etwa 361 MB; kein Neon |
| Persistenz | Volume `postgres-data-oun4xzvaum4o58fglnuqks6y` an `/var/lib/postgresql/data`; App selbst hat keine persistenten Mounts |
| Zustand | App und Datenbank gesund, beide RestartCount 0; zusätzliche Coolify-/Redis-/Sentinel-/Proxy-Infrastruktur ebenfalls gesund |
| Worker | Kein zusätzlicher News-Worker- oder Scheduler-Container sichtbar; Automatisierung durch Coolify Tasks |
| Inhalt | 4.360 Artikel: 4.275 veröffentlicht, 75 Entwürfe, 10 archiviert; keine zukünftig datierten Veröffentlichungen/Runs im geprüften Bestand |

## Weshalb derzeit keine automatischen News kommen

Der stündliche News-Task ist aktiviert. Seine tatsächliche letzte geprüfte
Ausführung am 21.09., 07:00:02 UTC antwortete nach ungefähr einer Sekunde:

```json
{"skipped":true,"reason":"pipeline.cron.paused","durationMs":11}
```

Die Datenbank bestätigt die aktive Pause. Das grüne Coolify-Tasklabel
bestätigt nur den erfolgreichen HTTP-Aufruf. Es ist kein Publikationsbeleg.
Der Task nutzt Cron-Bearer-Authentifizierung und Fehlerstatusauswertung,
hat aber nur **300 Sekunden** Laufzeitgrenze. Der neue News-Handler kann einen
bereits begonnenen Artikel länger abschließen; vor Aktivierung müssen
Client-/Task-Timeouts dazu passen. Kein zweiter Scheduler erforderlich.

Im 14-Tage-Fenster waren u.a. 149 P4-Fehler `source-age-check`, 827
Klassifikationsablehnungen und 63 `partial`-Ergebnisse von Pipeline-V2
vorhanden. Klassifikationsablehnungen sind nicht automatisch Fehler: Viele
Quellen enthalten Film-/Promi- oder sonstige unpassende Themen. Der konkrete
P4-Altersfensterwiderspruch ist hingegen im lokalen Code korrigiert.

Die letzten 48 Stunden des aktuellen Appcontainers wurden ausschließlich nach
Fehlerklassen ausgewertet: keine Treffer für Quote/Guthaben, ungültigen
API-Key, Rate-Limit oder unhandled exception; 49 Timeout- und 339
Bildfehler-Mustertreffer. Das sind **Logtreffer, keine Anzahl betroffener
Artikel**. Bei pausierter Pipeline beweist die Abwesenheit eines Providerfehlers
keine funktionierende OpenAI-Anbindung. Bilderfehler bleiben separat zu
triagieren; die neue Prüfung schützt künftige Veröffentlichungen und repariert
nicht rückwirkend den gesamten Altbestand.

Anschließend wurde der konfigurierte direkte OpenAI-Zugang mit einer
minimalen synthetischen Anfrage geprüft: **HTTP 200, erwartete Antwort,
Modell `gpt-5.4-2026-03-05`, 15 Gesamttokens**. Damit funktionieren dieser
Key/Modellzugang und die Abrechnung zum Prüfzeitpunkt. Es wurde kein Artikel
angelegt und kein Schlüssel aus dem Container ausgegeben. Ein zunächst
versuchter CLI-SDK-Import war im gebündelten Standalone-Image nicht vorhanden;
der erfolgreiche Test nutzte daher direkt denselben HTTP-Endpunkt. Das ist
kein Fehlernachweis für das in Next gebündelte SDK und kein Qualitätsnachweis
des neuen Writers.

## Aktive Coolify-Tasks

| Name | Zeitplan in Coolify |
|---|---|
| news | `0 * * * *` |
| youtube | `30 */3 * * *` |
| videos | `45 */3 * * *` |
| releases | `15 */2 * * *` |
| backfill-streaming-series | `0 */2 * * *` |
| downgrade-stale | `30 3 * * *` |
| flixpatrol | `15 4 * * *` |
| tmdb-top10-daily | `15 4 * * *` |
| tmdb-sync | `0 5 * * *` |
| seo | `0 6 * * *` |

Kein Trends-Task sichtbar. Die neuesten UI-Badges waren grün; nur beim
News-Task wurde hier die vollständige Ausführungsausgabe geprüft.
Codewirkungen und ruhende Skripte: `PIPELINE_PATH_INVENTORY.md`.

## Konfiguration und Storage

Nur Namen, niemals Werte erhoben. Anwendungsbezogene Namen im Container:
`BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `DATABASE_URL`, `EMERGENT_LLM_KEY`,
`FACEBOOK_PAGE_TOKEN_EXPIRES_AT`, `GOOGLE_SERVICE_ACCOUNT_JSON`,
`HEADLINE_OPINION_KILLER`, `HEADLINE_REWRITE_LOOP`, `JWT_SECRET`,
`NEXTAUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`, `NODE_ENV`, `OPENAI_API_KEY`,
`TMDB_API_KEY`, `USE_PROCESSED_IMAGES`.

Zusätzlich vorhanden sind die üblichen Laufzeitnamen sowie `COOLIFY_BRANCH`,
`COOLIFY_CONTAINER_NAME`, `COOLIFY_FQDN`, `COOLIFY_RESOURCE_UUID`,
`COOLIFY_URL`, `SOURCE_COMMIT`. Keine `R2_*`-Variablen,
`AUTOMATED_NEWS_PUBLISHING_ENABLED` oder `REVALIDATE_SECRET` vorhanden.
Das Vorhandensein eines Namens bestätigt weder Gültigkeit noch Berechtigung.
Eine R2-Umstellung ist damit nicht produktiv belegt. Vercel-Blob-/Emergent-
Kompatibilität bleibt im Bestand; keine Berechtigungen geändert.

## Sicherung und Wiederherstellung

Die aktuelle Coolify-Backupoberfläche zeigt **Schedules 0, Enabled 0,
Total executions 0**. Auf dem Host war vor dieser Arbeit der jüngste
Sicherungssatz vom 12.09.2026. Dessen historische Offsite-Kopie und damaliger
Restore sind in `TAKEOVER_STATUS.md` dokumentiert, ersetzen aber keinen
aktuellen Sicherungsnachweis.

Nach ausdrücklicher Freigabe am 21.09. wurde ein neuer PostgreSQL-Custom-Dump
und ein `pg_basebackup` im Tar/Gzip-Format inklusive WAL erzeugt.
Kompression und SHA-256-Prüfung bestanden. Der logische Dump wurde mit
`pg_restore --exit-on-error` erfolgreich in einen eigenen PostgreSQL-17-
Container eingespielt: 4.360 Artikel, 44 Tabellen, Statuszahlen wie oben.
Testcontainer: `--network none`, keine veröffentlichten Ports, höchstens
384 MB RAM und 0,5 CPU; Produktionscontainer blieben unberührt.

Auch der physische Restore ist abgeschlossen, `pg_is_in_recovery()` ist
false. Artikel-, Status- und Tabellenzahlen stimmen mit dem logischen
Restore überein. Beide Testcontainer wurden anschließend gestoppt und
bleiben mit den geschützten Testdaten zur Nachvollziehbarkeit erhalten.
Die anschließende Produktionsprüfung bestätigt weiterhin gesund und
RestartCount 0 für App und Datenbank.

Sicherungssatz: `/data/coolify/backups/serien-manual/20260921-onQQ0y/`.
Dump: 76.127.527 Byte; physisches Archiv: 112.299.494 Byte.
`SHA256SUMS` und `RESTORE_VERIFIED.txt` liegen daneben; Verzeichnisrechte
700, Dateien 600. Ein frischer Offsite-Upload und eine automatische
Backupplanung sind noch **nicht** erfolgt. Hostverlust bleibt ohne
aktuelle externe Kopie ein Risiko.

## Lokale Reparaturen und verbleibende Abnahme

Neben der Hauptstrecke aus Commit `3cdadaed` jetzt auch:

- P2-Quelltitel korrekt; gespeicherte Artikel werden nicht erneut generiert.
- Admin-Veröffentlichung prüft den vollständigen Originaltext und das
  gesamte bearbeitete Paket ohne heimliches Neuschreiben. Ein gespeicherter
  Artikel und seine öffentlich bestätigte Anzeige werden getrennt gemeldet.
- P3/P4 respektieren Pause, exklusive Laufrechte, frühe Deduplizierung und
  atomare Verknüpfung eines Entwurfs mit der Quelle. Beide bleiben draft-only.
- Generische Serientrailer werden News auch nicht nachträglich durch den
  Videojob oder den manuellen Reparaturendpunkt angehängt.
- `npm run eval:news` prüft offline sechs synthetische Qualitätsfälle.
  Erst `--live` erlaubt kostenpflichtige Modellaufrufe. Keine Datenbank,
  URL-Abfrage oder Veröffentlichung; Texte nur mit explizitem Outputpfad.
  Manipulierte Gegenproben prüfen Faktenkontrolle in Titel, Vorspann,
  Meta-Text und Artikel. Menschliche Stil-/Quellenabnahme bleibt separat.

Softwaretests sind kein Nachweis hochwertiger Modelltexte. Die getrennte
Abnahme folgt den [OpenAI-Empfehlungen für aufgabenspezifische Evaluationen](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

Validierung des finalen lokalen Reparaturstands: `npm test` einschließlich
aller neuen Fälle und `npm run eval:news` offline bestanden. Next-Compile-
Build bestanden; kein vollständiger datenbankgestützter Produktionsbuild.
Der globale Typecheck enthält weiterhin 148 Alt-Diagnosen, keine in den
geänderten Dateien. Gezieltes Lint der neuen Helfer und übrigen geprüften
Routen bestanden; in Admin-Pipeline und Video-Cron bleiben dieselben
33 Fehler und eine Warnung wie vor der Änderung, keine neu hinzugekommen.

Nächste Reihenfolge: Frisches Offsite-Ziel bestätigen und Sicherung kopieren;
echten, begrenzten Quellen-/Modelllauf getrennt abnehmen; verbleibende
aktive Seiteneffekte prüfen; danach ausdrücklich freigegebenen
`codex/takeover`-Rollout durchführen. Mit einem Artikel beginnen und die
tatsächlich ausgelieferte Seite, Bilddatei, News-Liste und Startseite prüfen.
Erst danach automatische Veröffentlichung und Beobachtung aktivieren.
`main`, Produktionsschema, DNS und bestehende Zugangsdaten bleiben unberührt.
