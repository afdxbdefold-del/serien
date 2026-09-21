# Übernahmestatus serien.de

Stand: 21. September 2026

Arbeitsbranch: `codex/takeover`

Ausgangspunkt: `main` bei `625bebd85fc95a7680cc5e6c64120e3b57361dcd`

Dieses Dokument beschreibt den verifizierten Ist-Stand der technischen
Übernahme. Es ersetzt keine Live-Prüfung der Produktionssysteme.

## Aktueller Live-Nachtrag (21. September 2026)

Dieser Nachtrag dokumentiert den erfolgreichen Rollout um **14:28 UTC** und
die danach erfolgten Prüfungen. Er hat Vorrang vor den früheren Snapshots in
`PIPELINE_LIVE_AUDIT_2026-09-21.md` und unten. Build-Ursache und Schutzmaßnahmen:
`BUILD_INCIDENT_2026-09-21.md` und `BOUNDED_BUILD_RUNBOOK.md`.

- Produktion läuft auf **`codex/takeover`**, Commit
  `cbd216ffb3868ca91a986a601984a46db0f71961`. Coolify-Deployment
  `bqwzdqac1fw9xfyw5ve38vr7` war um 14:28 UTC erfolgreich. Neuer Container
  `i8e996hq5t8moyf9fw8p0pbs-142026647632`: gesund, Neustartzähler 0,
  `OOMKilled=false`. Der App-Anzeigename mit `main` ist veraltet.
  **Auto-Deploy bleibt auf „Manual deployments only“; nicht wieder aktivieren,
  ohne den Build-Schutz und den aktuellen Hostzustand zu prüfen.**
- PostgreSQL 17 auf Hetzner/Coolify und dasselbe persistente Volume erneut
  bestätigt; effektive Datenbank `postgres`. Kein Neon.
- Die Coolify-Tasks **News, YouTube und Videos bleiben deaktiviert**. Die
  globale Pipeline-Pause wird nur für begleitete Einzeltests kontrolliert
  behandelt; ihr momentaner Wert ist vor jedem Test erneut zu lesen.
  **Unbeaufsichtigte News-Automatik ist noch nicht abgenommen oder aktiviert.**
- Weiterhin kein automatischer Backupplan in Coolify. Nach ausdrücklicher
  Betreiberfreigabe neue logische und physische Backups am 21. September
  erstellt, Kompression/Prüfsummen geprüft und **beide getrennt erfolgreich
  wiederhergestellt**: 4.360 Artikel (4.275 veröffentlicht, 75 Entwürfe,
  10 archiviert), 44 Tabellen. Keine Produktionsdaten zurückgespielt.
  Beide Backup-Prüfsummen wurden um 14:30 UTC erneut bestätigt. Die frische
  externe Kopie ist noch offen; Details im Live-Audit.
- Astra-Code (`gpt-6-astra` / `low`), verpflichtende Deutschlandrelevanz und
  Quellen-/Bildprüfung sind ausgerollt. Sieben synthetische Modellfälle hatten
  zuvor bestanden. Das ersetzt keine echte Veröffentlichungsabnahme: Ein
  beide begleiteten Quellenläufe scheiterten vor der Generierung. Ursache:
  Netflix-HTML von rund 3,6 MB überschritt die alte 2-MiB-Grenze. Ein
  Abbruchereignis maskierte dies als Timeout. Der Folgefix begrenzt HTML auf
  8 MiB und bewahrt genaue Fehlerkategorien; Text-/Quellenqualität bleibt
  unverändert streng. Automatik-Abnahme steht weiterhin aus.
- Sichtprüfung: Startseiten-Karussell mit fünf geladenen Bildern, `/news` mit
  HTTP 200 und HTML sowie vier geprüfte Sitemaps mit HTTP 200 und XML.
  PostgreSQL blieb unverändert; keine Schema-Migration und keine Änderung an
  `main`.
- Build-Schutz: eigener Builder mit 1024 MiB RAM, maximal 2048 MiB Swap und
  0,75 CPU; tatsächliche Kernel-Grenzen geprüft. Zusätzlich 4 GiB Host-Swap,
  root/0600, **nicht über einen Neustart persistent aktiviert**. Vollständiger
  Build einschließlich 164 statischer Seiten und Image-Import bestanden.
  Builder und Sicherheitswächter sind nach Abschluss gestoppt.

## Historischer Produktionssnapshot (12. September 2026)

- Produktion läuft auf einem Hetzner-Server über Coolify. Die lokale
  Management-Oberfläche ist unter `http://168.119.171.20:8000/` erreichbar.
  Port 8000 spricht ausschließlich HTTP; die Adresse nicht automatisch auf
  HTTPS umstellen. Zugangsdaten und interne Verbindungswerte bleiben im
  privaten Betriebsinventar.
- Die Anwendung wird aus diesem Repository, Branch `main`, gebaut. Zum
  Prüfzeitpunkt lief Commit `625bebd85fc95a7680cc5e6c64120e3b57361dcd`
  mit Basisverzeichnis `/serien-nextjs` und `serien-nextjs/Dockerfile`.
  `Deploy on push (webhooks)` ist aktiv; ein Push nach `main` kann daher
  unmittelbar einen Produktivdeploy auslösen. `codex/takeover` ist nicht als
  Produktivbranch konfiguriert.
