# API-Referenz — alle `/api/*`-Routen

Quelle: `app/api/**/route.ts` (90 Route-Dateien, Next.js App Router
Route-Handler). Methoden wurden per `export async function GET/POST/...`
aus dem jeweiligen `route.ts` extrahiert (Stand: Erstellung dieser Doku —
bei Zweifel im Zielfile selbst nachsehen).

## Auth-Konventionen

Drei Auth-Mechanismen sind im Einsatz. Neue geschützte Routen müssen die
zentralen Helfer beziehungsweise die Middleware verwenden:

1. **User-JWT-Cookie** (`lib/auth.ts`, `getCurrentUser`/`requireAuth`):
   liest `auth-token`-Cookie, verifiziert mit `jose.jwtVerify` gegen
   `JWT_SECRET`, lädt User aus `users`-Tabelle. Genutzt von
   User-facing-Routen (`/api/user/*`, `/api/follow`, `/api/articles/*/comments`).
2. **Admin-JWT** — gleiches JWT, signaturgeprüft mit `HS256`; erforderlich
   sind `userId` und `role === 'admin'`. Die Middleware schützt zentral alle
   `/api/admin/*`-Routen außer dem Login. `lib/admin-auth.ts` bietet zusätzlich
   eine Prüfung auf Routenebene.
3. **Cron-Bearer-Secret** (`CRON_SECRET`) — `Authorization: Bearer
   <CRON_SECRET>`; Query-Parameter und fest codierte Ersatzschlüssel werden
   nicht akzeptiert. Die Prüfung erfolgt über `lib/cron-auth.ts` und zusätzlich
   zentral in der Middleware. Ohne Secret antworten Cron-Routen mit 503.

Interne Cache-Invalidierung verwendet davon getrennt `REVALIDATE_SECRET` als
Bearer-Header. `JWT_SECRET` ist ausschließlich ein Signaturschlüssel und darf
nicht direkt als API-Token übertragen werden.

Alle Cron-Endpunkte laufen sonst ohne Session/Cookie (werden von externen
Schedulern wie Vercel Cron / Coolify Scheduled Tasks / Crontab aufgerufen).

## Admin-Routen (`/api/admin/*`)

