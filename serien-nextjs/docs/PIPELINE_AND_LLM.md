# News-Pipeline & LLM-Integration — vollständige Referenz

## 1. Prozess-Architektur

Die Pipeline läuft **nicht** als klassischer Einzel-Cron-Trigger, sondern
als **Dauerprozess** (Node-Skript mit `setInterval`), verwaltet vom
Supervisor:

```ini
[program:pipeline-scheduler]
command=/app/serien-nextjs/node_modules/.bin/tsx /app/serien-nextjs/scripts/news-scheduler.ts
directory=/app/serien-nextjs
environment=PATH="<venv-pfade>:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",NODE_ENV="production"
autostart=true
autorestart=true
```

⚠️ **Kritische Supervisor-Falle**: Ein `[program:x]`-Block darf nur **eine**
`environment=`-Zeile haben. Wird versehentlich eine zweite Zeile ergänzt
(z. B. bei einem späteren PATH-Fix), gewinnt nur die letzte — die erste wird
stillschweigend verworfen, ohne Fehler. Immer alle Variablen eines Prozesses
in einer Zeile zusammenfassen. Nach jeder Supervisor-Config-Änderung:
`supervisorctl reread && supervisorctl update`, dann Log prüfen (`tail -f
/var/log/supervisor/pipeline-scheduler.log`).

Alternative für Plattformen ohne Dauerprozess (z. B. reines Vercel-Hosting
ohne Background-Worker): `/api/cron/news` als klassischer HTTP-Cron-Endpoint
(Bearer `CRON_SECRET`), der denselben `processAllNews()`-Pfad aufruft.

## 2. Ablauf im Detail

### Schritt 1 — Scraping (`scripts/news-scraper.ts`, Funktion `processAllNews`)

Holt RSS/HTML von den Default-Quellen: **Cinemaholic, Deadline, Variety,
Hollywood Reporter, Netflix Tudum, TVLine, Google News (Streaming-Suche)**.
Dedupliziert gegen bereits importierte `sourceUrl`-Werte (unique constraint
in `articles`). Optionen: `limit` (max. Artikel pro Lauf), `dryRun`,
`onlyNew` (nur Artikel, die noch nicht in der DB sind).

⚠️ **Historischer Bug (behoben)**: `screenrant-scraper.ts` wurde früher vom
Scheduler aufgerufen, aber `screenrant.com` steht in `WEAK_HOSTS` (Schritt 2)
— jeder Lauf wurde lautlos komplett geblockt, meldete aber fälschlich
`processed: 1`, weil die Erfolgszählung nicht auf einem echten DB-Check
basierte. `news-scheduler.ts` ruft seitdem ausschließlich `processAllNews()`
auf. `screenrant-scraper.ts` bleibt im Repo als Referenz, wird aber vom
Scheduler nicht mehr genutzt.

### Schritt 2 — Pro Artikel: `scripts/pipeline-v2.ts` (`runPipelineV2`)

Die Kern-Orchestrierung (3185 Zeilen). Reihenfolge der Gate-Checks und
Verarbeitungsschritte (siehe Imports am Dateianfang für alle beteiligten
`lib/*`-Module):

1. **Alters-Gate**: bei Cron-Trigger werden Quellen `>6h` alt verworfen.
2. **`WEAK_HOSTS`-Blockliste** (`lib/series-blocklist.ts` bzw. Konstante in
   `pipeline-v2.ts`) — bewusst ausgeschlossene Quellen als Anti-"Helpful
   Content Update"-Maßnahme. Aktuell (Stand letzter bekannter Code-Stand):
   `screenrant.com`, `collider.com`, `whats-on-netflix.com`,
   `tvinsider.com`. Vor Erweiterung der Quellenliste immer prüfen, ob eine
   neue Quelle hier ausgeschlossen ist.
3. **Blocklist-Check** gegen `blocklist_entries` (Admin-gepflegt, DB-basiert
   — anders als `WEAK_HOSTS`, das hardcodiert ist).
