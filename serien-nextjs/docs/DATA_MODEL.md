# Datenmodell — vollständige Prisma-Referenz

Quelle der Wahrheit: `prisma/schema.prisma` (43 Modelle, ~925 Zeilen,
PostgreSQL via Neon). Diese Datei fasst jedes Modell mit Zweck, wichtigen
Feldern und Relationen zusammen — bei Widersprüchen gilt immer die
`.prisma`-Datei selbst.

Datasource: `provider = "postgresql"`, `url = env("DATABASE_URL")`,
`directUrl = env("DIRECT_URL")` (siehe `HANDOFF.md` Abschnitt 5 zur
`DIRECT_URL`-Falle). Generator: `prisma-client-js`, `binaryTargets =
["native", "rhel-openssl-3.0.x"]` (wichtig für Docker/Linux-Deploy-Targets).

---

## Content-Kern

### `articles`
Kernprodukt der News-Pipeline. Primärschlüssel `id` (String/UUID), `slug`
unique. Wichtige Felder: `contentHtml` (fertiges HTML), `status`
(`draft`/`published`), `sourceUrl` (unique — verhindert Doppel-Import
derselben Quelle), `sourcePublishedAt`, `publishMode` (Default `DISCOVER`),
`coreEventNormalized` + `storyFingerprint` (Duplikat-Erkennung über
`lib/story-fingerprint.ts` / `lib/duplicate-checker.ts`), `tmdbId` +
`primarySeriesId` (Verknüpfung zur Serie), `wasBedeutetDasText` /
`darumRelevantText` / `bisherigerStandText` (KI-generierte Erklärboxen),
`isBreaking`, `isTrending`, `isRankingArticle`, `heroLocalUrl`/`heroImageUrl`/
`ogImageUrl`/`cardImageUrl` (Bild-Varianten), `confidence` (Klassifikations-
Score), `readingTime`. Relationen: `users` (Autor, Pflicht), `series?`
(optional, über `primarySeriesId`), `article_persons[]`, `article_series[]`,
`comments[]`, `article_qa?` (1:1 Q&A-Box), `discover_audits?`,
`discover_score_dashboards[]`, `headline_comparisons?`. Indizes auf
`primarySeriesId`, `publishedAt`, `slug`, `coreEventNormalized`,
`storyFingerprint`.

### `series`
Serien-Stammdaten, Primärschlüssel ist `tmdbId` (Int, nicht generierte UUID
— direkte TMDB-ID). `slug` unique. TMDB-Sync-Felder: `overview`, `genres[]`,
`networks[]`, `cast`/`crew` (Json), `seasons` (Json), `episodeRunTime[]`,
`numberOfSeasons`/`numberOfEpisodes`, `voteAverage`/`voteCount`,
`inProduction`, `lastAirDate`. Discover/Redaktions-Erweiterungsfelder:
`extendedOverview`, `discoverIntro`, `discoverNewsContext`, `discoverQA`
(Json), `discoverStatus`, `currentStatus`/`statusDescription`/
`statusLastUpdate` (redaktioneller Status-Tracker, z. B. "läuft"/"abgesetzt").
Relationen: `article_series[]`, `articles[]`, `characters[]`, `follows[]`,
`upcoming_episodes[]`.

### `characters`
Serienfiguren mit KI-generierten Bio-Texten. `slug` unique,
`seriesTmdbId` → `series.tmdbId` (Pflicht, Cascade), `actorTmdbId` →
`persons.tmdbId` (optional). Content-Felder: `whoIsContent`,
`roleInSeriesContent`, `importanceContent`, `appearancesContent`, `qaContent`
(Json). `publishStatus` (Default `draft`), `articleMentions` (Zähler, wie oft
in Artikeln erwähnt).

### `persons`
Schauspieler/Personen, `tmdbId` unique, `slug` unique. `biography`/
`biographyEn`, `tvCreditsJson` (Json), `socialLinks` (Json), `enrichedAt`
(letzter TMDB-Enrichment-Zeitpunkt). Relationen: `article_persons[]`,
`characters[]`.

### `article_persons` / `article_series`
Reine M:N-Verknüpfungstabellen (Composite-PK). `article_series` hat
zusätzlich `position` (Sortierreihenfolge, Default 0).

