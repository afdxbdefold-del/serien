# Lokales Setup & Plattform-Migration

## 1. Lokales Setup von Null

**Voraussetzungen**: Node.js 20+, Python 3.11+ (für
`scripts/generate-character-content.py` und einige `.py`-Backfill-Skripte),
Yarn (nicht npm — abweichende Lockfile-Auflösung kann zu Versionskonflikten
führen), Zugriff auf ein Neon-Postgres-Projekt (oder eine beliebige
Postgres-14+-Instanz).

```bash
# 1. Repository klonen
git clone <repo-url> serien-nextjs
cd serien-nextjs

# 2. Dependencies installieren
yarn install
# postinstall-Hook führt automatisch `prisma generate` aus

# 3. .env anlegen — siehe HANDOFF.md Abschnitt 5 für die vollständige
#    Variablen-Liste (Namen + Zweck, keine Werte)
touch .env
# Minimum zum Starten: DATABASE_URL, OPENAI_API_KEY, TMDB_API_KEY, JWT_SECRET,
# NEXT_PUBLIC_BASE_URL
# R2/RapidAPI/Facebook/VAPID/GOOGLE_SERVICE_ACCOUNT_JSON können anfangs leer
# bleiben — die jeweiligen Features werfen dann kontrolliert Fehler oder
# skippen den Schritt, statt den Build zu blockieren.
# WICHTIG: prisma/schema.prisma referenziert zusätzlich DIRECT_URL
# (directUrl) — für reinen Query-Betrieb nicht zwingend nötig, aber vor
# `prisma migrate` (nicht `db push`) ergänzen, sonst schlägt der Befehl fehl.

# 4. Datenbank-Schema anwenden
npx prisma generate
npx prisma db push          # Dev/schneller Weg, kein Migrations-Verlauf
# oder für einen Weg mit Migrations-Historie:
npx prisma migrate deploy

# 5. Dev-Server starten
yarn dev                    # Port 3000

# 6. (Optional) News-Pipeline manuell testen
npx tsx scripts/news-scheduler.ts       # Endlos-Loop, Strg+C zum Stoppen
# oder einzelnen Artikel gezielt durch die Pipeline schicken:
npx tsx scripts/pipeline-v2.ts "<Artikel-URL>"
```

**Production Build:**
```bash
yarn build      # führt "prisma generate && next build" aus
yarn start
```

`next.config.ts` hat `output: 'standalone'` gesetzt — erzeugt
`.next/standalone/` mit minimaler `node_modules`-Kopie, gedacht für
Docker-Deployment (deutlich kleineres Image als volles `node_modules`).

## 2. Erststart-Checkliste (was beim ersten Mal typischerweise fehlt)

1. **Admin-User anlegen** — es gibt `scripts/create-admin.js` als
   Ausgangspunkt (Skript vor Nutzung öffnen und Felder/Passwort-Hashing
   gemäß `lib/auth.ts`-Konventionen prüfen, `bcryptjs` wird für
   Passwort-Hashes genutzt).
2. **TMDB-Grunddaten importieren** — die `series`-Tabelle ist zu Beginn
   leer. Import-Skripte: `scripts/import-series.ts`,
   `scripts/import-top-series.ts`, `scripts/import-latest-series.ts`.
   Ohne Serien in der DB kann die Pipeline keine `primarySeriesId`/
   `article_series`-Verknüpfung herstellen.
3. **Ad-Slots seeden** (optional, nur falls Ads sofort getestet werden
   sollen) — `scripts/seed-news-ad-slots.mjs`,
   `scripts/seed-above-recommended.mjs`,
   `scripts/seed-below-breadcrumb-slot.ts`.
4. **`CRON_SECRET` setzen**, falls Cron-Endpunkte (`/api/cron/*`) statt des
   Dauerprozess-Schedulers genutzt werden sollen — siehe
   `OPERATIONS_RUNBOOK.md` zu den hardcodierten Fallback-Secrets, die vor
   einem Produktions-Rollout entfernt werden sollten.

## 3. Deployment-Optionen

### Docker / Coolify / beliebiger Container-Host
`Dockerfile` und `.dockerignore` liegen im Repo-Root (`serien-nextjs/`).
Multi-Stage-Build mit `output: 'standalone'`. Wichtige historische
Dockerfile-Falle: Der `deps`-Stage muss `NODE_ENV=development` UND
`yarn install --production=false` erzwingen, sonst überspringt ein von der
Plattform injiziertes `NODE_ENV=production` beim Install die
`devDependencies` (u. a. `tailwindcss`, `postcss`, `autoprefixer`,
`typescript`), was den Next.js-Build zum Absturz bringt (fehlende
Build-Zeit-Pakete).

Zusätzliche Referenzdateien (falls im Repo vorhanden, sonst als Vorlage
neu erstellen): `HETZNER_MIGRATION_GUIDE.md`, `HOSTING_COST_COMPARISON.md`
im Repo-Root — vor Nutzung prüfen, ob sie noch existieren und aktuell sind.

