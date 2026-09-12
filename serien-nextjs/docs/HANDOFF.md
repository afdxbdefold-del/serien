# serien.de — Technisches Handoff-Dokument (Einstiegspunkt)

Stand: 12. September 2026. Ziel dieser Dokumentation: Jeder Entwickler oder eine KI
(ChatGPT/Codex/Claude etc.) soll dieses Projekt **ohne Emergent-Plattform-
Zugriff und ohne Rückfragen an den vorherigen Betreuer** verstehen, lokal
aufsetzen, betreiben und weiterentwickeln können.

Diese Datei ist der **Einstiegspunkt**. Detail-Dokumente liegen im selben
Ordner (`serien-nextjs/docs/`):

| Datei | Inhalt |
|---|---|
| **`TAKEOVER_STATUS.md`** | Verifizierter Übernahmestand, No-Go-Kriterien und benötigte Zugänge |
| **`API_REFERENCE.md`** | Alle ~90 API-Routen mit Methode, Zweck, Auth-Anforderung |
| **`DATA_MODEL.md`** | Alle 43 Prisma-Modelle mit Zweck, Relationen, wichtigen Feldern |
| **`PIPELINE_AND_LLM.md`** | Kompletter News-Pipeline-Ablauf, LLM-Konfiguration, GPT-5-Fallen |
| **`AD_STACK.md`** | ads.txt, Prebid/Yieldlab, TheMoneytizer/CMP, Primis/Freestar, Diagnose-Tools |
| **`OPERATIONS_RUNBOOK.md`** | Betriebs-Runbook: "keine News", "OpenAI 429", Supervisor-Fallen, Troubleshooting |
| **`MIGRATION_GUIDE.md`** | Lokales Setup von Null, Hetzner/Coolify-Migration, Secrets-Übergabe |

Ältere Feature-spezifische Dokumente (Trailer-System, Pipeline-Refactoring-
Historie, Bild-Pipeline, YouTube-Setup etc.) liegen ebenfalls in diesem
Ordner — siehe Liste am Ende dieser Datei. `/app/memory/PRD.md` (falls noch
im Emergent-Workspace vorhanden) enthält die vollständige chronologische
Produkt-/Bug-Historie.

---

## 1. Projektübersicht

**serien.de** ist eine deutsche News- & Datenbank-Website rund um Streaming-
Serien (Netflix, Disney+, Prime Video, Apple TV+ etc.). Kernfunktionen:

- **Automatisierte News-Pipeline**: scrapt englische Serien-News-Quellen
  (Deadline, Variety, Hollywood Reporter, TVLine, The Cinemaholic und Netflix
  Tudum), lässt ein LLM daraus einen deutschen, SEO-optimierten
  Artikel schreiben (Text, Meta, Q&A-Box, Hero-Bild, Charakter-Bios) und
  veröffentlicht ihn automatisch. In Produktion stößt ein stündlicher
  Coolify Scheduled Task die geschützte HTTP-Cron-Route an; der optionale
  Dauerprozess läuft dort nicht. `processAllNews()` unterstützt zusätzlich
  Google News als Default, die produktive Cron-Route wählt diese Quelle aber
  nicht aus.
- **Serien-Datenbank** (TMDB als Quelle) mit Detailseiten, Top-10-Charts pro
  Streaming-Anbieter, Serienfinder (Filter/Empfehlungen), Personen-/Figuren-
  Profile mit KI-generierten Bios.
- **Werbefinanziert**: eigener Adserver-Stack (Prebid.js + Yieldlab,
  TheMoneytizer Header-Bidding + CMP, Primis/Freestar Outstream-Video). Kein
  Google AdSense mehr (Feb 2026 entfernt, siehe `AD_STACK.md`).
- **Admin-Backend** (`/admin/*`) für manuelle Artikel-Erstellung, Redaktion,
  SEO-Audits, Discover-Score-Dashboard, Ads-Diagnose, Blocklist-Verwaltung.
