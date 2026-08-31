# Übernahmestatus serien.de

Stand: 31. August 2026

Arbeitsbranch: `codex/takeover`

Ausgangspunkt: `main` bei `625bebd85fc95a7680cc5e6c64120e3b57361dcd`

Dieses Dokument beschreibt den verifizierten Ist-Stand der technischen
Übernahme. Es ersetzt keine Live-Prüfung der Produktionssysteme.

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
2. **Produktionszugänge und Topologie verifizieren.** Benötigt werden
   Coolify/Hetzner, Neon, Cloudflare/DNS/R2 sowie die externen API-Konten. Die
   Dokumentation enthält widersprüchliche historische Hosting-Angaben.
3. **Neon sichern.** Vor jeder Schemaaktion einen Snapshot beziehungsweise
   Point-in-Time-Recovery-Checkpoint erstellen. Die vorhandenen Prisma-
   Migrationen bilden die 43 Modelle nicht vollständig aus einer leeren
   Datenbank nach. `prisma migrate deploy` darf deshalb nicht gegen eine neue
   oder ungeprüfte Datenbank ausgeführt werden.
4. **Worker/Scheduler festlegen.** Das Docker-Image startet nur den Next.js-
   Server. News-Scheduler sowie Python-, Playwright-, `yt-dlp`-/FFmpeg- und
   Backup-Abhängigkeiten sind darin nicht vollständig abgebildet.
5. **Emergent-Reste ersetzen.** Google-Auth-, Bild-/Trailer- und einzelne
   LLM-Fallbackpfade enthalten noch historische Emergent-Kopplungen. R2 ist noch
   nicht in allen Pfaden die einzige Storage-Lösung.

## Benötigte Übergabezugänge

- Coolify-Projekt/Server oder Hetzner-SSH-Zugang mit Leserechten für die erste
  Bestandsaufnahme
- Neon-Projektzugang einschließlich Backup-/PITR-Status
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