`prisma/schema.prisma` setzt `binaryTargets = ["native",
"rhel-openssl-3.0.x"]` — falls das Ziel-Docker-Image ein anderes Basis-Image
nutzt (z. B. Alpine/musl statt glibc), muss ggf. ein weiterer
Prisma-Binary-Target ergänzt werden, sonst schlägt `PrismaClient` zur
Laufzeit mit einem Binary-Mismatch fehl.

### Vercel
`next.config.ts`-Rewrites (`ads.txt`, `ads_tm.php`, `adtest-*.html`) und
Redirects funktionieren unverändert auf Vercel. **Wichtige Einschränkung**:
Vercel hat keine Dauerprozesse — der `news-scheduler.ts`-Ansatz
(`setInterval`-Loop) funktioniert dort NICHT. Auf Vercel muss stattdessen
Vercel Cron (`vercel.json` → `/api/cron/news` mit `CRON_SECRET`) genutzt
werden. Siehe `docs/CRON_JOBS.md` für ein Beispiel-`vercel.json` sowie
alternative systemd-Timer-Konfiguration für einen klassischen Linux-Server.

### Systemd (klassischer Linux-Server ohne Coolify/Docker)
Siehe `docs/CRON_JOBS.md` für Beispiel-Unit-/Timer-Dateien für periodische
Jobs (Serien-Status-Update, Trailer-Cleanup). Für den News-Scheduler selbst
(Dauerprozess statt periodischer Timer) ist ein einfacher
`systemd.service`-Eintrag mit `Restart=always` passender als ein Timer:

```ini
[Unit]
Description=serien.de News Pipeline Scheduler
After=network.target

[Service]
Type=simple
WorkingDirectory=/pfad/zu/serien-nextjs
ExecStart=/pfad/zu/serien-nextjs/node_modules/.bin/tsx scripts/news-scheduler.ts
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 4. Secrets-Migration (Plattform-Wechsel)

Beim Wechsel von Emergent (oder jeder anderen Plattform) auf eigenes
Hosting: **niemals** Secrets im Klartext in Doku/Chat/Commits übertragen.
Vorgehen:

1. Zielumgebung (Coolify-App-Settings, `.env`-Datei auf dem Zielserver,
   Docker-Secrets, o. ä.) mit der vollständigen Variablen-Liste aus
   `HANDOFF.md` Abschnitt 5 vorbereiten (Namen bekannt, Werte müssen aus dem
   jeweiligen Provider-Dashboard neu geholt oder aus dem sicheren
   Passwort-Manager der alten Umgebung übertragen werden).
2. `EMERGENT_LLM_KEY` wird auf einer neuen, Nicht-Emergent-Plattform generell
   **nicht mehr funktionieren** (Proxy ist plattformgebunden) — sicherstellen,
   dass `OPENAI_API_KEY` gesetzt ist, sonst schlägt jeder LLM-Call fehl.
3. `DATABASE_URL`/`DIRECT_URL` (Neon) funktionieren plattformunabhängig,
   solange die Zielumgebung Internet-Zugriff auf Neon hat — keine Migration
   nötig, nur die Connection-String muss in der neuen Umgebung als Secret
   vorhanden sein.
4. `NEXT_PUBLIC_BASE_URL` auf die neue Produktions-Domain aktualisieren
   (betrifft Sitemap, kanonische URLs, Social-Meta-Tags, Redirect-Logik in
   `middleware.ts`).
5. `CRON_SECRET` neu generieren, wenn von Dauerprozess-Scheduler auf
   Cron-Endpunkte gewechselt wird (z. B. Wechsel Coolify → Vercel) — und die
   in `OPERATIONS_RUNBOOK.md` erwähnten hardcodierten Fallback-Strings aus
   dem Code entfernen.

## 5. Nach der Migration — Verifikations-Checkliste

- [ ] `yarn build` läuft ohne Fehler durch (inkl. `prisma generate`)
- [ ] `/api/health` liefert HTTP 200
- [ ] Ein Test-Login (Admin) funktioniert (`/admin/login`)
- [ ] Ein manueller Pipeline-Trigger (`POST /api/admin/pipeline` oder `npx
      tsx scripts/pipeline-v2.ts "<URL>"`) erzeugt einen echten Artikel mit
      `status='published'`
- [ ] `news-scheduler.ts`-Prozess läuft dauerhaft (Supervisor/systemd-Status)
      ODER `/api/cron/news` ist per externem Scheduler erreichbar
- [ ] `ads.txt` und `ads_tm.php`-Route liefern die erwarteten Zeilen
- [ ] `/adtest-prebid` zeigt einen grünen Chain-Check
- [ ] Ein externer curl-Test mit echtem Browser-User-Agent bekommt HTTP 200
      (nicht 204 durch die Ad-Fraud-Firewall in `middleware.ts`)