- **SEO-fokussiert**: Google Discover-Optimierung, IndexNow, Google Indexing
  API, strukturierte Daten, umfangreiche Redirect-/Legacy-URL-Behandlung.

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15, React 19, TypeScript 5. Das Manifest deklariert `^15.1.6`/`^19.0.0`/`^5.7.0`; der Übernahme-Lockstand löst 15.5.25/19.2.8/5.9.3 auf. Die exakten Pakete des lockfilelosen Live-`main` sind daraus nicht beweisbar. |
| Datenbank | **PostgreSQL 17** als eigener Coolify-Service auf dem Hetzner-Produktionsserver, Image `postgres:17-alpine`, Zugriff über **Prisma ORM 6.19.2**. Das leere Feld für die initiale Datenbank fällt auf den Benutzer `postgres` zurück; effektiver Datenbankname ist daher `postgres`. Persistenz: Volume `postgres-data-oun4xzvaum4o58fglnuqks6y` an `/var/lib/postgresql/data`. Neon wird nicht verwendet. |
| Backups | In Coolify sind kein Datenbank-Backupplan und kein S3-Backupziel konfiguriert; dort werden null Backup-Ausführungen angezeigt. Auf dem Host liegen fünf manuelle Sicherungssätze vom 1. und 5. September 2026. Prüfsummen, Dump-Inhaltsverzeichnisse und Kompressionsarchive wurden am 12. September erfolgreich gelesen; ein isolierter Restore wurde nicht ausgeführt. Weil alle Sätze auf demselben Host liegen, bleiben ein aktuelles Offsite-Backup und ein erfolgreicher Restore-Test vor jeder Produktionsänderung Pflicht. |
| Auth | Eigenes JWT (via `jose`), Passwort-Hashing mit `bcryptjs`. `next-auth` ist als Dependency vorhanden (Google-Callback-Flow), Kern-Login läuft aber über eigenes JWT in `lib/auth.ts`. |
| LLM (Text) | OpenAI, Modell-String `gpt-5.4` (siehe `lib/llm-config.ts`), über eigenen `OPENAI_API_KEY`, direktes `openai` npm-SDK (v6.25.0) |
| LLM (Bild) | OpenAI `gpt-image-1` (Hero-Bilder), über selben Key, in `lib/nano-banana-hero.ts` |
| Objektspeicher | Cloudflare **R2** (S3-kompatibel, via `@aws-sdk/client-s3`) für Bilder/Trailer. Vercel Blob (`@vercel/blob`) ist Legacy, läuft parallel aus. |
| Serien-Metadaten | TMDB API (`TMDB_API_KEY`) |
| Hosting (live verifiziert am 12. September 2026) | Hetzner-Server mit Coolify; eine Next.js-Anwendung und ein separater PostgreSQL-Service. Coolify ist lokal unter `http://168.119.171.20:8000/` erreichbar; Port 8000 spricht nur HTTP und darf nicht automatisch auf HTTPS umgestellt werden. Die Anwendung baut aus Repository `afdxbdefold-del/serien`, Branch `main`, Basisverzeichnis `/serien-nextjs`, Dockerfile `/Dockerfile`. `Deploy on push (webhooks)` ist aktiv, daher kann ein Push nach `main` unmittelbar Produktion deployen; `codex/takeover` ist nicht der Produktivbranch. Vercel ist nicht der aktuelle Anwendungshost. |
| Push Notifications | Web Push (`web-push`, VAPID-Keys) |
| Scraping | `cheerio` (HTML-Parsing), `playwright` (schwierigere Quellen, z. B. JS-gerenderte Seiten) |
| Video/Trailer | RapidAPI (YouTube-Download-Fallbacks) |
| Prebid | `prebid.js` v9 (devDependency, wird clientseitig gebündelt/eingebunden) |

Vollständige Dependency-Liste: `package.json` (siehe Abschnitt 8 unten oder
direkt die Datei).

## 3. Verzeichnisstruktur (Next.js App Router)

