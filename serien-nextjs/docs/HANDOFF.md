# serien.de — Technisches Handoff-Dokument

Stand: August 2026. Ziel dieses Dokuments: Jeder Entwickler (oder eine KI wie
ChatGPT/Codex) soll dieses Projekt ohne Emergent-Plattform-Zugriff verstehen,
lokal aufsetzen und weiterentwickeln können.

---

## 1. Projektübersicht

**serien.de** ist eine deutsche News- & Datenbank-Website rund um Streaming-
Serien (Netflix, Disney+, Prime Video, Apple TV+ etc.). Kernfunktionen:

- Automatisierte News-Pipeline: scrapt englische Serien-News-Seiten (Deadline,
  Variety, Hollywood Reporter, TVLine, The Cinemaholic, Netflix Tudum), lässt
  einen LLM daraus einen deutschen, SEO-optimierten Artikel schreiben und
  veröffentlicht ihn automatisch (stündlich per Cron).
- Serien-Datenbank (TMDB als Datenquelle) mit Detailseiten, Top-10-Charts pro
  Streaming-Anbieter, Serienfinder (Filter/Empfehlungen).
- Werbefinanziert: eigener Adserver-Stack (Prebid.js, Yieldlab, TheMoneytizer,
  Primis/Freestar, Google AdSense/GAM).
- Admin-Backend (`/admin/*`) für manuelle Artikel-Erstellung, Redaktion,
  SEO-Audits, Ads-Diagnose.

## 2. Tech-Stack

| Bereich | Technologie |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Datenbank | PostgreSQL, gehostet auf **Neon** (serverless), Zugriff über **Prisma ORM** |
| Auth | Eigenes JWT (via `jose`), Passwort-Hashing mit `bcryptjs`. Kein OAuth aktuell im Kern-Login (Google-Session-Route existiert separat für einen Teil-Flow). |
| LLM (Text) | OpenAI **GPT-5.4** über eigenen `OPENAI_API_KEY`, direktes `openai` npm/pip SDK (kein Wrapper) |
| LLM (Bild) | OpenAI **gpt-image-1** (Hero-Bilder), über selben Key |
| Objektspeicher | Cloudflare **R2** (S3-kompatibel, via `@aws-sdk/client-s3`) für Bilder/Trailer. Vercel Blob (`@vercel/blob`) ist Legacy/Auslaufend. |
| Serien-Metadaten | TMDB API (`TMDB_API_KEY`) |
| Hosting (aktuell) | **Vercel** (Produktion läuft noch hier, `NEXT_PUBLIC_BASE_URL` zeigt auf `*.vercel.app`) |
| Hosting (geplant) | Migration zu **Hetzner + Coolify** ist in Vorbereitung, noch nicht live (DNS-Cutover steht aus) |
| Push Notifications | Web Push (`web-push`, VAPID Keys) |
| Scraping | `cheerio` (HTML-Parsing), `playwright` (für schwierigere Quellen) |
| Video/Trailer | RapidAPI (YouTube-Download-Fallbacks), `yt-dlp` |

## 3. Verzeichnisstruktur (Next.js App Router)