4. **Film-vs-Serie-Filter**, **Genre-Filter** (`lib/genre-filter.ts`),
   **US-Corporate-News-Filter** (`lib/us-corporate-news-filter.ts` — blockt
   US-Börsen-/Konzernmeldungen wie Quartalszahlen, selbst wenn ein
   DACH-Streamer im Titel als Aufhänger steht), diverse weitere strukturelle
   Sperren (`show-age-cutoff`, `us-daytime-talk-brands`,
   `unreleased-project-filter`, `sammel-recap-detector` — siehe
   `next.config.ts`-Redirect-Kommentare für historische Beispiel-Artikel,
   die diese Filter nachträglich ausgelöst haben).
5. **DACH-Verfügbarkeits-Check** (`lib/dach-availability.ts`, `checkDachAvailability`).
6. **Klassifikation** (`lib/content-classifier.ts`, `classifyContent`,
   `shouldSkipArticle`) — LLM-Call, entscheidet Relevanz/Kategorie.
7. **Fingerprint-/Duplikat-Gate** (`lib/duplicate-checker.ts`,
   `lib/story-fingerprint.ts`) — verhindert mehrere Artikel zum exakt
   gleichen Ereignis.
8. **Fakten-Extraktion** (`lib/fact-extractor.ts`, `lib/reporters-notebook.ts`,
   `lib/full-text-fetcher.ts`) — holt den vollen Quelltext + strukturierte
   Fakten.
9. **Content-Generierung** (`lib/structured-content-generator.ts`,
   `generateStructuredContent`) — **ein** LLM-Call erzeugt Body
   (H2-Struktur, Markdown), Meta-Title/Description, Q&A-Box zusammen.
10. **Übersetzung/Treue-Check** (`lib/faithful-translator.ts`) — stellt
    sicher, dass die deutsche Fassung inhaltlich zur Quelle passt.
11. **Fact-Safety-Layer** (`lib/fact-safety-layer.ts`, `factSafetyCheck`) —
    Hallucination-Check gegen TMDB-DE-Provider-Daten (schreibt bei Treffer
    in `hallucination_log`).
12. **Charakter-/Cast-Linking** (`lib/character-linking-markdown.ts`,
    `lib/cast-linking-markdown.ts`, `scripts/import-characters.ts`,
    `lib/cast-importer.ts`) — verlinkt erwähnte Figuren/Schauspieler, ggf.
    Import neuer Charaktere.
13. **Charakter-Bio-Generierung** (`scripts/generate-character-content.py`,
    **Python**, eigener OpenAI-Call) — falls neue/unbekannte Figuren erwähnt
    werden.
14. **Markdown → HTML** (`lib/markdown-to-html.ts`), **interne Verlinkung**
    (`lib/internal-linking-engine.ts`), **Quellen-Embeds**
    (`lib/source-embeds.ts`).
15. **Qualitäts-/Anti-AI-Checks** (`lib/quality-checker.ts`,
    `lib/anti-ai-filter.ts`) und **Discover-Gate** (`lib/discover-gate.ts`,
    schreibt `discover_audits`/`discover_score_dashboards`). Bei Score
    `<60`: Auto-Retry mit niedrigerer `temperature`.
16. **Erklärboxen** (`lib/was-bedeutet-das.ts`) — generiert
    `wasBedeutetDasText`, `darumRelevantText`, `bisherigerStandText`.
17. **Hero-Bild** (`lib/nano-banana-hero.ts`, Modell `gpt-image-1`),
    **Bild-Upload** (`lib/blob-uploader.ts`, R2/Blob), Backdrop-Auswahl
    (`lib/tmdb-backdrops.ts`).
18. **Trailer-Suche** (`lib/trailer-downloader.ts`,
    `findTrailerYouTubeId`/`downloadYouTubeTrailer`/
    `searchYouTubeTrailerViaAPI`, RapidAPI-basiert — bekanntes Backlog-
    Problem: HTTP 403 bei allen 3 Fallbacks, siehe `OPERATIONS_RUNBOOK.md`).
19. **Zeitachsen-Korrektur** (`lib/time-axis-correction.ts`,
    `classifyContentAge`, `shouldPublishBasedOnAge`,
    `neutralizeOldContentHeadline`) — verhindert, dass alte Ereignisse als
    "News" präsentiert werden.