```
serien-nextjs/
├── app/                        # Next.js App Router — Seiten + API-Routen
│   ├── api/                    # ~90 Backend-Endpunkte (/api/*) — siehe API_REFERENCE.md
│   │   ├── admin/              # Admin-only Endpunkte (Pipeline-Trigger, Radar, SEO-Audit, Ads...)
│   │   ├── auth/                # Login/Session/Register/Google-Callback
│   │   ├── ads/, ads-tm/       # ads.txt-Generierung (2 Formate)
│   │   ├── adtest/              # Sellers.json-Chain-Diagnose
│   │   └── cron/                 # Von externen Cron-Systemen aufrufbare Endpunkte (CRON_SECRET)
│   ├── admin/                   # Admin-Dashboard (Frontend, ~25 Unterseiten)
│   ├── [slug]/                  # Legacy-Root-Level-Artikel-/Serien-Slug-Route
│   ├── serie/[slug]/            # Serien-Detailseite
│   ├── news/, news/[filter]/    # News-Übersicht + gefilterte Ansicht
│   ├── adtest-direct/, adtest-prebid/, adtest-gam*/  # Ad-Diagnose-Testseiten
│   └── (~50 weitere statische/Kategorie-Routen: netflix-serien, top-10,
│         serienfinder, autor/[slug], figur/[slug], genre/[genre], ...)
│         → vollständige Liste: `API_REFERENCE.md` Anhang bzw. `find app -name page.tsx`
├── lib/                         # 136 Dateien — komplette Business-Logik (Pipeline-Steps,
│   │                             Auth, Ad-Config, SEO, Fact-Checking, Fingerprinting, ...)
│   ├── llm-config.ts            # ZENTRALE LLM-Konfiguration (Modell/Key-Auswahl)
│   ├── structured-content-generator.ts  # Haupt-Content-Generator für Artikel
│   ├── nano-banana-hero.ts      # Hero-Bild-Generierung (trotz Name: OpenAI gpt-image-1)
│   ├── content-classifier.ts    # Relevanz-Klassifikation gescrapter News
│   ├── prebid-config.ts         # Yieldlab Schain-Konfiguration (Ad-Stack)
│   ├── auth.ts                  # JWT-Verifikation (`getCurrentUser`, `requireAuth`)
│   └── ... (siehe PIPELINE_AND_LLM.md für Pipeline-relevante Module)
├── scripts/                     # 166 Dateien — CLI-Skripte (via `tsx`/`python3` ausführbar)
│   ├── pipeline-v2.ts            # Kern-Orchestrierung: 1 Artikel von URL → publiziert (3185 Zeilen)
│   ├── news-scraper.ts           # Multi-Source-RSS-Scraper (`processAllNews`, AKTIV genutzt)
│   ├── news-scheduler.ts         # Optionaler Daemon; in der aktuellen Produktion nicht gestartet
│   ├── screenrant-scraper.ts     # ALT/nicht mehr genutzt (Quelle in WEAK_HOSTS geblockt)
│   ├── generate-character-content.py  # Charakter-Bios (Python, eigener OpenAI-Call)
│   └── ... (viele Einmal-Backfill-/Debug-/Test-Skripte, siehe Namenskonvention unten)
├── prisma/
│   ├── schema.prisma             # 43 Modelle, ~925 Zeilen — siehe DATA_MODEL.md
│   └── migrations/
├── docs/                         # Diese Dokumentation + Feature-spezifische Alt-Docs
├── components/                   # React-Komponenten
├── middleware.ts                 # Bot-Blocking (Ad-Fraud-Firewall), Legacy-Redirects, x-pathname
└── next.config.ts                # Image-Domains, Rewrites (ads.txt, adtest-*.html), Redirects
```

**Namenskonvention `scripts/`** (hilfreich beim Navigieren der 166 Dateien):
`backfill-*` = einmalige Daten-Migrationsskripte, `test-*` = Standalone-Testskripte
(kein Test-Framework, direkt mit `tsx` ausführen), `fix-*`/`repair-*` = punktuelle
Daten-Reparaturen, `debug-*`/`inspect-*`/`diag-*` = Ad-hoc-Diagnose, `generate-*` =
Content-Generatoren, `import-*` = Erstimport von TMDB/Feed-Daten, `migrate-*` =
Storage-/Schema-Migrationen (z. B. Vercel Blob → R2).

## 4. Datenmodell — Kurzüberblick

43 Prisma-Modelle. Volle Referenz mit Feldern/Relationen: **`DATA_MODEL.md`**.
Die zentralen Tabellen:

- **`articles`** — News-Artikel (Kernprodukt der Pipeline, Status `draft`/`published`)
- **`series`** — Serien-Stammdaten (TMDB-Sync, Primary Key = `tmdbId`)
- **`persons`**, **`characters`** — Schauspieler/Serienfiguren mit KI-Bios
- **`pipeline_runs`** — Log jedes Pipeline-Durchlaufs (Status/Fehler/Schritt)
- **`radar_runs`**, **`content_queue`**, **`trending_topics`** — Themenfindung
- **`users`**, **`comments`**, **`follows`**, **`notifications`** — User-Features
- **`ad_slots`**, **`global_tags`**, **`ad_fraud_blocks_daily`**, **`crawler_hits`** — Ad-/Bot-Ops
- **`seo_crawl_runs`**, **`seo_page_results`**, **`discover_score_dashboards`** — SEO-Monitoring
- **`blocklist_entries`**, **`app_settings`**, **`redirects`**, **`blocked_visitors`** — Housekeeping
- **`youtube_channels`**, **`youtube_videos`**, **`video_download_queue`** — Trailer-Pipeline
- **`streamer_rankings`** — Top-10-Chart-Snapshots pro Anbieter/Tag
- **`hallucination_log`**, **`sitemap_prewarm_log`**, **`facebook_post_log`** — Pipeline-Audit-Logs

