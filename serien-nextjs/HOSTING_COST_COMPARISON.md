# serien.de — Hosting-Kostenvergleich Vercel vs. Railway vs. Hetzner

**Stand:** 13. Juli 2026
**Aktuelle Vercel-Rechnung:** ~$8.87/Tag = **~$266/Monat**

---

## 1. Aktuelle Vercel-Kostenanalyse (Basis)

Aus deinem Dashboard-Screenshot (13.07.2026, Daily-Breakdown):

| Position | $/Tag | $/Monat | Anteil |
|---|---:|---:|---:|
| Edge Requests | $5.41 | ~$162 | **61 %** |
| Function Invocations | $1.12 | ~$34 | 13 % |
| Fluid Active CPU | $0.90 | ~$27 | 10 % |
| Fast Origin Transfer | $0.59 | ~$18 | 7 % |
| Image Optimization | $0.38 | ~$11 | 4 % |
| Fluid Provisioned Memory | $0.30 | ~$9 | 3 % |
| Sonstige (Bandwidth, ISR-Writes) | ~$0.17 | ~$5 | 2 % |
| **Summe** | **$8.87** | **~$266** | 100 % |

**Volumen-Kennzahlen (aus Vercel):**
- Edge Requests: **2.15 Mio/Tag** → ~65 Mio/Monat
- CPU Duration: ~10 Minuten/Tag Aktive CPU
- Function Memory: 38 GB / 1 TB im Included-Contingent
- Erwartete Egress-Bandbreite: geschätzt **100–300 GB/Monat** (News-Site, News-Content ist textlastig, viele Bilder aber via `next/image` bereits CDN-optimiert)

**Kostentreiber-Diagnose:**
1. **Edge Requests dominieren** — jeder Bot-Hit, jeder Prefetch, jeder Sitemap-Poll = 1 Request
2. Vercel-Firewall/Middleware-204-Blocks **kosten trotzdem 1 Edge Request** (Fraud-Block läuft in Middleware, nicht in Firewall)
3. 9 Cron-Jobs verursachen etwa 500–1500 Function-Invocations/Tag
4. Image-Optimizer sparsam wegen `minimumCacheTTL: 1 Jahr` — nur $0.38/Tag

---

## 2. Traffic-Baseline

Grobabschätzung des tatsächlichen User-Traffics (nach Bot-Filtering):

| Quelle | Anteil | Menge/Monat |
|---|---:|---:|
| Bots (bekannte + hostile) | ~40 % | 26 Mio Requests |
| Google Discover / SERP | ~25 % | 16 Mio Requests |
| Direkte User + Social | ~20 % | 13 Mio Requests |
| Prefetches (Next Link) | ~10 % | 6.5 Mio Requests |
| Sitemap/RSS/ads.txt-Polls | ~5 % | 3.5 Mio Requests |

**Konservative Egress-Schätzung:** 200 GB/Monat
- ~500k Seitenaufrufe × ~400 KB HTML+JS+Assets = ~200 GB
- Bilder größtenteils via next/image bereits gecached auf Vercel-CDN

---

## 3. Anbietervergleich

### 3.1 Vercel Pro (aktuell)

| | Wert |
|---|---|
| Fixgebühr | $20/Monat |
| Edge Requests | 10 Mio inkl., dann $0.30 / Mio |
| Function Invocations | 1 Mio inkl., dann $0.60 / Mio |
| Fluid CPU | inkl. Basis, dann usage-based |
| Egress | 100 GB inkl., dann $0.15/GB |
| Image Optimization | 5.000 Src-Images inkl. |
| **Effektiv aktuell** | **~$266/Monat** |
| Deploy-DX | 🟢🟢🟢 Best-in-class |
| Preview-URLs pro PR | 🟢 |
| Vendor-Lock-in | 🔴 Sehr hoch |

**Risiko:** Bei Discover-Traffic-Spike (viraler Artikel) kann die Rechnung problemlos auf **$500–1.000/Monat** springen. Keine Cap-Möglichkeit.

---

### 3.2 Railway (Hobby-Plan)

**Pricing-Modell:** Usage-based (CPU-Minute, RAM-GB-Minute, Egress-GB)