```
serien-nextjs/
├── app/                      # Next.js App Router — Seiten + API-Routen
│   ├── api/                  # Alle Backend-Endpunkte (/api/*)
│   │   ├── admin/            # Admin-only Endpunkte (Pipeline-Trigger, Radar, SEO-Audit...)
│   │   ├── auth/              # Login/Session
│   │   ├── ads/, ads-tm/     # ads.txt Generierung
│   │   ├── adtest/            # Sellers.json-Chain-Diagnose (siehe Abschnitt 8)
│   │   └── cron/               # Von externen Cron-Systemen aufrufbare Endpunkte
│   ├── [slug]/                # Serien-Detailseite (dynamische Route)
│   ├── news/                  # News-Übersicht
│   ├── admin/                 # Admin-Dashboard (Frontend)
│   ├── adtest-direct/, adtest-prebid/  # Ad-Diagnose-Testseiten
│   └── (~50 weitere statische/Kategorie-Routen: netflix-serien, top-10, etc.)
├── lib/                       # ~136 Dateien — komplette Business-Logik
│   ├── llm-config.ts          # ZENTRALE LLM-Konfiguration (Modell/Key-Auswahl)
│   ├── structured-content-generator.ts  # Haupt-Content-Generator für Artikel
│   ├── nano-banana-hero.ts    # Hero-Bild-Generierung (trotz Name: OpenAI gpt-image-1, nicht Gemini)
│   ├── content-classifier.ts  # Relevanz-Klassifikation gescrapter News
│   ├── heading-generator.ts   # Überschriften-/Meta-Generierung
│   ├── was-bedeutet-das.ts    # "Was bedeutet das"-Erklärboxen
│   ├── auth.ts                # JWT-Verifikation
│   └── ...
├── scripts/                    # ~160 Dateien — CLI-Skripte (via `tsx`/`python3` ausführbar)
│   ├── pipeline-v2.ts          # Kern-Orchestrierung: 1 Artikel von URL → publiziert
│   ├── news-scraper.ts         # Multi-Source-RSS-Scraper (AKTIV genutzt)
│   ├── news-scheduler.ts       # Stündlicher Scheduler-Prozess (läuft als Daemon)
│   ├── screenrant-scraper.ts   # ALT/nicht mehr genutzt (Quelle geblockt, siehe Abschnitt 10)
│   ├── generate-character-content.py  # Charakter-Bios (Python, eigener OpenAI-Call)
│   └── ...
├── prisma/
│   ├── schema.prisma            # ~40 Tabellen, siehe Abschnitt 4
│   └── migrations/
├── docs/                        # Feature-spezifische Doku (Trailer, Pipeline-Refactoring, etc.)
├── components/                  # React-Komponenten
├── middleware.ts                # Bot-Blocking (Ad-Fraud-Schutz), Geo-Checks
└── next.config.ts               # Image-Domains, Build-Config
```

## 4. Datenmodell (Prisma, `prisma/schema.prisma`)

Wichtigste Tabellen (insgesamt ~40):

- **`series`** — Serien-Stammdaten (TMDB-Sync)
- **`articles`** — News-Artikel (Status: `draft`/`published`), Kernprodukt der Pipeline
- **`article_series`**, **`article_persons`** — Verknüpfungstabellen
- **`article_qa`** — automatisch generierte Q&A-Boxen pro Artikel
- **`persons`**, **`characters`** — Schauspieler/Serienfiguren mit KI-generierten Bios
- **`pipeline_runs`** — Log jedes Pipeline-Durchlaufs (Erfolg/Fehler/Schritt)
- **`trending_topics`**, **`radar_runs`**, **`content_queue`** — Themen-/Ideen-Findung
- **`streaming_releases`**, **`upcoming_episodes`** — Release-Kalender
- **`users`** — Nutzer-Accounts (Kommentare, Notifications)
- **`comments`**, **`follows`**, **`notifications`**, **`push_subscriptions`**
- **`ad_slots`**, **`ad_fraud_blocks_daily`**, **`crawler_hits`** — Ad-/Bot-Monitoring
- **`seo_crawl_runs`**, **`seo_page_results`**, **`discover_score_dashboards`** — SEO/Google-Discover-Tracking
- **`redirects`**, **`blocklist_entries`**, **`blocked_visitors`** — Housekeeping
- **`youtube_channels`**, **`youtube_videos`**, **`video_download_queue`** — Trailer-Pipeline
- **`streamer_rankings`** — Top-10-Chart-Daten pro Anbieter

Migrationen laufen über Prisma (`npx prisma migrate dev` / `db push`).

## 5. Environment Variables (vollständige Liste, Werte NICHT hier — siehe eigener Passwort-Manager)