Schemaänderungen laufen über Prisma. Die vorhandene Migrationshistorie ist
jedoch keine vollständige Baseline für eine leere Datenbank. Vor `db push` oder
`migrate deploy` deshalb zwingend `TAKEOVER_STATUS.md` lesen, Datenbank sichern
und den tatsächlichen Coolify-PostgreSQL-Stand vergleichen.

## 5. Environment Variables (betriebsrelevante Auswahl — Werte NICHT hier)

⚠️ **Nie tatsächliche Schlüsselwerte in Doku, Commits oder Chat schreiben.**
Diese Tabelle listet ausschließlich Namen und Zweck. Die vollständige,
kanonische Liste steht in `.env.example`.

| Variable | Zweck | Pflicht zum Starten? |
|---|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL; in Produktion zeigt sie auf den privaten Coolify-Datenbankservice. | **Ja** |
| `DIRECT_URL` | Direkte PostgreSQL-Verbindung für Prisma-CLI-Schritte. In `prisma/schema.prisma` referenziert (`directUrl = env("DIRECT_URL")`), im verifizierten Coolify-App-Environment aber nicht vorhanden. Vor jedem Schema-/Migrationsversuch müssen Backup, Schema-Baseline und diese Variable separat geprüft werden; gegen Produktion sind Migrationen bis dahin gesperrt. | Für Prisma-CLI/Build prüfen; nicht für normale Runtime-Queries |
| `OPENAI_API_KEY` | Eigener OpenAI-Key — treibt Text (`gpt-5.4`) + Bild (`gpt-image-1`) | Ja; kein unterstützter Produktions-Fallback |
| `EMERGENT_LLM_KEY` | Legacy-Kompatibilität für einen noch vorhandenen Emergent-Proxy-Codepfad. Der Variablenname existiert in Produktion, ist auf dem aktuellen Hetzner-Host aber kein belastbarer Failover und soll nach vollständiger Inventarisierung entfallen. | Nein |
| `TMDB_API_KEY` | The Movie Database — Serien-/Episoden-Metadaten | Ja |
| `JWT_SECRET` | Signatur-Secret für Admin-/User-Login-Tokens (`lib/auth.ts`) | Ja |
| `REVALIDATE_SECRET` | Separates Server-zu-Server-Secret für `/api/internal/revalidate*` | Für Cache-Invalidierung |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL`, `NEXT_PUBLIC_R2_URL` | Cloudflare R2 Objektspeicher (Bilder/Trailer) | Nein zum Starten, Feature bricht sonst |
| `BLOB_READ_WRITE_TOKEN`, `BLOB_PUBLIC_URL`, `NEXT_PUBLIC_BLOB_URL` | Vercel Blob (Legacy, läuft aus) | Nein |
| `RAPIDAPI_KEY`, `RAPIDAPI_KEY_BACKUP` | YouTube-Trailer-Download-Fallbacks. ⚠️ Bekanntes Backlog-Problem: Backup war identisch mit Primary — muss ein echter Zweit-Key sein, sonst bringt der Fallback nichts. | Nein |
| `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-Push-Benachrichtigungen | Nein |
| `PUSH_API_SECRET` | Schutz für den Push-Send-Endpoint (`/api/push/send`) | Nein |
| `PUSH_ALLOWED_HOSTS` | Optionale, kommagetrennte zusätzliche Push-Service-Hosts; Wildcards nur als `*.example.org`. Bekannte Browser-Push-Hosts sind bereits erlaubt. | Nein |
| `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN_EXPIRES_AT` | Auto-Posting neuer Artikel auf Facebook (`lib/facebook-poster.ts`) | Nein |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Indexing API (schnellere Google-Indexierung neuer Artikel) | Nein |
| `NEXT_PUBLIC_BASE_URL` | Öffentliche Basis-URL der Seite | Ja |
| `HEADLINE_OPINION_KILLER`, `HEADLINE_REWRITE_LOOP`, `USE_PROCESSED_IMAGES` | Feature-Flags (`"true"`/`"false"`) für Pipeline-Verhalten | Nein |
| `AUTOMATED_NEWS_PUBLISHING_ENABLED` | Expliziter Release-Schalter für Pipeline-v2, P3 und P4. Nur der exakte Wert `true` erlaubt eine direkte Pipeline-Veröffentlichung; Standard und fehlende Konfiguration erzeugen Review-Entwürfe. | Nein; sicherer Standard ist `false` |
| `AUTOMATED_EDITORIAL_AUTHOR_ID` | Festes, vorhandenes Redaktionskonto für automatisiert erzeugte Entwürfe. Das Konto muss die Rolle `author` besitzen; Standard-Fallback ist `redaktion`. | Für News-Pipelines |
| `CRON_SECRET` | Bearer-Secret für alle `/api/cron/*`-Routen. Ausschließlich als `Authorization: Bearer …` senden; Query-Parameter werden nicht akzeptiert. Fehlende Konfiguration schlägt geschlossen fehl. | Für Cron-Endpunkte |

