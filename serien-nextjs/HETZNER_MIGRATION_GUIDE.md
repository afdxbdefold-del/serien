# serien.de — Migration Vercel → Hetzner + Coolify + Cloudflare

**Ziel:** Von ~$266/Monat Vercel auf ~€5/Monat Hetzner. Zero-Downtime-Migration, Vercel bleibt 7 Tage parallel als Rollback-Backup.

**Deine Zeit:** ~90 Min aktiv + DNS-Wartezeit im Hintergrund.

---

## Übersicht der Phasen

| # | Phase | Deine Zeit | Wartezeit |
|---|---|---|---|
| 1 | Hetzner-Account + Server bestellen | 15 Min | 0–30 Min (Verifizierung) |
| 2 | Coolify installieren | 10 Min | 5 Min |
| 3 | Repo für Docker vorbereiten (git push) | 5 Min | 0 |
| 4 | App in Coolify deployen | 20 Min | 5 Min Build |
| 5 | Cron-Jobs in Coolify anlegen | 10 Min | 0 |
| 6 | Cloudflare aufsetzen | 15 Min | 5 Min – 24 h DNS |
| 7 | DNS-Cutover | 5 Min | Warten bis stabil |
| 8 | 7 Tage Vercel parallel laufen lassen | 0 | 7 Tage |
| 9 | Vercel abschalten | 5 Min | 0 |

---

## PHASE 1: Hetzner-Server bestellen

### 1.1 Account
1. Öffne https://accounts.hetzner.com/signUp
2. Registrieren mit Email + Passwort
3. Personalausweis-Upload (deutsche Verifizierungspflicht) → 5–30 Min Wartezeit
4. Zahlung: **SEPA-Lastschrift** oder Kreditkarte hinterlegen

### 1.2 SSH-Key erstellen (falls noch nicht vorhanden)

Auf deinem lokalen Rechner (Mac/Linux):
```bash
ssh-keygen -t ed25519 -C "serien-de-hetzner" -f ~/.ssh/serien_hetzner
cat ~/.ssh/serien_hetzner.pub
```

Windows: **PuTTYgen** verwenden oder Windows Subsystem for Linux (WSL).

Kopiere den **Inhalt der `.pub`-Datei** — die brauchst du gleich.

### 1.3 Server bestellen

1. https://console.hetzner.cloud → Projekt erstellen: **"serien-de"**
2. Klick "Add Server":
   - **Location:** Falkenstein (fsn1) oder Nürnberg (nbg1)
   - **Image:** Ubuntu 24.04
   - **Type:** CX22 (2 vCPU, 4 GB RAM, 40 GB SSD, 20 TB Traffic) — €4.15/Monat
   - **Networking:** Public IPv4 + IPv6 (Standard)
   - **SSH Keys:** Deinen Public Key einfügen (aus Schritt 1.2)
   - **Firewall:** "Create new" → Ports 22, 80, 443 TCP inbound erlauben
   - **Backups:** ✅ Aktivieren (€0.83/Monat, empfohlen)
   - **Name:** `serien-prod`
3. **Create & Buy Now** → Server ist in 30 Sek bereit
4. **Notiere die IPv4-Adresse** (z.B. `188.245.xxx.xxx`)

### 1.4 Erster Login (Sanity-Check)

```bash
ssh -i ~/.ssh/serien_hetzner root@<SERVER-IP>
```

Erwartet: `root@serien-prod:~#` Prompt. Falls du "Are you sure...?" bekommst → `yes` tippen.

**System-Update:**
```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban htop
```

**Firewall aktivieren:**
```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp   # Coolify UI, später schließen wir das
ufw --force enable
ufw status
```

---

## PHASE 2: Coolify installieren

Weiterhin per SSH auf dem Server:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Läuft ~5 Min, installiert Docker, Traefik, Postgres, Redis, Coolify selbst.

Nach Ende:
- Coolify-UI: `http://<SERVER-IP>:8000`
- Öffne die URL in deinem Browser
- **Registrierung des ersten Users** → das wird der Admin-Account
- Email + Passwort setzen

**Server-Setup in Coolify:**
1. UI → Servers → "localhost" ist bereits verknüpft
2. Settings → Instance URL → dein Server-IP
3. Notification-Setup (optional): Discord/Email für Deploy-Alerts

---

## PHASE 3: Repo für Docker vorbereiten

### 3.1 `next.config.ts` anpassen — `standalone` Output aktivieren

Öffne `next.config.ts` und füge **direkt unter `const nextConfig: NextConfig = {`** ein:

```typescript
  // Standalone Output für Docker-Migration (Hetzner + Coolify, Feb 2026).
  // Reduziert Image-Size ~90 % (kopiert nur benötigte node_modules).
  output: 'standalone',
```

### 3.2 Dockerfile und .dockerignore

Diese sind **schon von mir angelegt**:
- `/app/serien-nextjs/Dockerfile`
- `/app/serien-nextjs/.dockerignore`
- `/app/serien-nextjs/app/api/health/route.ts` (Health-Check)

### 3.3 Alles zu GitHub pushen

```bash
git add Dockerfile .dockerignore app/api/health/route.ts next.config.ts
git commit -m "chore: add Dockerfile + standalone output for Hetzner migration"
git push
```

**Vercel ignoriert Docker automatisch**, dein aktueller Vercel-Deploy läuft unverändert weiter.

---

## PHASE 4: App in Coolify deployen

### 4.1 Neue Application

Coolify UI → **New Resource** → **Public / Private Repository**:
- **Repository:** dein GitHub-Repo (z.B. `github.com/username/serien-nextjs`)
- Falls Private: GitHub-App verbinden (Coolify guided dich)
- **Branch:** `main` (oder wie dein Prod-Branch heißt)
- **Base Directory:** `/` (oder `/serien-nextjs` falls Monorepo)
- **Build Pack:** Dockerfile (Coolify erkennt automatisch)
- **Port:** `3000`

### 4.2 Domain hinterlegen

Application → Domains:
- Primäre Domain: `serien.de` (noch nicht aktiv — DNS zeigt noch auf Vercel)
- **HTTP → HTTPS Redirect:** ✅
- **Force HTTPS:** ✅
- **www-Redirect:** `www.serien.de` → `serien.de` (301)

Coolify holt automatisch Let's Encrypt-Zertifikat, sobald DNS umgestellt ist.

### 4.3 Environment Variables (KRITISCH — vollständig übertragen!)

**Vollständige Liste** (aus deinem aktuellen Vercel-Env übernehmen):

```
# --- Database ---
DATABASE_URL=postgresql://...neon.tech/...

# --- Base URL ---
NEXT_PUBLIC_BASE_URL=https://serien.de

# --- APIs ---
TMDB_API_KEY=...
EMERGENT_LLM_KEY=sk-emergent-...
OPENAI_API_KEY=sk-...
RAPIDAPI_KEY=...
RAPIDAPI_KEY_BACKUP=...

# --- Auth ---
JWT_SECRET=...  (mindestens 32 Zeichen)
NEXTAUTH_URL=https://serien.de
NEXTAUTH_SECRET=...

# --- Facebook ---
FACEBOOK_PAGE_ACCESS_TOKEN=...
FACEBOOK_PAGE_ID=...
FACEBOOK_PAGE_TOKEN_EXPIRES_AT=...

# --- Blob Storage (falls weiter genutzt) ---
BLOB_READ_WRITE_TOKEN=...
BLOB_PUBLIC_URL=...
NEXT_PUBLIC_BLOB_URL=...

# --- Push Notifications ---
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
PUSH_API_SECRET=...

# --- Google Indexing ---
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# --- Pipeline Flags ---
HEADLINE_OPINION_KILLER=true
HEADLINE_REWRITE_LOOP=true
USE_PROCESSED_IMAGES=true

# --- Coolify-spezifisch ---
CRON_SECRET=<generiere-langen-random-string>   # NEU: für Cron-Auth
```

**Wichtig:**
- `CRON_SECRET` generieren: `openssl rand -hex 32` (auf dem Server ausführen)
- Alle Werte aus dem Vercel-Dashboard **1:1 kopieren** (Vercel: Project → Settings → Environment Variables)

### 4.4 Erster Deploy (Testing-Mode, noch nicht Live)

Application → **Deploy** klicken.

Coolify:
1. Cloned dein Repo
2. Baut Docker-Image (~3–5 Min)
3. Startet Container
4. Traefik routet Traffic zu Container

**Zwischentest:** Öffne `http://<SERVER-IP>` (ohne Domain). Sollte HTML zurückgeben. Falls Error → Logs in Coolify checken (**Application → Logs → Live Tail**).

**Häufige Fehler:**
- `Prisma Client not found`: `npx prisma generate` fehlt im Docker-Build → Dockerfile prüfen
- `DATABASE_URL missing`: Env-Var vergessen einzutragen
- `Cannot find module 'sharp'`: `apk add --no-cache vips-dev` in Dockerfile ergänzen falls nötig