20. **Speichern** in `articles` (Status `published`), Autor-Rotation über
    `EDITORIAL_AUTHORS`-Array (11 feste Autoren-IDs, zufällig gewählt via
    `getRandomAuthor()`).
21. **Nachbearbeitung**: Sitemap-Prewarm
    (`/api/internal/revalidate-sitemap`, schreibt `sitemap_prewarm_log`),
    Facebook-Post (`lib/facebook-poster.ts`, schreibt `facebook_post_log`),
    Google-Indexing-Ping (`lib/google-indexing.ts`), IndexNow
    (`lib/indexnow.ts`).

Jeder Lauf wird in `pipeline_runs` protokolliert (Status, Timing,
`errorStep`/`errorMessage` bei Fehlschlag) — **erster Anlaufpunkt für
Debugging**, siehe `OPERATIONS_RUNBOOK.md`.

### Schritt 3 — Scheduler-Loop (`scripts/news-scheduler.ts`)

```
Startup → runNewsImport() sofort einmal
        → setInterval(runNewsImport, NEWS_INTERVAL_HOURS Stunden)
```

Env-Variablen: `NEWS_INTERVAL_HOURS` (Default `1`), `NEWS_LIMIT` (Default
`5`, Artikel pro Lauf). Schreibt zusätzlich ein eigenes Textlog nach
`logs/news-scheduler.log` (relativ zum CWD des Prozesses).

## 3. LLM-Konfiguration — zentral in `lib/llm-config.ts`

```ts
export function getLLMConfig() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.EMERGENT_LLM_KEY;
  const isEmergentKey = apiKey.startsWith('sk-emergent-');
  return {
    apiKey,
    baseURL: isEmergentKey ? 'https://integrations.emergentagent.com/llm' : 'https://api.openai.com/v1',
    model: isEmergentKey ? 'claude-sonnet-4-6' : 'gpt-5.4',
  };
}
```

- **Priorität**: eigener `OPENAI_API_KEY` (→ Modell-String `gpt-5.4`, direkt
  gegen `api.openai.com`) vor `EMERGENT_LLM_KEY` (→ `claude-sonnet-4-6`,
  läuft NUR innerhalb der Emergent-Plattform über deren Proxy — funktioniert
  nach einem Umzug auf eigenes Hosting **nicht mehr**, reiner Fallback für
  den Fall, dass `OPENAI_API_KEY` fehlt).
- Alle Content-generierenden Module (`content-classifier.ts`,
  `structured-content-generator.ts`, `was-bedeutet-das.ts`,
  `heading-generator.ts`, `duplicate-checker.ts`, `seo-auditor.ts`,
  `faithful-translator.ts`, `generate-person-bios.ts`,
  `generate-author-full-bios.ts`, `generate-series-overviews.ts`,
  `generate-characters.ts`, sowie `app/api/debug/llm-version/route.ts` und
  `app/api/admin/question-radar/route.ts`) importieren diese zentrale
  Konfiguration — **nie** einen Modellnamen oder Base-URL hardcodiert an
  anderer Stelle einbauen.
- `parseLLMJson()` — robustes JSON-Parsing für LLM-Antworten (kein
  natives `response_format: json_object` im Einsatz). Behandelt
  Markdown-Codeblöcke, deutsche Anführungszeichen (`„`, `"`), Kontrollzeichen.
- Bild-Generierung getrennt in `lib/nano-banana-hero.ts` — Modell
  `gpt-image-1`, eigener OpenAI-Key. Der Dateiname ist historisch bedingt
  (frühere Version nutzte Gemini "Nano Banana"); hat funktional nichts mehr
  mit Google/Gemini zu tun.
- `scripts/generate-character-content.py` (Python) hat eine **eigene**,
  separate OpenAI-Client-Initialisierung (nicht über `llm-config.ts`, da
  TypeScript-Modul) — bei Key-Rotation **zusätzlich** hier prüfen.

## 4. GPT-5-Familie — kritische Besonderheit