| Route | Methoden | Zweck |
|---|---|---|
| `admin/adfraud-stats` | GET | Aggregierte Ad-Fraud-Firewall-Statistik (`ad_fraud_blocks_daily`) |
| `admin/ads` | GET, POST, DELETE | CRUD für `ad_slots` (Ad-Platzierungen) |
| `admin/articles` | GET, DELETE | Artikel-Liste/Löschung im Admin |
| `admin/auth/login` | POST | Admin-Login (separat vom User-Login, aber gleiches JWT-Schema mit `role=admin`) |
| `admin/blocklist` | GET, POST, PATCH, DELETE | CRUD für `blocklist_entries` |
| `admin/branding` | GET, POST, DELETE | Branding-Assets/Einstellungen |
| `admin/cleanup-videos` | POST | Löscht nach expliziter Bestätigung nur unverarbeitete YouTube-Queue-Einträge |
| `admin/crawler-stats` | GET | Bot-/Crawler-Statistik-Dashboard-Daten |
| `admin/dashboard` | GET | Haupt-Admin-Dashboard-Aggregation |
| `admin/debug-links` | GET | Interne-Link-Diagnose |
| `admin/discover-dashboard` | GET | Discover-Score-Dashboard (Haupt) |
| `admin/discover-dashboard/recent` | GET | Discover-Score-Dashboard (letzte N Artikel) |
| `admin/discovery-channel-stats` | GET | Statistik nach `discoveryChannel` (RSS/GoogleNews/Tudum/etc.) |
| `admin/facebook` | GET, POST | Facebook-Posting-Verwaltung/manueller Trigger |
| `admin/facebook-status` | GET | Facebook-Token-Gültigkeit/Status-Check |
| `admin/fix-video` | GET, POST | Manuelle Trailer-Reparatur für einzelnen Artikel |
| `admin/force-kill-article` | POST | Artikel hart depublizieren/löschen |
| `admin/global-tags` | GET, POST, DELETE | CRUD für `global_tags` (Ad-/Script-Snippets) |
| `admin/google-indexing-stats` | GET, POST | Google Indexing API Log-Auswertung + manueller Push |
| `admin/hallucination-watch` | GET | `hallucination_log`-Auswertung (Fact-Check-Watchlist) |
| `admin/headline-angles` | GET | Headline-Varianten-Generierung/-Analyse |
| `admin/headline-dashboard` | GET | Headline-A/B-Vergleichs-Dashboard |
| `admin/headline-dashboard/recent` | GET | Dashboard, letzte N Vergleiche |
| `admin/pipeline` | GET, POST | **Manueller Pipeline-Trigger** — POST startet `runPipelineV2` für eine gegebene URL/Quelle |
| `admin/pipeline-health` | GET | Health-Check: letzte `pipeline_runs`, Fehlerquote, Scheduler-Status |
| `admin/pipeline-toggle` | GET, POST | Pipeline global an/ausschalten (liest/schreibt `app_settings`) |
| `admin/purge-empty-series` | GET, POST | Bereinigung von Serien ohne Inhalte |
| `admin/question-radar` | POST | **User-Question-Radar** — LLM-Call, der aktuelle Nutzerfragen/Themen zu einem Topic generiert (schreibt `radar_runs`) |
| `admin/radar/queue` | GET, POST, PATCH, DELETE | CRUD für `content_queue` (Radar → Redaktions-Queue) |
| `admin/rewrite-leaderboard` | GET | Ranking der Headline-Rewrites nach Anti-AI-Score-Delta |
| `admin/seo` | GET, POST | SEO-Crawl-Trigger + Ergebnis-Abruf (`seo_crawl_runs`) |
| `admin/seo-debug` | POST | Einzelseiten-SEO-Debug (ad-hoc) |
| `admin/series` | GET | Serien-Liste im Admin |
| `admin/sitemap-health` | GET | `sitemap_prewarm_log`-Auswertung |
| `admin/tmdb` | GET, POST | TMDB-Lookup/-Sync-Trigger im Admin |
| `admin/trailers` | GET, POST | Trailer-Verwaltung |
| `admin/trailers/backfill` | GET, POST | Batch-Trailer-Nachimport |
| `admin/x-news-stats` | GET | Twitter/X-News-Quellenstatistik (falls X als Quelle genutzt wird) |

## Auth-Routen (`/api/auth/*`)

| Route | Methoden | Zweck |
|---|---|---|
| `auth/login` | POST | User-Login (Email/Passwort → JWT-Cookie) |
| `auth/logout` | POST | Cookie löschen |
| `auth/register` | POST | Neue User-Registrierung |
| `auth/me` | GET | Aktuellen eingeloggten User zurückgeben |
| `auth/google-callback` | POST | OAuth-Callback-Verarbeitung (Google) |
| `auth/google-session` | POST | Session aus Google-OAuth-Ergebnis erstellen |

## Ads / Ad-Tech

| Route | Methoden | Zweck |
|---|---|---|
| `ads` | GET | Generiert `ads.txt` (Rewrite von `/ads.txt` in `next.config.ts`) |
| `ads-tm` | GET | Generiert TheMoneytizer-Variante (Rewrite von `/ads_tm.php`) |
| `ads/slots` | GET | Liefert aktive `ad_slots` an das Frontend (`ClientAdSlot`-Komponente) |
| `adtest/chain-check` | GET | Serverseitiger Sellers.json-Chain-Check gegen Advertising Alliance + Yieldlab (löst Client-CORS-Problem) |

## Content / Öffentliche Daten

