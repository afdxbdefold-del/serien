# Lokales Setup & Plattform-Migration

## 1. Lokales Setup von Null

**Voraussetzungen**: Node.js 20+, Python 3.11+ (für
`scripts/generate-character-content.py` und einige `.py`-Backfill-Skripte),
`npm` gemäß `packageManager` und `package-lock.json`, Zugriff auf eine
PostgreSQL-14+-Instanz. Produktion verwendet
PostgreSQL 17 als eigenen Coolify-Service auf Hetzner; Neon wird nicht
verwendet.

```bash
# 1. Repository klonen
git clone <repo-url> serien-nextjs
cd serien-nextjs

# 2. Dependencies reproduzierbar installieren
npm ci
# postinstall-Hook führt automatisch `prisma generate` aus

# 3. .env anlegen — .env.example ist die vollständige wertfreie Liste;
#    HANDOFF.md Abschnitt 5 erklärt die betriebsrelevante Auswahl
touch .env
# Minimum zum Starten: DATABASE_URL, OPENAI_API_KEY, TMDB_API_KEY, JWT_SECRET,
# NEXT_PUBLIC_BASE_URL
# R2/RapidAPI/Facebook/VAPID/GOOGLE_SERVICE_ACCOUNT_JSON können anfangs leer
# bleiben — die jeweiligen Features werfen dann kontrolliert Fehler oder
# skippen den Schritt, statt den Build zu blockieren.
# WICHTIG: prisma/schema.prisma referenziert zusätzlich DIRECT_URL
# (directUrl). Für Prisma-CLI-Schritte beide URLs auf dieselbe lokale oder
# isolierte Entwicklungsdatenbank setzen. Niemals Produktionswerte verwenden.

# 4. Nur auf einer leeren, entbehrlichen Entwicklungsdatenbank:
npx prisma generate
npx prisma db push          # Dev/schneller Weg, kein Migrations-Verlauf
# Die eingecheckte Migrationshistorie ist keine vollständige Baseline.
# `prisma migrate deploy` deshalb auch lokal erst nach Baseline-Arbeit nutzen.

# 5. Dev-Server starten
npm run dev                 # Port 3000

# 6. (Optional) News-Pipeline manuell testen
npx tsx scripts/news-scheduler.ts       # Endlos-Loop, Strg+C zum Stoppen
# oder einzelnen Artikel gezielt durch die Pipeline schicken:
npx tsx scripts/pipeline-v2.ts "<Artikel-URL>"
```

**Production Build:**
```bash
npm run build   # führt "prisma generate && next build" aus
npm run start
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
4. **`CRON_SECRET` setzen**, wenn Cron-Endpunkte (`/api/cron/*`) genutzt
   werden. Das ist der aktuelle Produktionspfad. Alle Coolify-Tasks müssen
   denselben Wert ausschließlich per Bearer-Header erhalten; nie in URL oder
   Log schreiben.

## 3. Deployment-Optionen

### Docker / Coolify / beliebiger Container-Host
`Dockerfile` und `.dockerignore` liegen im Repo-Root (`serien-nextjs/`).
Multi-Stage-Build mit `output: 'standalone'`. Wichtige historische
Dockerfile-Falle: Der `deps`-Stage muss `NODE_ENV=development` setzen und bei
`npm ci` die Dev-Dependencies einschließen, sonst überspringt ein von der
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
3. `DATABASE_URL` und `DIRECT_URL` sind provider- und netzwerkspezifisch.
   Produktion verwendet eine private Verbindung zum Coolify-PostgreSQL-
   Service; `DIRECT_URL` war in der verifizierten App-Konfiguration nicht
   vorhanden. Bei einem Plattformwechsel die Datenbank separat per
   konsistentem Dump/Restore migrieren und beide Verbindungen in der
   Zielumgebung prüfen. Niemals eine Produktions-URL blind weiterverwenden.
4. `NEXT_PUBLIC_BASE_URL` auf die neue Produktions-Domain aktualisieren
   (betrifft Sitemap, kanonische URLs, Social-Meta-Tags, Redirect-Logik in
   `middleware.ts`).
5. Bei einer Rotation von `CRON_SECRET` Anwendung und alle Coolify-Tasks
   koordiniert aktualisieren und danach jede Route ohne Ausgabe des Werts
   einmal kontrolliert testen.

## 5. Nach der Migration — Verifikations-Checkliste

- [ ] `npm run build` läuft ohne Fehler durch (inkl. `prisma generate`)
- [ ] `/api/health` liefert HTTP 200
- [ ] Ein Test-Login (Admin) funktioniert (`/admin/login`)
- [ ] Ausschließlich in Staging mit Datenbank-Clone und nach Freigabe erzeugt
      ein einzelner manueller Pipeline-Trigger einen echten Testartikel mit
      `status='published'`; nie ungeprüft gegen Produktion ausführen
- [ ] `/api/cron/news` wird vom Coolify Scheduled Task erfolgreich erreicht;
      ein optionaler separater `news-scheduler.ts`-Worker ist nicht zugleich
      aktiv
- [ ] `ads.txt` und `ads_tm.php`-Route liefern die erwarteten Zeilen
- [ ] `/adtest-prebid` zeigt einen grünen Chain-Check
- [ ] Ein externer curl-Test mit echtem Browser-User-Agent bekommt HTTP 200
      (nicht 204 durch die Ad-Fraud-Firewall in `middleware.ts`)
