# Übernahmestatus serien.de

Stand: 21. September 2026

Arbeitsbranch: `codex/takeover`

Ausgangspunkt: `main` bei `625bebd85fc95a7680cc5e6c64120e3b57361dcd`

Vom Betreiber verifizierter Übernahmecommit:
`5d03d47cfae0411f4bda0cd5673274d7e98e0396`; am 21. September erneut als
Vorfahre des aktuellen `codex/takeover` bestätigt. Die Angabe zum historischen
Abzweig ist keine Freigabe, `main` zu ändern oder zu deployen.

Dieses Dokument beschreibt den verifizierten Ist-Stand der technischen
Übernahme. Es ersetzt keine Live-Prüfung der Produktionssysteme.

## Aktueller Live-Nachtrag (21. September 2026, nach 15:13 UTC)

Dieser Nachtrag hat Vorrang vor den früheren Snapshots in
`PIPELINE_LIVE_AUDIT_2026-09-21.md` und unten. Build-Ursache und Schutzmaßnahmen:
`BUILD_INCIDENT_2026-09-21.md` und `BOUNDED_BUILD_RUNBOOK.md`.

- Bestätigt live: **`codex/takeover`**, Commit
  `17b62e4546582e751fd3db52b749d033f1185724`, einschließlich Quellenabruf-Fix
  und persistenter Quellenrotation. Coolify-Deployment
  `aq2vx26tqzt8nlyitv0lpcc1` um etwa 15:11 UTC erfolgreich; neuer App-Container
  `i8e996hq5t8moyf9fw8p0pbs-150527161770` gesund, Neustartzähler 0,
  `OOMKilled=false`. Öffentliche Artikel-, Bild- und Listenprüfung nach diesem
  finalen Rollout erneut vollständig bestanden.
  Der App-Anzeigename mit `main` ist veraltet.
  **Auto-Deploy bleibt auf „Manual deployments only“; nicht wieder aktivieren,
  ohne den Build-Schutz und den aktuellen Hostzustand zu prüfen.**
- PostgreSQL 17 auf Hetzner/Coolify und dasselbe persistente Volume erneut
  bestätigt; effektive Datenbank `postgres`. Kein Neon. Datenbank gesund,
  Neustartzähler 0, Postmaster-Start weiterhin am 2. August. Docker zeigt
  historisch `OOMKilled=true`; dies nicht als `false` dokumentieren oder
  ohne weitere Belege als aktuellen Datenbank-Neustart deuten. Bei der
  aktuellen Prüfung keine Kernel-OOM-Ereignisse seit 14:00 UTC gefunden.
- Der vorhandene **stündliche Coolify-News-Task ist seit 15:13:42 UTC aktiviert**;
  gespeicherten Zustand nach erneutem Laden bestätigt. Globale Pause
  `pipeline.cron.paused=false` ebenfalls bestätigt. **YouTube und Videos
  bleiben deaktiviert**; kein zusätzlicher Scheduler.
  News-Zeitplan unverändert `0 * * * *`, Coolify-Task-Limit 3600 Sekunden;
  zusätzliche HTTP-Client-Deadline von 600 auf 3500 Sekunden angehoben,
  gespeichert und zurückgelesen. Die beiden Zeitlimits sind unabhängig.
- Weiterhin kein automatischer Backupplan in Coolify. Nach ausdrücklicher
  Betreiberfreigabe neue logische und physische Backups am 21. September
  erstellt, Kompression/Prüfsummen geprüft und **beide getrennt erfolgreich
  wiederhergestellt**: 4.360 Artikel (4.275 veröffentlicht, 75 Entwürfe,
  10 archiviert), 44 Tabellen. Keine Produktionsdaten zurückgespielt.
  Beide Backup-Prüfsummen wurden um 14:30 UTC erneut bestätigt. Die frische
  externe Kopie ist noch offen; Details im Live-Audit.
  Nach Veröffentlichung zusätzlich `post-publication-1512.dump` im privaten
  Sicherungsverzeichnis erstellt: Snapshot mit 4.361 Artikeln,
  `pg_restore --list` und erneute SHA-256-Prüfung bestanden. **Dieser neueste
  Dump wurde noch nicht separat wiederhergestellt**; der vollständige
  logische/physische Restore-Nachweis gilt für den vorherigen 4.360er-Satz.