| Route | Methoden | Zweck |
|---|---|---|
| `news` | GET | News-Artikel-Liste (Hauptfeed) |
| `news/list` | GET | Alternative/paginierte News-Liste |
| `series` | GET | Serien-Liste |
| `series/popular` | GET | Beliebte Serien (Sortierung nach `popularity`) |
| `series/search` | GET | Serien-Suche |
| `series/[tmdbId]/articles` | GET | Artikel zu einer bestimmten Serie |
| `series/[tmdbId]/follow` | GET, POST | Follow-Status abfragen/setzen (überschneidet sich funktional mit `/api/follow`) |
| `series/[tmdbId]/infobox-data` | GET | Infobox-Daten (Kompaktübersicht) für Serien-Detailseite |
| `series/[tmdbId]/status` | GET | Redaktioneller Status ("läuft"/"abgesetzt" etc.) |
| `articles/[slug]/comments` | GET, POST | Kommentare zu einem Artikel lesen/schreiben |
| `articles/by-followed` | POST | Artikel zu den vom User gefolgten Serien |
| `authors` | GET | Autoren-Liste |
| `authors/for-series` | GET | Autoren, die zu einer Serie geschrieben haben |
| `follow` | POST, DELETE | Serie folgen/entfolgen (User-JWT erforderlich) |
| `qa/generate` | POST, GET | Q&A-Box generieren (LLM-Call) bzw. abrufen |
| `trailer/[...path]` | GET | Trailer-Datei-Proxy/Streaming-Endpoint |

## User-Routen (`/api/user/*`)

| Route | Methoden | Zweck |
|---|---|---|
| `user/followed-series` | GET | Vom eingeloggten User gefolgte Serien |
| `user/my-feed` | GET | Personalisierter Feed |
| `user/onboarding` | POST | Onboarding-Antworten speichern (`favoriteStreamers` etc.) |
| `user/profile` | GET, PATCH | Profil lesen/aktualisieren |

## Push Notifications

| Route | Methoden | Zweck |
|---|---|---|
| `push/subscribe` | GET, POST, DELETE | Web-Push-Subscription verwalten (`push_subscriptions`) |
| `push/send` | POST | Push-Nachricht an alle/gefilterte Subscriptions senden (geschützt via `PUSH_API_SECRET`) |

## Cron-Endpunkte (`/api/cron/*`) — Bearer `CRON_SECRET`

| Route | Methoden | Zweck |
|---|---|---|
| `cron/news` | GET, POST | News-Scrape + Pipeline-Trigger (Alternative zum Dauerprozess-Scheduler — nützlich für Plattformen ohne Long-Running-Process wie reines Vercel-Hosting) |
| `cron/releases` | GET, POST | Streaming-Release-Kalender aktualisieren (`streaming_releases`/`upcoming_episodes`) |
| `cron/tmdb-sync` | GET | TMDB-Metadaten-Sync für bestehende Serien |
| `cron/tmdb-top10` | GET | Top-10-Charts-Sync (`streamer_rankings`) |
| `cron/backfill-streaming-series` | GET | Nachträglicher Import fehlender Serien aus Streaming-Katalogen |
| `cron/downgrade-stale` | GET | Downgrade veralteter Discover-Artikel (Freshness-Gate) |
| `cron/flixpatrol` | GET | FlixPatrol-Charts-Import (falls als Quelle genutzt) |
| `cron/seo` | GET | Periodischer SEO-Crawl-Trigger |
| `cron/trends` | GET, POST | Trending-Topics-Verarbeitung (`trends-processor.ts`) |
| `cron/videos` | GET, POST | Video-Download-Queue abarbeiten |
| `cron/youtube` | GET, POST | YouTube-Channel-Polling + Video-Pipeline |

## Sonstige / Internal / Debug

| Route | Methoden | Zweck |
|---|---|---|
| `health` | GET | Health-Check-Endpoint (für Docker/Coolify/Load-Balancer-Probes) |
| `debug-headers` | GET | Debug: eingehende Request-Header spiegeln |
| `debug/llm-version` | GET | Debug: aktuell konfiguriertes LLM-Modell/Key-Typ anzeigen |
| `indexnow` | POST | IndexNow-Ping an Bing/Yandex bei neuem Content |
| `internal/revalidate` | POST | ISR-Cache-Revalidation für einzelne Pfade |
| `internal/revalidate-sitemap` | POST | Sitemap-Cache-Invalidierung nach Publish (schreibt `sitemap_prewarm_log`) |
| `track/404` | POST, GET | 404-Tracking (welche toten Links werden aufgerufen) |
| `track/adfraud-block` | POST | Fire-and-forget-Log-Endpoint, den `middleware.ts` bei geblockten Bots aufruft (10 % Sampling) |
| `track/crawler` | POST | Crawler-Hit-Tracking (Status: laut Middleware-Kommentaren evtl. nicht mehr aktiv befüllt, siehe `DATA_MODEL.md`) |