| Ressource | Kosten | Bei serien.de |
|---|---|---|
| Fixgebühr | $5/Monat (Hobby) | $5 |
| Compute (RAM+CPU) | $0.000463/vCPU-min + $0.000231/GB-min | siehe Berechnung |
| Egress | $0.10/GB (100 GB frei bei Pro) | $10–30/Monat |
| Cron Jobs | inkl. in Compute | $0 |
| Volume-Storage | $0.15/GB/Monat | ~$1 |

**Compute-Berechnung für Next.js SSR (Always-on, 4 GB RAM, ~1 vCPU average load):**
- RAM: 4 GB × 60 min × 24 h × 30 Tage × $0.000231 = **~$40/Monat**
- CPU: 0.5 vCPU × 60 × 24 × 30 × $0.000463 = **~$10/Monat** (idle-heavy)
- Peaks (Crons + Traffic-Spikes): **~$10–15/Monat**

**Kosten-Prognose Railway:**

| Szenario | ohne Cloudflare | mit Cloudflare Free |
|---|---:|---:|
| Compute | ~$60 | ~$45 (weniger Load durch Cache-Hits) |
| Egress | $20 (200 GB) | ~$3 (nur Cache-Miss ~30 GB) |
| Fixgebühr | $5 | $5 |
| **Total** | **~$85/Monat** | **~$53/Monat** |

**Vorteile Railway:**
- 🟢 Git-Push-Deploy funktioniert zuverlässig (kein "empty git remote" wie bei Vercel)
- 🟢 Native Cron-Scheduling, kein Extra-Setup
- 🟢 Preview-Deployments pro PR
- 🟢 Postgres/Redis mit 1-Klick (falls Neon-Migration mal ansteht)
- 🟢 Env-Var-UI, Rollback, Logs — DX nahe Vercel

**Nachteile Railway:**
- 🔴 Usage-based → Discover-Spike kann Rechnung verdoppeln
- 🔴 Sleep-Mode nicht sinnvoll bei Live-Site
- 🔴 Egress-Kosten bleiben (ohne CF)

---

### 3.3 Hetzner Cloud + Coolify

**Setup:** VPS CX22 (4 vCPU shared, 4 GB RAM, 40 GB NVMe SSD, 20 TB Traffic)

| Position | Kosten |
|---|---|
| Hetzner CX22 | €4.15/Monat |
| Coolify (self-hosted) | €0 |
| Cloudflare Free CDN | €0 |
| Cloudflare R2 (10 GB Assets) | ~€0.15/Monat |
| Backup-Storage (Hetzner Backup) | €0.83/Monat (optional) |
| **Total** | **~€5/Monat = ~$5.50** |

**Traffic-Cap:** 20 TB inkl. — bei aktuell ~200 GB/Monat = 1 % Auslastung. Praktisch unbegrenzt.