| Variable | Zweck |
|---|---|
| `DATABASE_URL` | Neon Postgres Connection String |
| `OPENAI_API_KEY` | Eigener OpenAI-Key — treibt Text (GPT-5.4) + Bild (gpt-image-1) |
| `EMERGENT_LLM_KEY` | Nur noch Fallback, falls `OPENAI_API_KEY` fehlt (Emergent-Proxy, Claude Sonnet 4.6) |
| `TMDB_API_KEY` | The Movie Database — Serien-/Episoden-Metadaten |
| `JWT_SECRET` | Signatur-Secret für Admin-/User-Login-Tokens |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL` | Cloudflare R2 Objektspeicher (Bilder/Trailer) |
| `BLOB_READ_WRITE_TOKEN`, `BLOB_PUBLIC_URL`, `NEXT_PUBLIC_BLOB_URL` | Vercel Blob (Legacy, läuft aus) |
| `RAPIDAPI_KEY`, `RAPIDAPI_KEY_BACKUP` | YouTube-Trailer-Download-Fallbacks (⚠️ Backup ist aktuell identisch mit Primary — muss ein echter Zweit-Key sein) |
| `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Web-Push-Benachrichtigungen |
| `PUSH_API_SECRET` | Schutz für den Push-Send-Endpoint |
| `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_TOKEN_EXPIRES_AT` | Auto-Posting neuer Artikel auf Facebook |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google Indexing API (schnellere Google-Indexierung neuer Artikel) |
| `NEXT_PUBLIC_BASE_URL` | Öffentliche Basis-URL der Seite (aktuell Vercel-Domain) |
| `HEADLINE_OPINION_KILLER`, `HEADLINE_REWRITE_LOOP`, `USE_PROCESSED_IMAGES` | Feature-Flags (`"true"`/`"false"`) für Pipeline-Verhalten |

## 6. Lokales Setup von Null (außerhalb von Emergent)

Voraussetzungen: Node.js 20+, Python 3.11+ (für die Character-Bio-Skripte),
ein Neon-Postgres-Projekt (oder beliebige Postgres-Instanz), die Keys aus
Abschnitt 5.

```bash
# 1. Repo klonen (z.B. via "Save to GitHub" aus Emergent exportiert)
git clone <repo-url> serien-nextjs
cd serien-nextjs

# 2. Dependencies installieren (yarn bevorzugt, npm kann abweichende Versionen ziehen)
yarn install

# 3. .env anlegen (siehe Abschnitt 5 für alle Keys)
cp .env.example .env   # falls vorhanden, sonst manuell anlegen
# DATABASE_URL, OPENAI_API_KEY, TMDB_API_KEY, JWT_SECRET sind das Minimum
# zum Starten. R2/RapidAPI/Facebook/VAPID können anfangs leer bleiben —
# die jeweiligen Features werfen dann kontrolliert Fehler/skippen.

# 4. Datenbank-Schema anwenden
npx prisma generate
npx prisma db push          # oder: npx prisma migrate deploy

# 5. Dev-Server starten
yarn dev                    # läuft auf Port 3000

# 6. (Optional) News-Pipeline manuell einmal testen
npx tsx scripts/news-scheduler.ts     # läuft als Endlos-Loop, Strg+C zum Stoppen
# oder einzelnen Artikel:
npx tsx scripts/pipeline-v2.ts "<Artikel-URL>"
```

**Production Build:**
```bash
yarn build      # führt "prisma generate && next build" aus
yarn start
```

**Cron-Jobs (Produktion):** Aktuell laufen die Scheduler in Emergent per
`supervisor` (`/etc/supervisor/conf.d/supervisord.conf`, Prozess
`pipeline-scheduler` → `scripts/news-scheduler.ts`). Bei einem Umzug auf
eigenes Hosting: entweder systemd-Service, Coolify Scheduled Task, oder
klassischer Crontab-Eintrag, der `node_modules/.bin/tsx scripts/news-scheduler.ts`
dauerhaft am Laufen hält (der Scheduler ist selbst eine Endlosschleife mit
`setInterval`, kein einmaliger Cron-Trigger). Details: `docs/CRON_JOBS.md`.

## 7. News-Pipeline — kompletter Ablauf

1. **Scraping** (`scripts/news-scraper.ts`, Funktion `processAllNews`) —
   holt RSS/HTML von 6 Quellen (Deadline, Variety, Hollywood Reporter,
   TVLine, The Cinemaholic, Netflix Tudum). Deduplication gegen bereits
   importierte URLs.