---

## PHASE 5: Cron-Jobs in Coolify einrichten

Application → **Scheduled Tasks** → für jeden Cron:

**Cron-Command-Template:**
```bash
curl -fsS -X POST "http://localhost:3000/api/cron/<PATH>" \
  -H "Authorization: Bearer $CRON_SECRET" \
  --max-time 300
```

**Alle 9 Crons anlegen** (Copy-Paste-Table):

| Name | Schedule | Endpoint |
|---|---|---|
| news-crawl | `0 * * * *` | `/api/cron/news` |
| releases | `15 */2 * * *` | `/api/cron/releases` |
| youtube | `30 */3 * * *` | `/api/cron/youtube` |
| videos | `45 */3 * * *` | `/api/cron/videos` |
| seo | `0 6 * * *` | `/api/cron/seo` |
| tmdb-sync | `0 5 * * *` | `/api/cron/tmdb-sync` |
| flixpatrol | `15 4 * * *` | `/api/cron/flixpatrol` |
| downgrade-stale | `30 3 * * *` | `/api/cron/downgrade-stale` |
| backfill-streaming | `0 */2 * * *` | `/api/cron/backfill-streaming-series` |

**Timezone:** In Coolify auf `Europe/Berlin` setzen (Global Settings).

**Cron-Auth in Next.js** — falls noch nicht vorhanden, in den entsprechenden `/api/cron/*/route.ts`:
```typescript
const auth = request.headers.get('authorization');
if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

### 5.1 Vercel-Crons DEAKTIVIEREN

**WICHTIG bevor du live gehst:** `vercel.json` — Crons entfernen, sonst laufen sie doppelt (Vercel + Hetzner).

Alternative: Ganzen `crons`-Block aus `vercel.json` löschen und pushen. Vercel deaktiviert Crons beim nächsten Deploy automatisch.

---

## PHASE 6: Cloudflare aufsetzen

### 6.1 Account + Site hinzufügen

1. https://dash.cloudflare.com/sign-up
2. **Add a Site** → `serien.de` → Plan **Free** wählen
3. CF scannt deine DNS-Records → prüfen, dass alle da sind (v.a. MX für Email)
4. CF zeigt dir **2 Nameserver** (z.B. `xxx.ns.cloudflare.com`) → **notieren**

### 6.2 DNS-Records anpassen

In Cloudflare DNS-UI:
- **A** `@` → `<HETZNER-SERVER-IP>` → Proxy status: 🟠 **Proxied** (Cloud Icon orange)
- **A** `www` → `<HETZNER-SERVER-IP>` → Proxied
- **MX / TXT / andere:** unverändert lassen

**NOCH NICHT** die Nameserver bei deinem Registrar umstellen! Erst Cache-Rules + Firewall-Rules einrichten.

### 6.3 Cache-Rules (unter Rules → Cache Rules)

**Rule 1: Bypass Cache für Admin + APIs**
- **Name:** `bypass-admin-api`
- **When:** `URI Path` matches regex `^/(admin|api/(admin|cron|track|health))(/.*)?$` OR `Cookie` contains `admin_token`
- **Then:** Bypass cache

**Rule 2: Aggressive Cache für statische Assets**
- **Name:** `cache-static-long`
- **When:** `URI Path` matches regex `^/(_next/static|img|favicon|robots\.txt|.*\.(webp|jpg|png|svg|ico|woff2?|css|js))$`
- **Then:** Cache Everything + Edge TTL **1 month**

**Rule 3: HTML Cache mit stale-while-revalidate**
- **Name:** `cache-html`
- **When:** `URI Path` NOT matches `^/(admin|api)` AND Request Method = `GET`
- **Then:** Cache Everything + Edge TTL **10 minutes** + Browser TTL **1 minute** + Serve Stale Content while updating: ✅

**Rule 4: Sitemap / RSS**
- **Name:** `cache-sitemap`
- **When:** `URI Path` matches `.*sitemap.*\.xml|/robots\.txt|/ads\.txt`
- **Then:** Cache Everything + Edge TTL **1 hour**

### 6.4 Firewall-Rules (unter Security → WAF → Custom Rules)

**Rule 1: Country-Block**
- **Name:** `deny-high-fraud-countries`
- **When:** `Country` in {CN, HK, MO, VN, ID, IN, PK, BD, MY, PH, TH, MM, KH, LK, NP, NG, EG, IR} AND `User Agent` does not contain `Googlebot` AND does not contain `Bingbot`
- **Then:** Block

**Rule 2: Bot-UA-Block**
- **Name:** `deny-hostile-bots`
- **When:** `User Agent` matches regex `(?i)(bytespider|yisouspider|mj12bot|dotbot|megaindex|blexbot|dataforseobot|amazonbot|imagesiftbot|headlesschrome|python-requests|python-urllib|go-http-client|okhttp|axios|node-fetch|libwww-perl|curl/|wget/)`
- **Then:** Block

**Rule 3: Empty UA**
- **Name:** `deny-empty-ua`
- **When:** `User Agent` equals `""` (empty)
- **Then:** Managed Challenge

**Rule 4: Admin-Login Rate-Limit** (Security → Rate limiting rules)
- **When:** `URI Path` equals `/api/admin/auth/login`
- **Rate:** 10 requests per 1 minute per IP
- **Then:** Block for 10 minutes

### 6.5 SSL/TLS Einstellungen

- SSL/TLS → Overview → **Full (strict)** wählen
- Edge Certificates → Always Use HTTPS: ✅
- Edge Certificates → Automatic HTTPS Rewrites: ✅
- Edge Certificates → Minimum TLS Version: **1.2**

### 6.6 Speed Optimierung

- Speed → Optimization:
  - Auto Minify: JS + CSS + HTML ✅ (deaktivieren falls Next-Assets kaputtgehen)
  - Brotli: ✅
  - Early Hints: ✅

---

## PHASE 7: DNS-Cutover (der große Moment)

### 7.1 Vorher-Test

Prüfe dass Coolify-Instance funktioniert:
```bash
curl -H "Host: serien.de" http://<SERVER-IP>/
# sollte HTML mit "serien.de" liefern
```

### 7.2 Nameserver umstellen

Bei deinem Domain-Registrar (IONOS/Strato/Namecheap/etc.):
1. Domain-Verwaltung öffnen
2. "Nameserver ändern" → **eigene Nameserver**
3. Die 2 Cloudflare-Nameserver aus Phase 6.1 eintragen
4. Speichern

**Propagation-Zeit:** 5 Min – 24 h. Meist <1 h.

### 7.3 Cutover-Monitoring

Warten bis DNS umgestellt:
```bash
# Von deinem lokalen Rechner:
dig +short serien.de NS
# Sollte cloudflare.com anzeigen
```

Dann testen:
```bash
curl -I https://serien.de/
# Header sollte enthalten: server: cloudflare
```

Öffne serien.de im Browser → normale Seite → **Migration erfolgreich!**

### 7.4 Cloudflare Cache-Rules verifizieren

- CF Dashboard → Analytics → Cache Hit Ratio → nach 1 h sollte >30 % sein
- Nach 24 h >70 %
- Nach 1 Woche stabil bei 80–90 %

---

## PHASE 8: 7-Tage-Parallel-Laufzeit

**Vercel läuft weiter** — aber bekommt keinen Traffic mehr (DNS zeigt auf Hetzner via CF).

**Was du monitorst:**
- **Vercel-Dashboard:** Edge Requests sollten gegen 0 sinken (nach 24 h DNS-Propagation)
- **Coolify:** RAM/CPU-Auslastung → sollte <60 % sein (bei Peaks max 80 %)
- **Cloudflare:** Cache-Hit-Ratio, Firewall-Blocks
- **Ad-Einnahmen (Ezoic/TheMoneytizer):** Vergleich vor/nach in 7 Tagen

**Fehler? → Rollback:**
1. In CF DNS: A-Record `@` von `<HETZNER-IP>` zurück auf Vercel-IP
2. Warten 5 Min → Traffic geht wieder auf Vercel
3. Fehler debuggen ohne Zeitdruck

---

## PHASE 9: Vercel abschalten

Nach 7 Tagen stabilem Hetzner-Betrieb:

1. Vercel Dashboard → Project → Settings → **Delete Project**
2. **Nächstes Datum notieren:** Vercel-Abo läuft evtl. bis Monatsende (Pro-Plan $20 Basis)
3. Zahlungsmethode entfernen falls kein anderes Projekt drauf läuft

---

## Anhang A: Backup-Strategie

**Hetzner Snapshots** (bereits aktiviert in Phase 1.3):
- Automatisch täglich (7 Tage Retention)
- Kosten: €0.83/Monat
- Restore: 1-Klick in Hetzner Console

**Neon-DB-Backup** (unabhängig):
- Neon macht automatisch Point-in-Time-Recovery
- Zusätzlich: `pg_dump` per Cron alle 24 h nach R2:
```bash
# In Coolify Scheduled Task, 1× täglich:
pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://serien-backups/db-$(date +%Y%m%d).sql.gz
```

**Config-Backup:**
- Coolify → Settings → Export Configuration → JSON runterladen
- Alle 4 Wochen einmal

---

## Anhang B: Monitoring (kostenlos)

**Uptime-Robot (kostenlos, 50 Checks):**
- https://uptimerobot.com
- Monitor: `https://serien.de/api/health` alle 5 Min
- Alerts: Email/SMS/Telegram