### `article_qa`
1:1 zu `articles` (`articleId` unique). `questions` (Json-Array der
generierten Q&A-Paare), `schemaEnabled` (steuert, ob JSON-LD FAQ-Schema
gerendert wird), `headingType`.

### `discover_audits` / `discover_score_dashboards`
Google-Discover-Optimierungs-Scoring. `discover_audits` ist 1:1 pro Artikel
(`discoverScore`, `passed`, `breakdownJson`, `wordCount`, `hasHero`,
`hasByline`, `freshnessHours`, `aiRiskScore`). `discover_score_dashboards`
ist 1:N (mehrere Snapshots über Zeit möglich), mit granularen Metrik-Objekten
(`headlineMetrics`, `contentMetrics`, `freshnessMetrics`, `imageMetrics`,
`trustMetrics`), `finalVerdict`, `primaryBlockers[]`, `improvementHints[]`.

### `headline_comparisons`
A/B-Tracking für Headline-Rewrites (Anti-AI-Score vor/nach Rewrite).
`status` Default `NO_REWRITE`.

---

## User & Interaktion

### `users`
`email` unique, `password` optional (nullable — z. B. für reinen
Google-OAuth-User ohne Passwort), `role` (Default `"user"`, Wert `"admin"`
für Admin-Zugriff, geprüft in `lib/auth.ts`-Konsumenten via JWT-Payload
`role`). `favoriteStreamers[]`, `expertise[]`, `bio`/`fullBio` (für
Autoren-Profile). Relationen: `articles[]` (als Autor), `comments[]`,
`follows[]`, `notifications[]`.

### `comments`
Threaded Kommentare (`parentId` self-relation `commentsTocomments`).
`status` Default `pending` (Moderation).

### `follows`
Composite-PK `(userId, tmdbSeriesId)` — User folgt einer Serie.

### `notifications`
`type` + `entityId` (polymorph, kein FK), `payloadJson`, `seen` (Boolean).

### `push_subscriptions`
Web-Push-Endpunkte (`endpoint` unique, `p256dh`/`auth` Keys nach W3C Push
API Spec).

---

## Pipeline-Betrieb & Observability

### `pipeline_runs`
Zentrales Log jedes Pipeline-Durchlaufs. `pipeline` (welcher Pipeline-Typ),
`trigger` (Auslöser, z. B. `cron`/`manual`/`replay`), `status`,
`sourcesFound`/`wordsCollected`/`factsExtracted` (Fortschritts-Metriken),
`antiAiScore`, `durationMs`, `errorMessage`/`errorStep`/`debugLog` (Debugging
bei Fehlschlag), `metadata` (String — freies JSON, u. a.
`discoveryChannel`). Indizes auf `articleId`, `pipeline`, `startedAt`,
`status`. **Wichtigste Tabelle für Pipeline-Debugging** — bei "keine News"
zuerst hier nach den letzten Runs und `errorStep` filtern.

### `radar_runs`
User-Question-Radar-Historie (`/api/admin/question-radar`). `topicKey`
(normalisiert, für Cross-Run-Joins), `items` (Json — komplettes Ergebnis-
Array pro Run), `boost` (Flag für "wichtiges Thema").

### `content_queue`
Redaktions-Warteschlange aus dem Radar. `type` (`article`/`reel`/`carousel`/
`faq`/`saved`), diverse Score-Felder (`seoScore`, `discoverScore`,
`socialScore`, `monetizationScore`, `competitionScore`), `status`
(`pending`/`done`/`dismissed`).

### `trending_topics`
Google-Trends-artige Themenfindung. `@@unique([query, date])` — ein Thema
pro Tag. `processed`/`processedAt`/`articleId` verfolgen, ob daraus ein
Artikel wurde.

### `blocklist_entries`
Admin-verwaltete Ausschlussliste für die Pipeline. Matched auf JEDES von:
`tmdbIds[]` (Post-TMDB-Resolve), `urlPatterns[]` (Substring auf Source-URL),
`titleKeywords[]` (Substring auf Titel). `hits`/`lastHitAt` als Zähler für
Wirksamkeits-Tracking.