2. **Pro Artikel → `scripts/pipeline-v2.ts` (`runPipelineV2`)**:
   - **Gate-Checks**: Alter (`>6h` → verworfen bei Cron-Trigger),
     `WEAK_HOSTS`-Blockliste (bewusst ausgeschlossene Quellen — Anti-"Helpful
     Content Update"-Maßnahme, aktuell: screenrant.com, collider.com,
     whats-on-netflix.com, tvinsider.com), Film-vs-Serie-Filter.
   - **Klassifikation** (`lib/content-classifier.ts`) — LLM entscheidet
     Relevanz/Kategorie.
   - **Fingerprint-Gate** — Duplikatserkennung gegen bereits existierende
     Artikel zum selben Thema.
   - **Content-Generierung** (`lib/structured-content-generator.ts`) — EIN
     LLM-Call erzeugt: Body (H2-Struktur), Meta-Title/Description, Q&A-Box.
   - **Charakter-Import** (`scripts/generate-character-content.py`) — falls
     die Serie neue/unbekannte Figuren erwähnt, generiert Bios.
   - **Hero-Bild** (`lib/nano-banana-hero.ts`, `gpt-image-1`).
   - **Trailer-Suche** (RapidAPI/yt-dlp, aktuell 403-Fehler siehe Abschnitt 10).
   - **Speichern** in `articles` (Status `published`), Sitemap-Prewarm,
     Facebook-Post, Google-Indexing-Ping.
3. **Scheduler** (`scripts/news-scheduler.ts`) — ruft Schritt 1+2 stündlich
   auf, läuft als Dauerprozess (nicht als klassischer Cron-Einzeltrigger).

## 8. LLM-Integration

Zentral in **`lib/llm-config.ts`** (`getLLMConfig()`):
- Priorität: `OPENAI_API_KEY` (→ Modell `gpt-5.4`, `baseURL: api.openai.com/v1`)
  vor `EMERGENT_LLM_KEY` (→ `claude-sonnet-4-6`, Emergent-Proxy).
- **Wichtig (GPT-5-Familie):** Der Parameter heißt `max_completion_tokens`,
  NICHT `max_tokens` — GPT-5.x lehnt `max_tokens` mit HTTP 400 ab. Alle
  ~10 Call-Sites im Projekt sind bereits korrekt (Aug 2026 gefixt).
  `temperature` funktioniert dagegen normal (kein Reasoning-Modell-Limit).
- Alle LLM-Aufrufe laufen über das Standard-`openai`-SDK (kein
  `response_format`/`tools`/`logprobs` im Einsatz) — JSON wird per
  Regex-Extraktion aus der Textantwort geparst.
- Bild-Generierung: `lib/nano-banana-hero.ts`, Modell `gpt-image-1` (Name
  der Datei ist historisch, hat nichts mit Google Gemini "Nano Banana" zu tun).

## 9. Ad-Stack

- **`app/api/ads/route.ts`** — generiert `ads.txt` (Google AdSense, TheMoneytizer,
  Advertising Alliance/Yieldlab, Primis, Admixer, ~40 SSP-Reseller-Zeilen).
- **Prebid.js** (`lib/prebid-config.ts` — Yieldlab schain-Konfiguration,
  `components/YieldlabFooterSlot.tsx` — Ad-Slot-Komponente).
- **TheMoneytizer** — Header-Bidding-Wrapper + eigener CMP (InMobi Choice,
  Host `themoneytizer.de`) für TCF-2.3-Consent.
- **Primis/Freestar** — Outstream-Video-Ads (`pubfig.min.js` + Slider-Script
  in `app/layout.tsx`).
- **Diagnose-Tools**: `/adtest-direct`, `/adtest-prebid` — Live-Chain-Checks
  gegen `sellers.json` von Advertising Alliance + Yieldlab
  (`app/api/adtest/chain-check/route.ts`).