**Was Coolify liefert (Vercel-Klon-Features):**
- 🟢 Git-Push-Deploy via GitHub-Webhook
- 🟢 Automatische SSL-Zertifikate (Let's Encrypt)
- 🟢 Preview-Deployments pro Branch (mit Extra-Aufwand konfigurierbar)
- 🟢 Env-Vars-UI, Rollback, Logs, Metrics-Dashboard
- 🟢 Native Cron-Scheduler
- 🟢 Docker-basiert, portabel

**Vorteile Hetzner:**
- 🟢 **Preisstabilität:** €5 immer, egal wie viel Discover-Traffic
- 🟢 Kein Vendor-Lock-in (Docker-Container läuft überall)
- 🟢 EU-Server (Nürnberg/Falkenstein) → geringere Latenz für DACH
- 🟢 Volle Kontrolle (SSH, Logs, Filesystem)

**Nachteile Hetzner:**
- 🟡 Einmaliger Setup-Aufwand ~2 h
- 🟡 Ops-Verantwortung (Updates, Security-Patches — Coolify hilft aber)
- 🟡 Kein PR-Preview-URL out-of-the-box (workaround: Branch-Deploy manuell)

---

### 3.4 Bonus: Vercel bleiben, aber optimieren (Referenz)

Was passiert, wenn du auf Vercel bleibst und nur die kostenlosen Optimierungen machst (Cloudflare davor + Firewall-Rules + prefetch={false} + ISR-revalidate hoch)?

| Kostenpunkt | Ohne Optimierung | Mit CF + Firewall + Code-Opt |
|---|---:|---:|
| Edge Requests | $162 | ~$40 (75 % via CF gecached) |
| Function Invocations | $34 | ~$15 (Crons ausgelagert) |
| Fluid CPU | $27 | ~$15 (ISR hoch) |
| Origin Transfer | $18 | ~$5 |
| Image Optimization | $11 | ~$5 |
| Sonstige | $14 | ~$10 |
| **Total** | **$266** | **~$90/Monat** |

Also selbst mit CF davor bleibst du bei ~$90 vs. €5 bei Hetzner = **18× teurer**.

---

## 4. Gesamtvergleich

| Anbieter | Monatlich | Setup | Ops | Cost-Cap | Empfehlung für dich |
|---|---:|---|---|---|---|
| **Vercel (aktuell)** | ~$266 | 0 | 0 | ❌ | ❌ Zu teuer, unpredictable |
| **Vercel + CF + Opt** | ~$90 | 1 h | Wenig | ⚠️ | ⚠️ Immer noch 18× teurer als Hetzner |
| **Railway ohne CF** | ~$85 | 30 min | 0 | ❌ | ⚠️ Ähnlich Vercel-optimiert |
| **Railway + CF** | ~$53 | 45 min | 0 | ⚠️ | ✅ Best DX/Preis-Balance |
| **Hetzner + Coolify + CF** | **~€5 ($5.50)** | **2 h** | Wenig | ✅ | ✅✅ Größte Ersparnis |

**Jahresvergleich:**
- Vercel: $3.192
- Vercel + CF + Opt: $1.080
- Railway + CF: $636
- Hetzner + Coolify + CF: **$66**

**Ersparnis Hetzner vs. Vercel: $3.126/Jahr = ~€2.900**

---

## 5. Empfehlung nach Persona

### Wenn du "einfach weniger zahlen" willst und Ops OK ist:
→ **Hetzner + Coolify + Cloudflare** = €5/Monat, 2h einmalig Setup, danach quasi wartungsfrei

### Wenn du "wie Vercel, aber günstiger" willst:
→ **Railway + Cloudflare** = ~$50/Monat, 45 min Setup, 0 Ops. Ehrlich der beste DX/Preis-Kompromiss.

### Wenn du das Ökosystem-Risiko streuen willst:
→ **Railway für Frontend + Hetzner für Crons** (~$30/Monat total)

### Wenn du Vercel absolut behalten willst:
→ **Cloudflare davor + Firewall-Rules + prefetch={false} + ISR-hoch** = ~$90/Monat

---

## 6. Migrations-Risiken (ehrlich)

| Risiko | Vercel→Railway | Vercel→Hetzner |
|---|---|---|
| Downtime bei DNS-Cutover | <5 Min | <5 Min |
| ENV-Variablen manuell übertragen | Ja | Ja |
| next/image funktioniert nativ | Ja | Ja (mit sharp) |
| ISR/Middleware kompatibel | Ja | Ja |
| Cron-Migration Aufwand | 20 Min | 30 Min |
| Rollback-Möglichkeit | Vercel 7 Tage parallel | Vercel 7 Tage parallel |
| Zeit bis Break-Even (Setup vs. Ersparnis) | 1 Tag | 3 Tage |

Beide Migrationen sind **niedriges Risiko**, weil Next.js standardisiert läuft.

---

## 7. Nächster Schritt

Wenn du eine Entscheidung getroffen hast, kann ich sofort liefern:

**Für Railway:**
- `Dockerfile` (Next 15 + Sharp + Prisma optimiert)
- `railway.toml` mit Cron-Definitionen
- ENV-Variable-Checkliste
- Cloudflare Cache-Rules
- DNS-Cutover-Anleitung

**Für Hetzner:**
- Coolify-Install-Script (1-Command)
- `docker-compose.yml` für App + Migrations
- Cloudflare-Setup
- Systemd/Coolify-Cron-Definitionen
- Backup-Strategie (Neon-Snapshots + Coolify-Volume)

**Für "Vercel bleiben":**
- prefetch={false}-Änderungen in Grid-Cards
- ISR-revalidate-Erhöhungen
- Sitemap/RSS Cache-Header
- Cloudflare-Setup-Anleitung
- Firewall-Rules-Empfehlung