### `app_settings`
Generischer Key-Value-Store (`key` als PK, `value` als String) für
Feature-Flags/Runtime-Settings, die nicht in `.env` gehören. Gelesen über
`lib/app-settings.ts` (`getBoolSetting`, `SETTINGS`).

### `hallucination_log`
"v5.7 Hallucination Watch" — loggt jeden Fall, in dem der Body-Fact-Verifier
einen Artikel wegen widersprüchlicher Streamer-Behauptung (Quelle behauptet
DE-Verfügbarkeit, TMDB-DE-Provider-Daten widersprechen) blockiert hat. `kind`
(`positive_claim`/`negative_de_claim`), `claimedStreamer`,
`actualDeProviders[]`.

### `sitemap_prewarm_log`
Audit-Log für `/api/internal/revalidate-sitemap`-Aufrufe nach jedem Publish
(Cache-Invalidierung der News-Sitemap). `success`/`statusCode`/
`errorMessage`/`durationMs`. **Bekanntes offenes Problem**: lieferte zuletzt
401 Unauthorized — hier nachsehen für aktuellen Stand.

### `facebook_post_log`
Audit-Log für Auto-Posting neuer Artikel auf Facebook. `trigger`
(`auto`/`manual`).

### `google_indexing_api_logs`
Audit-Log für Google Indexing API Push-Aufrufe (`publish`/`update`/
`manual`), inkl. Roh-Request/-Response für Debugging von Auth-/Quota-
Problemen.

---

## SEO / Crawling

### `seo_crawl_runs` / `seo_page_results`
Interner SEO-Auditor (`/api/admin/seo`). Ein `seo_crawl_runs` (1) hat viele
`seo_page_results` (N). Pro Seite: `statusCode`, `title`, `metaDescription`,
`h1`, `canonical`, `robotsMeta`, `contentHash` (Duplicate-Content-Erkennung),
`hasJsonLd`, `issues` (Json-Array, Default `[]`).

### `crawler_hits`
Rohes Bot-Hit-Logging (`bot`-Name, `path`, `userAgent`, `ip`). Laut
Code-Kommentaren in `middleware.ts` **Stand Feb 2026 deaktiviert** (Middleware
schreibt nicht mehr in `analytics_events`/`crawler_hits`) — Tabelle kann
trotzdem noch Altdaten enthalten, vor Nutzung im Admin-Dashboard prüfen ob
noch befüllt wird.

### `redirects`
Generische Redirect-Tabelle (`fromPath` PK, `toPath`, `type` Default 301).
Ergänzt die statisch in `next.config.ts` gepflegten Redirects.

### `blocked_visitors`
IP-/Fingerprint-basierte temporäre Sperren (`blockKey` unique, `expiresAt`,
`manualWhitelist`-Override).

---

## Analytics (Status prüfen — laut Middleware-Kommentaren teilweise abgeschaltet)

### `analytics_events` / `analytics_sessions`
Eigener Live-Analytics-Tracker (Event-/Session-Ebene: `visitorId`,
`sessionId`, `scrollDepth`, `engagementScore` etc.). **Laut
`middleware.ts`-Kommentar (Feb 2026) deaktiviert** — Cookie-Setzung
(`_ssref`/`_ssrc`) und Server-seitiges Tracking wurden entfernt, weil der
konsumierende Live-Tracker abgestellt wurde. Vor Reaktivierung prüfen, ob
noch ein Frontend-Consumer existiert.

### `ad_fraud_blocks_daily`
Aggregiertes Tages-Log der Ad-Fraud-Firewall aus `middleware.ts`
(`reason` = `hostile-bot-ua` | `high-fraud-country`, mit 10 %-Sampling im
Code). `@@unique([date, reason, country, botUa])` — Upsert-Increment-Pattern,
damit die Zeilenzahl klein bleibt (~50 Zeilen/Tag statt Millionen).

### `social_referrer_daily`
Laut Code-Kommentar in `middleware.ts` **komplett entfernt/deaktiviert**
(Feb 2026) — Modell existiert noch im Schema, wird aber nicht mehr befüllt
(kein Consumer-Endpoint mehr, `/api/track/social-referrer` wurde entfernt).

---

## Streaming-Daten / Kalender

### `streaming_releases`
TMDB-Release-Kalender pro Provider. `@@unique([tmdbId, provider, date])`.
`releaseType` Default `new_episode`.