- Astra (`gpt-6-astra` / `low`), verpflichtende Deutschlandrelevanz und
  Quellen-/Bildprüfung sind ausgerollt. Nach sieben synthetischen Modellfällen
  hat auch ein echter begleiteter Pipeline-Publish bestanden:
  [„Süße Magnolien“ endet nach fünf Staffeln: Stars nehmen Abschied](https://serien.de/sue-e-magnolien-endet-nach-fuenf-staffeln-stars-nehmen-abschied),
  veröffentlicht am 21. September um 14:57:02 UTC. Artikel-ID
  `pipeline-v2-1790002516287`, Run `32a5d3e8-ab7f-471e-bd04-2e0824f4775c`.
  Kanonische URL, H1, tatsächlich ausgeliefertes und vollständig dekodiertes
  Hero-Bild (1280 × 720), erster Startseiten-Karussell-Slide und `/news`
  bestätigt. Inhalt gegen die aktuelle TVLine-Quelle geprüft;
  Deutschlandrelevanz über Netflix Deutschland bestätigt. Aktueller
  Datenbankbestand: **4.361 Artikel**; der separat wiederhergestellte
  Sicherungssatz enthält 4.360.
- Der vorhandene Coolify-News-Task wurde vor der dauerhaften Aktivierung um
  15:13:00 UTC über „Execute Now“ geprüft und endete nach acht Sekunden
  erfolgreich. Die Wiederholungsprüfung bestätigte den vorhandenen Artikel
  und setzte dessen Run auf `SUCCESS` ohne `errorStep`; keine zweite News
  erzeugt. Ein weiterer Kandidat wurde korrekt als zu alt abgelehnt.
  Übergeordneter Cron-Run erfolgreich, persistierter Quellen-Cursor
  `Cinemaholic`. Ein erfolgreicher Lauf muss nicht zwingend einen neuen Artikel
  erzeugen, wenn kein passender aktueller Kandidat vorliegt.
- Der zuvor irreführend als Timeout gemeldete Netflix-Abruf ist behoben:
  rund 3,6 MB HTML überschritten die alte 2-MiB-Grenze. Der live ausgerollte
  Fix begrenzt Header, Stream und Parser einheitlich auf 8 MiB und bewahrt
  genaue Fehlerkategorien. 60.000 Zeichen extrahierter Text, SSRF-/DNS-Schutz,
  Timeout und Qualitätsregeln bleiben unverändert. Ein erfolgreicher Abruf
  verjüngt kein Quelldatum; die Netflix-Quelle vom 17. September wurde
  weiterhin korrekt als zu alt behandelt.
- Der live ausgerollte Cursor-Fix speichert die zuletzt tatsächlich
  versuchte Quelle in `app_settings` unter `pipeline.news.import.last-source`.
  Dadurch startet ein kleiner stündlicher Lauf nicht stets bei derselben
  Quelle. Keine Schema-Migration; Pause, Dry-Run oder abgelaufenes Zeitbudget
  dürfen den Cursor nicht weiterstellen. Kein zusätzlicher Scheduler.
- Build-Schutz: eigener Builder mit 1024 MiB RAM, maximal 2048 MiB Swap und
  0,75 CPU; tatsächliche Kernel-Grenzen geprüft. Zusätzlich 4 GiB Host-Swap,
  root/0600, **nicht über einen Neustart persistent aktiviert**. Vollständiger
  Build einschließlich 164 statischer Seiten und Image-Import zuvor bestanden.
  Der finale Rollout bestand ohne Wächter-Abbruch: Kompilierung 114 Sekunden,
  164 Seiten, Export 27,9 Sekunden; Origin und öffentliche Gesundheit HTTP 200.
  Builder und Sicherheitswächter (PID 27375, privates `guard-cursor.log`)
  wurden um 15:12 UTC gestoppt; Swap bleibt aktiv. Plattenuntergrenze des
  Laufs 4 GiB, vor Start rund 6,7 GiB frei; vorheriger Build benötigte
  zusätzlich rund 1,6 GiB. Keine Datenbereinigung oder Löschung durchgeführt.

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

1. Den nächsten regulären stündlichen News-Lauf auf Ergebnis, Quellenrotation
   und gegebenenfalls bestätigte Veröffentlichung prüfen. „Execute Now“ und
   Aktivierung sind erfolgt; nicht erneut ohne Anlass auslösen.
2. Fehlerbenachrichtigung und Freshness-Betrieb prüfen. YouTube/Videos
   deaktiviert lassen, keine parallelen Scheduler. Bei einem neuen Fehler
   Ursache prüfen und bei Bedarf gezielt pausieren; keine ungeprüften Retries.
3. Frischen Sicherungssatz extern sichern und automatische Backupplanung mit
   regelmäßigem Restore-Test einrichten; vor weiteren Änderungen erneut prüfen.
4. Build-Schutz einschließlich aktivem Swap vor jedem weiteren Deployment
   bestätigen. Auto-Deploy bleibt bis zu einer gesonderten Entscheidung manuell.
5. Externe Konten vervollständigen, kompromittierte historische Secrets
   koordiniert rotieren und danach Staging, Migrations-Baseline sowie
   TypeScript-/Lint-Altlasten bearbeiten. Keine Produktionsmigration und keine
   Rotation als ungefragte Nebenwirkung des News-Rollouts.
