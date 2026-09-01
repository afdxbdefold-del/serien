# Übernahmestatus serien.de

Stand: 1. September 2026

Arbeitsbranch: `codex/takeover`

Ausgangspunkt: `main` bei `625bebd85fc95a7680cc5e6c64120e3b57361dcd`

Dieses Dokument beschreibt den verifizierten Ist-Stand der technischen
Übernahme. Es ersetzt keine Live-Prüfung der Produktionssysteme.

## Live verifizierte Produktion (1. September 2026)

- Produktion läuft auf einem Hetzner-Server über Coolify. Details des
  Management-Zugangs und der internen Ressourcen bleiben im privaten
  Betriebsinventar.
- Die Anwendung wird aus diesem Repository, Branch `main`, gebaut. Zum
  Prüfzeitpunkt lief Commit `625bebd85fc95a7680cc5e6c64120e3b57361dcd`
  mit Basisverzeichnis `/serien-nextjs` und `serien-nextjs/Dockerfile`.
  `Deploy on push (webhooks)` ist aktiv; ein Push nach `main` kann daher
  unmittelbar einen Produktivdeploy auslösen. `codex/takeover` ist nicht als
  Produktivbranch konfiguriert.
- PostgreSQL 17 läuft als separater Coolify-Service auf demselben Host. Die
  Daten liegen in einem benannten, persistenten Docker-Volume. Neon wird nicht
  verwendet.
- In Coolify sind weder geplante PostgreSQL-Dumps noch ein Volume-Backup oder
  ein S3-Backupziel konfiguriert. Rotierende Hetzner-Ganzserver-Backups sind
  verfügbar; sie ersetzen kein konsistentes, separat prüfbares
  Datenbank-Backup. Details und Retention stehen im privaten Inventar.
- Vor einer freigegebenen operativen Artikelkorrektur wurde am 1. September
  2026 zusätzlich ein manueller logischer und physischer PostgreSQL-17-
  Sicherungsstand mit Prüfsummen sowie isoliertem logischem und physischem
  Restore verifiziert. Er liegt nur auf dem Produktionshost und schließt die
  fehlende Automatisierungs- und Off-Host-Lücke daher nicht.
- Der vorhandene Cloudflare-R2-Bucket ist erreichbar; ein versioniertes
  Artikelbild wurde manuell hochgeladen und öffentlich verifiziert. Im
  Live-App-Environment fehlen weiterhin die R2-Variablennamen, sodass der
  automatische Schreibpfad nicht produktiv bestätigt ist. Vercel-Blob-,
  Emergent- und lokale Medienpfade bleiben parallel aktiv.
- Das Image startet nur den Next.js-Server. Es gibt keinen zusätzlichen
  Worker- oder Supervisor-Container; zeitgesteuerte Aufrufe laufen über
  Coolify Scheduled Tasks gegen `/api/cron/*`.

## Bereits erledigt

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

## Verifizierter Qualitätsstand

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

## No-Go vor einem Produktiv-Deploy

1. **Alle bisher verwendeten Secrets rotieren.** Im aktuellen Stand wurden
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
- Zugriff auf ein getrenntes Backupziel für PostgreSQL-Dumps sowie auf die
  vorhandenen Hetzner-Ganzserver-Backups
- Cloudflare-Zone und R2-Bucket
- OpenAI-, TMDB-, Push/VAPID-, RapidAPI- und gegebenenfalls Google-/Facebook-
  Konten zur Rotation und Funktionsprüfung
- DNS-Registrar, falls nicht vollständig über Cloudflare verwaltet

Zugangsdaten nicht in Tickets, Dokumentation oder Chat einfügen. Einladungen an
Konten oder einen vorhandenen Secret-Manager verwenden.

## Sichere nächste Reihenfolge

1. Produktionsinventar ausschließlich lesend erfassen und Datenbank sichern.
2. Secrets rotieren und Produktionsvariablen anhand `.env.example` neu setzen.
3. Staging mit einem Datenbank-Clone aufbauen; Smoke-Tests für öffentliche
   Seiten, Admin, Cron, Pipeline, Bilder und Trailer durchführen.
4. Erst danach Migrations-Baseline, Worker-Image und verbleibende TypeScript-/
   Lint-Schulden schrittweise bereinigen.
5. Produktiv-Rollout mit geprüftem Rollback und anschließender Beobachtung von
   Error-Logs, Cron-Freshness und Veröffentlichungsrate.