**Coolify Notifications:**
- Settings → Notifications → Discord Webhook
- Für: Deploy Failed, Container OOM, High CPU

**Cloudflare Analytics:**
- Dashboard → Analytics & Logs → Traffic
- Zeigt: echte User vs. Bots, Cache-Hit-Ratio, Bandbreite

---

## Anhang C: Kosten-Übersicht nach Migration

| Position | €/Monat |
|---|---:|
| Hetzner CX22 | €4.15 |
| Hetzner Backup | €0.83 |
| Cloudflare Free | €0.00 |
| Neon-DB (unverändert) | € — |
| **Total Hosting-Neu** | **~€5** |
| **Vs. Vercel vorher** | **~$266** |
| **Ersparnis** | **~$260/Monat** |

---

## Anhang D: Häufige Probleme + Fixes

| Problem | Fix |
|---|---|
| Docker-Build failt mit "Sharp binaries not found" | In Dockerfile: `RUN apk add --no-cache vips-dev` in builder-Stage |
| Prisma Client fehlt zur Runtime | Sicherstellen dass `node_modules/.prisma` in Runtime-Stage kopiert wird (schon in unserem Dockerfile) |
| Container OOM-Kill bei Traffic-Peak | Coolify → Application → Resources → Memory Limit auf 3 GB setzen |
| Cron feuert nicht | `Authorization: Bearer $CRON_SECRET` Header prüfen; Coolify-Timezone auf `Europe/Berlin` |
| `next-image` liefert 500 | Sharp in Runtime-Stage installieren (in Dockerfile) |
| Traefik-SSL bekommt kein Zertifikat | DNS-Propagation abwarten; Coolify → Retry Certificate |
| Ads laden nicht | CF-Cache purgen, Browser-DevTools → Network → Ad-Requests nicht cached prüfen |