Die kanonische, wertfreie Variablenliste steht in `.env.example`. Beim
Hinzufügen einer Umgebungsvariable muss diese Datei im selben Commit ergänzt
werden; lokale `.env*`-Dateien und Exportdateien dürfen nie committed werden.

## 6. Lokales Setup — Kurzfassung

Ausführliche Schritt-für-Schritt-Anleitung inkl. Troubleshooting:
**`MIGRATION_GUIDE.md`**. Kurzfassung:

```bash
git clone <repo-url> serien-nextjs && cd serien-nextjs
npm ci
cp .env.example .env   # falls vorhanden, sonst manuell anlegen (siehe Abschnitt 5)
npx prisma generate
# Nur auf einer entbehrlichen lokalen Entwicklungsdatenbank:
npx prisma db push
npm run dev             # Port 3000
```

Die eingecheckte Migrationshistorie ist keine vollständige Baseline. Die
beiden Schema-Befehle in diesem Beispiel sind ausschließlich für eine lokale,
entbehrliche Datenbank gedacht und dürfen nicht auf Produktion zeigen.

## 7. News-Pipeline & LLM — Kurzüberblick

Voller Ablauf inkl. aller Gate-Checks, Fehlerpfade und GPT-5-Besonderheiten:
**`PIPELINE_AND_LLM.md`**.

Kurzfassung: `scripts/news-scheduler.ts` kann als Dauerprozess (`setInterval`)
laufen und übergibt neue Funde aus `scripts/news-scraper.ts`
(`processAllNews`) an `scripts/pipeline-v2.ts` (`runPipelineV2`, 3185 Zeilen).
In der am 1. September 2026 verifizierten Produktion läuft dieser Daemon
jedoch nicht: Coolify Scheduled Tasks rufen stattdessen die geschützten
`/api/cron/*`-Routen auf. Der komplette Pipeline-Weg reicht von der Roh-URL
bis zum publizierten, SEO-optimierten, bebilderten deutschen Artikel inklusive
Klassifikation, Fact-Checking, Charakter-Import, Hero-Bild, Trailer-Suche,
Sitemap-Prewarm, Facebook-Post und Google-Indexing.

## 8. Ad-Stack — Kurzüberblick

Volle Referenz inkl. Yieldlab-Schain-Debugging-Historie: **`AD_STACK.md`**.

Kurzfassung: `ads.txt` wird dynamisch über `/api/ads` generiert (Rewrite in
`next.config.ts`). Haupt-Demand: Yieldlab via Prebid.js (`lib/prebid-config.ts`),
TheMoneytizer Header-Bidding + eigener CMP, Primis/Freestar Outstream-Video
(`app/layout.tsx`). Diagnose-Testseiten: `/adtest-direct`, `/adtest-prebid`.
`middleware.ts` blockt bekannte Bot-User-Agents/Fraud-Länder VOR dem Rendering
— jeder externe Test (curl, Monitoring, Playwright) braucht einen echten
Browser-User-Agent, sonst HTTP 204.

## 9. Bekannte offene Punkte / Backlog

Siehe `OPERATIONS_RUNBOOK.md` Abschnitt "Backlog" für die aktuelle Liste
(RapidAPI-Key-Duplikat, Sitemap-Prewarm-401, PostgreSQL-Backup-Lücke,
Cron-401, Yieldlab-NoBid-Ticket und fehlende R2-Poster u. a.).