### `upcoming_episodes`
Kommende Episoden pro Serie (`@@unique([seriesId, seasonNumber,
episodeNumber])`), Quelle für Kalender-/Reminder-Features.

### `streamer_rankings`
Tägliche Top-10-Snapshots pro `(platform, country, type, date, rank)`
(unique). Ermöglicht Trend-Berechnung (Rang-Delta Woche-über-Woche).
`tmdbMatched` zeigt, ob die externe Chart-Zeile gegen die lokale `series`-
Tabelle aufgelöst werden konnte; `posterPath`/`backdropPath` sind ein
opportunistischer Cache für den Fall, dass die Serie lokal noch nicht
onboardet ist.

---

## Trailer / YouTube

### `youtube_channels` / `youtube_videos`
Channel-Tracking (`checkInterval` in Minuten) + einzelne Videos
(`processed`/`processedAt`/`articleId` verknüpfen Video → generierter
Artikel, `transcript` für LLM-Verarbeitung).

### `video_download_queue`
Download-Warteschlange für Trailer (`status`, `attempts`/`maxAttempts`,
`lastError`, `priority`). Ein Eintrag pro `articleId` (unique).

---

## Ads / Monetarisierung

### `ad_slots`
Konfigurierbare Ad-Platzierungen. `@@unique([position, device])` — dieselbe
logische Position (`position`, z. B. `below_intro`) kann für `mobile` und
`desktop` komplett unterschiedlich konfiguriert sein. `provider`
(`adsense`-Legacy-Wert existiert noch im Schema, wird aber laut
`/app/memory/PRD.md` nicht mehr aktiv unterstützt — nur noch `custom`).
`customHtmlJson` (Text) enthält ein JSON-Array von Varianten
(`{label, html, weight, isActive}`) für Rotation (`rotationMode`:
`random`/`weighted`/`first`).

### `global_tags`
Freie HTML/Script-Snippets, die nur auf Artikelseiten gerendert werden
(`placement`: `head`/`body-start`/`body-end`), z. B. TheMoneytizer-Loader,
Header-Bidding-Wrapper. `hideFromBots` (Default true) filtert bekannte
Such-Bots vor dem Rendering, damit sie keine paid Creatives im Snapshot
sehen. `sortOrder` für Mehrfach-Tags am selben Placement.

---

## Tabellen-Index (alle 43 Modelle)

`ad_fraud_blocks_daily`, `ad_slots`, `analytics_events`, `analytics_sessions`,
`app_settings`, `article_persons`, `article_qa`, `article_series`, `articles`,
`blocked_visitors`, `blocklist_entries`, `characters`, `comments`,
`content_queue`, `crawler_hits`, `discover_audits`,
`discover_score_dashboards`, `error_logs`, `facebook_post_log`, `follows`,
`global_tags`, `google_indexing_api_logs`, `hallucination_log`,
`headline_comparisons`, `notifications`, `persons`, `pipeline_runs`,
`push_subscriptions`, `radar_runs`, `redirects`, `series`,
`sitemap_prewarm_log`, `social_referrer_daily`, `streamer_rankings`,
`streaming_releases`, `trending_topics`, `upcoming_episodes`, `users`,
`video_download_queue`, `youtube_channels`, `youtube_videos`.

(`error_logs`: generisches Fehler-Log — `type`, `path`, `referrer`,
`userAgent`, `metadata` — nicht ausführlich dokumentiert, da generisch/
selbsterklärend über Feldnamen.)

## Praktische Hinweise für Migrationen

```bash
npx prisma generate       # Client neu generieren nach Schema-Änderung
npx prisma db push        # Schema direkt anwenden (Dev/kein Migration-Verlauf)
npx prisma migrate deploy # Produktions-sicher, nutzt prisma/migrations/-Historie
```

`generator client` setzt `binaryTargets = ["native", "rhel-openssl-3.0.x"]`
— wichtig, falls das Docker-Image von Alpine/Debian abweicht (z. B. bei
Coolify/Hetzner-Deploy mit anderem Base-Image muss ggf. ein weiterer Target
ergänzt werden, sonst schlägt `PrismaClient` zur Laufzeit mit einem
Binary-Mismatch-Fehler fehl).