**`max_tokens` wird von GPT-5.x abgelehnt (HTTP 400).** Der korrekte
Parameter heißt **`max_completion_tokens`**. `temperature` funktioniert
weiterhin normal (kein Reasoning-Modell-Limit wie bei o1/o3). Dieser Fehler
blockierte beim Umstieg auf `gpt-5.4` einmal **100 % der Content-
Generierung**, bis er in allen betroffenen Call-Sites gefixt wurde
(betroffen waren u. a. `structured-content-generator.ts`,
`duplicate-checker.ts`, `seo-auditor.ts`, `faithful-translator.ts`,
`generate-person-bios.ts`, `generate-author-full-bios.ts`,
`generate-series-overviews.ts`, `generate-characters.ts`, sowie die beiden
o.g. API-Routen). **Bei jedem zukünftigen Modell-Upgrade (GPT-6, neue
Reasoning-Modelle etc.) zuerst die OpenAI-Parameter-Kompatibilität für das
neue Modell prüfen**, bevor ein Modellnamen-Wechsel gemacht wird — ein
falscher Parameter lässt den Fehler lautlos in Retries verschwinden
(3 Versuche mit Backoff, siehe Retry-Logs unten), nicht sofort als
offensichtlicher Crash.

## 5. Bekannte Fehlerbilder & wie man sie erkennt

### OpenAI 429 "no credits remaining"
Log-Beispiel (Klassifikations-Schritt, mit Retry-Logik):
```
⚠️  Classifier attempt 2/3 failed: 429 You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/. — retry in 4000ms
```
→ **Kein Code-Fehler.** Bedeutet: OpenAI-Konto-Guthaben ist aufgebraucht.
Betrifft **jeden** LLM-Call in der Pipeline (Klassifikation ist meist der
erste LLM-Call, daher meist der erste sichtbare Fehler). Lösung: Guthaben im
OpenAI-Billing-Dashboard aufladen. Danach: Scheduler-Prozess neu anstoßen
(oder auf nächsten `setInterval`-Tick warten) und `pipeline_runs` auf
frische `status: 'completed'`-Einträge prüfen.

### `tsx: not found`
```
sh: 1: tsx: not found
```
→ Globale `npm install -g tsx` überlebt keinen Server-/Pod-Neustart. Fix:
`tsx` als echte `devDependency` via `yarn add -D tsx`, Supervisor-Command auf
`node_modules/.bin/tsx` zeigen lassen (bereits so konfiguriert, siehe
Abschnitt 1 — falls der Fehler wieder auftritt: prüfen, ob `node_modules`
komplett fehlt, z. B. nach Volume-Reset, dann `yarn install` erneut nötig).

### Kein neuer Artikel trotz laufendem Scheduler
Erste Anlaufstelle: `pipeline_runs`-Tabelle nach den letzten Einträgen
filtern (`ORDER BY startedAt DESC`). `status`/`errorStep`/`errorMessage`
zeigen exakt, an welchem der ~21 Schritte aus Abschnitt 2 der Lauf
gescheitert ist. **Nicht** allein auf Scheduler-Log-Zeilen wie "processed: N"
vertrauen — das zählt nur, ob eine Exception geworfen wurde, nicht, ob
wirklich publiziert wurde (siehe Lessons Learned in `HANDOFF.md`).

### `PrismaClientKnownRequestError` Code `P1001`
Transiente Neon-Cold-Start-Verzögerung. Einmal retryen, bevor man einen
echten DB-Ausfall vermutet.

## 6. Sonstige LLM-nutzende Skripte außerhalb der Kernpipeline

- `scripts/p3-trends.ts`, `scripts/demo-ende-erklaert.mjs` — nutzen ebenfalls
  `gpt-5.4` (früher `gpt-4o`, mit umgestellt).
- `scripts/generate-author-bios.ts`, `generate-author-full-bios.ts`,
  `generate-person-bios.ts`, `generate-series-overview(s).ts`,
  `generate-characters.ts` — Batch-/Backfill-Generatoren, laufen manuell via
  `tsx`, nicht Teil des automatischen Schedulers.
- `scripts/optimize-headline.ts`, `scripts/batch-rewrite-scorereveal.ts` —
  Headline-Rewrite-Tools (füllen `headline_comparisons`).