## 10. Wichtige Lessons Learned

1. **`max_tokens` vs. `max_completion_tokens`** — bei OpenAI GPT-5.x-Modellen
   immer prüfen, welchen Token-Limit-Parameter das Modell akzeptiert. Ein
   falscher Parameter lässt 100 % der LLM-Aufrufe mit HTTP 400 scheitern.
   Details: `PIPELINE_AND_LLM.md`.
2. **Globale npm-Installationen überleben keinen Server-Neustart** — Tools
   wie `tsx`, die von einem optionalen Worker gebraucht werden, immer als
   echte `package.json`-Dependency installieren, nie nur global.
3. **"Kein Fehler" ≠ "Erfolgreich"** — mehrere Scraper-Skripte zählten
   `stats.processed++` allein basierend darauf, dass keine Exception flog,
   auch wenn die Pipeline den Artikel intern (z. B. per `WEAK_HOSTS`-Gate)
   verworfen hat. Erfolg immer per DB-Rückfrage (`status: 'published'`)
   verifizieren, nicht per Fehlen eines Errors.
4. **`middleware.ts` blockt Headless-Browser/curl-Standard-UAs** — bei jedem
   externen Monitoring/Testing einen echten Chrome-User-Agent-String
   mitschicken.
5. **`P1001` ist in Produktion kein Neon-Cold-Start-Signal.** Die Datenbank
   läuft dauerhaft als Coolify-PostgreSQL-Service. Bei `P1001` zuerst den
   Datenbank-Container, dessen Healthcheck, das private Coolify-Netzwerk, die
   Verbindungsgrenze und erst danach die Konfiguration von `DATABASE_URL`
   prüfen; Werte niemals protokollieren.
6. **Falls später wieder Supervisor eingesetzt wird:** Bei
   Konfigurationsblöcken mit zwei `environment=`-Zeilen gewinnt nur die
   letzte Zeile im selben `[program:x]`-Block; die erste wird
   stillschweigend verworfen. Immer alle Env-Variablen eines Prozesses in
   EINER `environment=`-Zeile zusammenfassen.
7. **Prisma `directUrl`** referenziert `DIRECT_URL`, das in Produktion nicht
   als App-Variable sichtbar war. Der normale Query-Betrieb nutzt
   `DATABASE_URL`; für Prisma-CLI-Schritte einschließlich Schema-Validierung,
   Generierung und Migration müssen beide Variablen vorab kontrolliert
   bereitstehen. Keine Migration gegen Produktion ausführen.

---

## Weitere Feature-spezifische Dokumente in `docs/`

Diese älteren, feature-spezifischen Dateien bleiben als Referenz erhalten
(nicht alle sind noch 1:1 aktuell — im Zweifel Code als Quelle der Wahrheit
nehmen):

`4_SOURCE_SYSTEM.md`, `CRON_JOBS.md`, `EXTENDED_OVERVIEW_FEATURE.md`,
`FANDOM_SCRAPER_MIGRATION.md`, `IMAGE_PROCESSING.md`,
`INTERNAL_LINKING_GUARANTEE.md`, `MULTI_SOURCE_TRAILERS.md`,
`OPTIMIZED_SOURCE_ORDER.md`, `PIPELINE_REFACTORING.md`,
`PIPELINE_REFACTORING_PHASE2.md`, `PIPELINE_REFACTORING_PHASE3.md`,
`PIPELINE_SCHEDULER.md`, `ROADMAP_TRAILER_FEATURE.md`,
`SCHEMA_VALIDATION_REPORT.md`, `TRAILER_FEATURE_STATUS.md`,
`TRAILER_MANAGEMENT.md`, `TRAILER_SOURCES_V3.md`, `TRIPLE_RAPIDAPI_SYSTEM.md`,
`TYPESCRIPT_STRICT_MODE.md`, `YOUTUBE_COOKIES_SETUP.md`,
`YOUTUBE_OPTIMIZATION.md`, `YT_DLP_SETUP.md`.

Für die vollständige Produkt-/Bug-Historie (chronologisch, mit Daten) siehe
`/app/memory/PRD.md`, falls dieses Repo noch aus dem Emergent-Workspace
exportiert wird — sonst ist der Git-Log (`git log --oneline`) die beste
verbleibende Quelle für die Chronologie.