- PostgreSQL läuft als separater Coolify-Service auf demselben Host mit dem
  Image `postgres:17-alpine`. Das Feld für die initiale Datenbank ist leer;
  dadurch greift der PostgreSQL-Standard und der effektive Datenbankname
  entspricht dem Benutzernamen `postgres`. Neon wird nicht verwendet.
- Die Datenbank persistiert im benannten Volume
  `postgres-data-oun4xzvaum4o58fglnuqks6y`, eingehängt unter
  `/var/lib/postgresql/data`.
- In Coolify sind kein Datenbank-Backupplan und kein S3-Backupziel
  konfiguriert; die Oberfläche zeigt null Backup-Ausführungen. Auf dem Host
  liegen jedoch sechs manuell erstellte Sicherungssätze vom 1., 5. und 12.
  September 2026 unter `/data/coolify/backups/serien-manual/`. Der aktuelle
  Satz `20260912T112834Z` enthält einen 67-MB-Custom-Dump und ein 98-MB-
  Basebackup mit enthaltenem WAL; Gzip-, Inhalts- und SHA-256-Prüfung
  bestanden. Am 12. September wurden sowohl der logische Dump als auch das
  physische Basebackup in getrennten, netzwerkisolierten PostgreSQL-17-
  Umgebungen erfolgreich wiederhergestellt. Beide lieferten exakt 4.292
  Artikel (4.271 veröffentlicht, 11 Entwürfe, 10 archiviert) und 44
  öffentliche Tabellen. Vier Dateien dieses Satzes wurden zusätzlich in den
  privaten R2-Pfad `publisher-os-backups/serien/20260912T112834Z/` kopiert.
  R2 zeigt 102,35 MB für das Basebackup und 69,33 MB für den Dump, passend zu
  den binären Servergrößen. Der bucketspezifische Schreib-Token verfällt nach
  24 Stunden und wurde aus der Serversitzung entfernt. Eine automatische
  Coolify-Backupplanung bleibt offen.
- Der vorhandene Cloudflare-R2-Bucket ist erreichbar; ein versioniertes
  Artikelbild wurde manuell hochgeladen und öffentlich verifiziert. Im
  Live-App-Environment fehlen weiterhin die R2-Variablennamen, sodass der
  automatische Schreibpfad nicht produktiv bestätigt ist. Vercel-Blob-,
  Emergent- und lokale Medienpfade bleiben parallel aktiv.
- Das Image startet nur den Next.js-Server. Es gibt keinen zusätzlichen
  Worker- oder Supervisor-Container; zeitgesteuerte Aufrufe laufen über
  Coolify Scheduled Tasks gegen `/api/cron/*`.

## Bereits erledigt

- Den Sicherungssatz vom 12. September logisch und physisch isoliert
  wiederhergestellt und zusätzlich in einen privaten R2-Pfad kopiert. Der
  neuere Satz vom 21. September ist ebenfalls wiederherstellbar geprüft;
  dessen Offsite-Kopie steht noch aus.

- Paketauflösung mit `package-lock.json` reproduzierbar gemacht; Node- und
  npm-Anforderungen sowie Standardbefehle für Test, Lint und Typecheck ergänzt.
- Veraltete Einstiegsdokumente auf den tatsächlichen Next.js-/PostgreSQL-Stack
  korrigiert und `.env.example` vervollständigt.
- Alle `/api/admin/*`-Routen zentral mit signaturgeprüftem Admin-JWT geschützt;
  besonders teure Debug-/QA-Routen sind ebenfalls Admin-only.
- Cron-Authentifizierung vereinheitlicht: ausschließlich
  `Authorization: Bearer <CRON_SECRET>`, ohne Query-Parameter oder
  fest codierte Ersatzschlüssel; fehlende Konfiguration schlägt geschlossen fehl.
- Fest codierte produktionsähnliche Schlüssel aus dem aktuellen Quellstand
  entfernt. `vercel.env` und die versehentlich versionierte `.gitconfig` werden
  nicht weiter verfolgt.
- Push-, Auth-, QA-, Video-Queue- und Pipeline-Schreibvorgänge an das aktuelle
  Prisma-Schema angepasst; serverseitige TMDB-Suche verhindert einen API-Key im
  Browser-Bundle.
- Legacy-Trailer werden größen- und pfadbegrenzt gestreamt statt vollständig im
  Arbeitsspeicher gepuffert. Push-Abonnements akzeptieren nur validierte Browser-
  Push-Dienste; Versand läuft paginiert, parallelitätsbegrenzt und mit Timeout.
- Admin-Bootstrap und Prisma-Seed an das aktuelle Datenmodell angepasst. Ein
  Admin-Passwort muss explizit über die Umgebung gesetzt werden und mindestens
  16 Zeichen lang sein.

## Historischer Qualitätsstand der Übernahme-Baseline