## Dynamische Segmente — Hinweise

- `[slug]` in `articles/[slug]/comments` = Artikel-Slug (String, aus `articles.slug`).
- `[tmdbId]` in `series/*` = numerische TMDB-ID (`series.tmdbId`, kein UUID).
- `[...path]` in `trailer/[...path]` = Catch-All für verschachtelte Trailer-Storage-Pfade.

## Öffentliche Seiten (nicht-API, `app/**/page.tsx`)

~91 Seiten insgesamt. Wichtigste Kategorien:

- **Serien-Content**: `serie/[slug]`, `serie/[slug]/wann-geht-es-weiter`,
  `serien`, `serien/genre/[genre]`, `serien/jahrzehnt/[decade]`,
  `serien/streamer/[streamer]`, `serienfinder`, `streamer/[streamer]`,
  `genre/[genre]`, `[slug]` (Legacy-Root-Level, vermutlich Alt-Artikel/Serien
  ohne Präfix).
- **News**: `news`, `news/[filter]`.
- **Personen/Figuren**: `person/[id]`, `personen`, `figur/[slug]`, `figuren`,
  `autor/[slug]`, `autoren`.
- **Streamer-Landingpages** (SEO, ein statisches Template pro Anbieter):
  `netflix-serien`, `disney-plus-serien`, `prime-video-serien`, `hbo-serien`,
  `apple-tv-serien`, `wow-serien`, `joyn-serien`, `maxdome-serien`,
  `paramount-plus-serien`, `discovery-plus-serien`, `crunchyroll-serien`,
  `chili-serien`, `rakuten-tv-serien`, `magenta-tv-serien`,
  `freenet-video-serien`, `rtl-plus-serien`, `zdf-mediathek-serien`,
  `ard-mediathek-serien`.
- **Top-Listen**: `top-10`, `top-100-serien`, `top-100-netflix`,
  `top-100-disney-plus`, `top-100-amazon-prime`, `neue-serien`, `trending`,
  `beste-comedy-serien`, `beste-crime-serien`, `beste-drama-serien`,
  `beste-mystery-serien`, `beste-sci-fi-serien`.
- **Kalender**: `kalender`.
- **User-Bereich**: `einstellungen`, `onboarding`, `auth/callback`.
- **Sonder-Franchise-Seite**: `the-walking-dead`, `in-90-tagen-zum-altar`
  (dedizierte Franchise-/Format-Hubs).
- **Legal**: `impressum`, `datenschutz`, `nutzungsbedingungen`,
  `redaktionelle-richtlinien`.
- **Admin-Frontend** (`admin/*`, ~25 Seiten): `admin` (Dashboard),
  `admin/login`, `admin/articles`, `admin/series`, `admin/pipeline`,
  `admin/pipeline-health`, `admin/question-radar`, `admin/content-queue`,
  `admin/discover`, `admin/discover/[articleId]`, `admin/discover-analytics`,
  `admin/headline-analytics`, `admin/headline-angles`,
  `admin/rewrite-leaderboard`, `admin/ads`, `admin/global-tags`,
  `admin/facebook`, `admin/blocklist`, `admin/branding`, `admin/seo`,
  `admin/seo-debug`, `admin/trailers`, `admin/adfraud`, `admin/errors`,
  `admin/force-kill`, `admin/purge-empty-series`.
- **Ad-Diagnose** (nicht öffentlich verlinkt, nur für manuelles Testing):
  `adtest-direct`, `adtest-prebid`, `adtest-gam`, `adtest-gam-prebid`.

Für die exakte, aktuelle Liste jederzeit selbst generierbar:
```bash
find app -name "page.tsx" -not -path "*/node_modules/*" | sed 's|^app/||; s|/page.tsx||' | sort
```