---

## Checkliste zum Abhaken

- [ ] Hetzner-Account verifiziert
- [ ] SSH-Key erstellt
- [ ] Server CX22 bestellt + IP notiert
- [ ] Erster SSH-Login erfolgreich
- [ ] ufw + fail2ban aktiv
- [ ] Coolify installiert (`http://SERVER-IP:8000` erreichbar)
- [ ] Admin-User in Coolify erstellt
- [ ] `next.config.ts` mit `output: 'standalone'` gepusht
- [ ] Dockerfile committed + gepusht
- [ ] GitHub-Repo mit Coolify verbunden
- [ ] Alle ENV-Vars in Coolify eingefügt (Liste aus Phase 4.3)
- [ ] CRON_SECRET generiert und gesetzt
- [ ] Erster Deploy erfolgreich (Container läuft, `curl` liefert HTML)
- [ ] Health-Check `/api/health` liefert 200
- [ ] Alle 9 Cron-Tasks in Coolify angelegt
- [ ] Cron-Auth-Header in `/api/cron/*/route.ts` ergänzt
- [ ] Vercel-Crons deaktiviert (`vercel.json` bereinigt)
- [ ] Cloudflare-Account + serien.de hinzugefügt
- [ ] CF-DNS A-Record auf Hetzner-IP (Proxied)
- [ ] 4 Cache-Rules in CF konfiguriert
- [ ] 4 Firewall-Rules in CF konfiguriert
- [ ] SSL/TLS auf Full (strict)
- [ ] Nameserver beim Registrar umgestellt
- [ ] DNS propagiert (`dig serien.de NS` zeigt CF)
- [ ] `curl -I https://serien.de` liefert `server: cloudflare`
- [ ] Vercel Edge Requests sinken auf ~0
- [ ] Coolify CPU/RAM <80 %
- [ ] Uptime-Robot eingerichtet
- [ ] 7-Tage-Beobachtung läuft
- [ ] Ad-Einnahmen stabil (nach 3–5 Tagen)
- [ ] Vercel-Projekt gelöscht

---

**Fragen? Wenn was hakt, sag Bescheid mit Screenshot vom Fehler + welcher Schritt.**