- **`middleware.ts`** — blockt bekannte Headless/Bot-User-Agents (Ad-Fraud-Schutz).
  ⚠️ Das bedeutet: jeder externe Test (curl, Playwright, Monitoring) MUSS
  einen echten Browser-User-Agent mitschicken, sonst kommt HTTP 204.

## 10. Bekannte offene Punkte / Backlog (Stand Aug 2026)

- **RapidAPI-Trailer-Download**: alle 3 Fallbacks liefern HTTP 403 (Key
  vermutlich abgelaufen/Quota erschöpft). `RAPIDAPI_KEY_BACKUP` ist aktuell
  identisch mit `RAPIDAPI_KEY` — muss durch einen echten Zweit-Key ersetzt
  werden, damit der Fallback überhaupt etwas bringt.
- **Sitemap-Prewarm** (Pipeline Schritt 9) gibt 401 Unauthorized zurück —
  Secret/Header-Mismatch, noch nicht untersucht.
- **`scripts/screenrant-scraper.ts`** ist funktional tot (Quelle in
  `WEAK_HOSTS` geblockt) — bewusst nicht gelöscht, da als Referenz/Blaupause
  belassen, aber NICHT mehr vom Scheduler aufgerufen.
- **Yieldlab liefert dauerhaft `noBid`** trotz nachweislich korrektem
  ads.txt/sellers.json/schain/TCF-Consent (siehe `/adtest-prebid` für
  Live-Diagnose) — vermutlich Floor-Price (50 Cent) oder fehlende Demand
  auf Vermarkter-Seite. Support-Ticket bei Advertising Alliance läuft.
- **Hetzner/Coolify-Migration**: vorbereitet, aber DNS-Cutover von Vercel
  noch nicht durchgeführt. `docs/PIPELINE_SCHEDULER.md`/`CRON_JOBS.md`
  beschreiben die geplanten 9 Coolify Scheduled Tasks.
- **Zwei fehlende R2-Poster** (TMDB-IDs 79744, 1396) — leere Top-10-Kacheln.
- **Freshness-Alarm fehlt**: Falls die News-Pipeline mal wieder tagelang
  keine echten Publishes produziert (ist im Aug 2026 eine Woche unbemerkt
  passiert, siehe `PRD.md`), gibt es aktuell keine automatische Warnung.

## 11. Wichtige Lessons Learned (damit sie nicht wiederholt werden)

1. **`max_tokens` vs. `max_completion_tokens`** — beim Wechsel auf neue
   OpenAI-Modelle (GPT-5.x) immer prüfen, welche Parameter das Modell
   akzeptiert. Ein einzelner falscher Parameter kann 100 % der
   LLM-Aufrufe lautlos scheitern lassen.
2. **Globale npm-Installationen überleben keinen Pod/Server-Neustart** —
   Tools wie `tsx`, die von Cron/Supervisor-Prozessen gebraucht werden,
   IMMER als echte `package.json`-Dependency installieren, nie nur global.
3. **"Kein Fehler" ≠ "Erfolgreich"** — mehrere Scraper-Skripte zählten
   `stats.processed++` allein basierend darauf, dass keine Exception flog,
   auch wenn die Pipeline den Artikel intern (z.B. per `WEAK_HOSTS`-Gate)
   verworfen hat. Erfolg sollte immer per DB-Rückfrage
   (`status: 'published'`) verifiziert werden, nicht per Fehlen eines Errors.
4. **`middleware.ts` blockt Headless-Browser/curl-Standard-UAs** — bei jedem
   externen Monitoring/Testing einen echten Chrome-User-Agent-String
   mitschicken.
5. **Neon Postgres hat gelegentliche Cold-Start-Verzögerungen** (wenige
   Sekunden) bei der ersten Anfrage nach Inaktivität — bei `P1001`-Fehlern
   einmal retry, bevor man einen echten Bug vermutet.

---

Für feature-spezifische Details siehe die weiteren Dateien in `docs/`
(Trailer-System, Pipeline-Refactoring-Historie, Bild-Pipeline etc.) sowie
`PRD.md` im Emergent-Memory-Ordner für die vollständige Produkt-/Bug-Historie.