Die folgenden Zählstände stammen aus der früheren Baseline, nicht aus der
aktuellen Astra-Abnahme. Der erfolgreiche vollständige Produktionsbuild vom
21. September ist oben dokumentiert; der projektweite Typecheck bleibt eine
separate offene Altlast.

- Die automatisierten Tests laufen: 49 von 49 Assertions bestehen, einschließlich
  neuer Fail-Closed-Tests für Admin-, Cron- und interne Authentifizierung.
- ESLint läuft reproduzierbar und interaktivitätsfrei. Der Altbestand enthält
  weiterhin 842 Fehler und 879 Warnungen; deshalb ist Lint noch kein grünes
  Release-Gate.
- TypeScript wird ausgeführt, meldet im Altbestand aber weiterhin 211
  Fehler. `next.config.ts` unterdrückt diese Fehler beim Build weiterhin.
- Der Next.js-Code kompiliert. Ein vollständiger Build benötigt jedoch eine
  erreichbare, zum Prisma-Schema passende Datenbank, weil Seiten und Sitemaps
  während des Prerenderings Daten abfragen.

## Offene Sicherheits- und Betriebsaufgaben

1. **Alte Secrets nach vollständiger Inventarisierung koordiniert rotieren.** Im aktuellen Stand wurden
   Schlüssel entfernt, sie bleiben aber in der Git-Historie auffindbar. Betroffen
   sind mindestens Datenbank, TMDB, JWT/Admin, Cron, Push/VAPID und ein
   Emergent-LLM-Schlüssel. Danach muss eine koordinierte Historienbereinigung
   erfolgen; kein Force-Push ohne Freigabe und Backup.
2. **Die noch offenen externen Konten vollständig inventarisieren.** Die
   Topologie von Coolify/Hetzner, PostgreSQL und Cloudflare R2 ist bestätigt;
   DNS sowie die externen API-Konten müssen vor Rotation oder Änderung jeweils
   separat verifiziert werden.
3. **PostgreSQL zusätzlich datenbankkonsistent sichern.** Vor jeder
   Schemaaktion einen geprüften PostgreSQL-Dump und ein geprüftes Volume- bzw.
   Host-Rollback vorhalten. Die vorhandenen Prisma-Migrationen bilden die 43
   Modelle nicht vollständig aus einer leeren Datenbank nach; auch der
   Migrationsstatus der Live-Datenbank ist nicht sauber. `prisma migrate
   deploy` und `prisma db push` dürfen deshalb nicht gegen Produktion oder eine
   ungeprüfte neue Datenbank ausgeführt werden.
4. **Cron-/Worker-Architektur bereinigen.** Produktion nutzt Coolify
   Scheduled Tasks; ein paralleler Daemon ist nicht vorgesehen. No-op- und
   Altjobs entfernen beziehungsweise begründet behalten. Für Python-,
   Playwright-, `yt-dlp`-/FFmpeg- oder Backup-Arbeit erst eine getrennte,
   reproduzierbare Worker-Ressource entwerfen.
5. **Emergent-Reste ersetzen.** Google-Auth-, Bild-/Trailer- und einzelne
   LLM-Fallbackpfade enthalten noch historische Emergent-Kopplungen. R2 ist noch
   nicht in allen Pfaden die einzige Storage-Lösung.

## Benötigte Übergabezugänge

- Coolify-Projekt/Server und Hetzner-Zugang für Betrieb, Backup- und
  Wiederherstellungsprüfungen
- Zugriff auf ein getrenntes Backupziel für PostgreSQL-Dumps und
  Volume-Sicherungen
- Cloudflare-Zone und R2-Bucket
- OpenAI-, TMDB-, Push/VAPID-, RapidAPI- und gegebenenfalls Google-/Facebook-
  Konten zur Rotation und Funktionsprüfung
- DNS-Registrar, falls nicht vollständig über Cloudflare verwaltet

Zugangsdaten nicht in Tickets, Dokumentation oder Chat einfügen. Einladungen an
Konten oder einen vorhandenen Secret-Manager verwenden.

## Sichere nächste Reihenfolge

1. Begleiteten echten Quellenlauf abschließen und Ergebnis, gespeicherten
   Artikel, Bild sowie öffentliche Artikel-/Startseiten-/News-Anzeige prüfen.
   Bei Fehlern Tasks deaktiviert lassen; kein ungeprüfter automatischer Retry.
2. Erst nach bestandener fachlicher Abnahme den News-Task gezielt freigeben
   und Fehlerbenachrichtigung/Freshness überwachen. Keine parallelen Scheduler.
3. Frischen Sicherungssatz extern sichern und automatische Backupplanung mit
   regelmäßigem Restore-Test einrichten; vor weiteren Änderungen erneut prüfen.
4. Build-Schutz einschließlich aktivem Swap vor jedem weiteren Deployment
   bestätigen. Auto-Deploy bleibt bis zu einer gesonderten Entscheidung manuell.
5. Externe Konten vervollständigen, kompromittierte historische Secrets
   koordiniert rotieren und danach Staging, Migrations-Baseline sowie
   TypeScript-/Lint-Altlasten bearbeiten. Keine Produktionsmigration und keine
   Rotation als ungefragte Nebenwirkung des News-Rollouts.
