# 🚀 Deployment Guide - serien.de

## ✅ Was wurde vorbereitet

### Git Repository
- ✅ Komplett neu aufgesetzt (alte History gelöscht)
- ✅ Sauber: Nur 28 Dateien, 604 KB
- ✅ Keine node_modules oder package-lock.json
- ✅ 7 Commits bereit zum Push

### Next.js App (`/serien-nextjs`)
- ✅ Next.js 15 mit TypeScript
- ✅ Tailwind CSS
- ✅ Prisma ORM (7 Tabellen)
- ✅ Clean Routes:
  - `/` (Homepage)
  - `/[slug]` (Artikel-Detail)
  - `/sitemap.xml` (dynamisch)
  - `/robots.txt`

### Gelöscht/Entfernt
- ❌ `/news` Route
- ❌ `/serie/[id]` Route
- ❌ `/genre/*` Routes
- ❌ `/streamer/*` Routes
- ❌ TMDB Auto-Import Referenzen

### Konzept
**Admin-gesteuert:**
- Artikel werden über Admin-Bereich erstellt
- Serien werden über Admin-Bereich importiert
- Keine automatischen externen Daten-Pulls

---

## 📋 Deployment-Schritte

### Schritt 1: GitHub Repository vorbereiten

1. **Gehe zu GitHub:**
   ```
   https://github.com/afdxbdefold-del/serien
   ```

2. **Lösche altes Repository** (falls vorhanden):
   - Settings → Danger Zone → Delete this repository
   - Bestätige mit Repository-Namen

3. **Erstelle neues Repository:**
   - Name: `serien`
   - Visibility: Public (oder Private)
   - **WICHTIG:** Keine README, .gitignore oder License hinzufügen

### Schritt 2: Code zu GitHub pushen

```bash
cd /app
git remote add origin https://github.com/afdxbdefold-del/serien.git
git push -u origin main --force
```

### Schritt 3: Vercel Projekt erstellen

1. **Gehe zu Vercel:**
   ```
   https://vercel.com/new
   ```

2. **Repository importieren:**
   - Wähle `afdxbdefold-del/serien`
   - Klicke "Import"

3. **Projekt konfigurieren:**
   ```
   Framework Preset: Next.js (auto-detect)
   Root Directory: serien-nextjs  ⬅️ WICHTIG!
   Build Command: npm run build
   Install Command: npm install --legacy-peer-deps
   Output Directory: .next
   ```

4. **Environment Variables hinzufügen:**
   ```env
   DATABASE_URL=<your-neon-connection-string>  (dein Neon Connection String)
   NEXT_PUBLIC_BASE_URL=https://serien.de
   ```

5. **Deploy klicken!**

### Schritt 4: Domain konfigurieren (optional)

1. In Vercel-Projekt:
   - Settings → Domains
   - `serien.de` hinzufügen
   - DNS bei deinem Provider konfigurieren

---

## 🔑 Wichtige Environment Variables

### Erforderlich
```env
DATABASE_URL=<your-neon-connection-string-goes-here>
```

### Optional (für später)
```env
NEXT_PUBLIC_BASE_URL=https://serien.de
NEXTAUTH_SECRET=dein-geheimer-key-hier
NEXTAUTH_URL=https://serien.de
```

---

## 📊 Repository-Status

```
Repository-Größe:    604 KB
Dateien im Git:      28
Commits:             7
Branch:              main
Node Modules:        ❌ Nicht im Git
Package Lock:        ❌ Nicht im Git
```

---

## ✅ Nächste Schritte nach Deployment

### 1. Datenbank initialisieren
```bash
# Prisma Schema auf Neon pushen
npx prisma db push
```

### 2. Admin-Panel entwickeln
- NextAuth.js Integration
- `/admin` Route
- Artikel-CRUD
- Serien-Management

### 3. Content erstellen
- Ersten Admin-User anlegen
- Test-Artikel erstellen
- Live auf `/artikel-slug` testen

---

## 🆘 Troubleshooting

### Build-Fehler: "Cannot find module @prisma/client"
```bash
# In Vercel Settings → General → Install Command:
npm install --legacy-peer-deps && npx prisma generate
```

### Root Directory-Fehler
- Stelle sicher: **Root Directory = `serien-nextjs`**
- Nicht `/` oder `./serien-nextjs`

### Database Connection Fehler
- Prüfe `DATABASE_URL` in Vercel Environment Variables
- Teste Connection String in Neon Dashboard

---

## 📞 Support

Bei Problemen:
1. Vercel Deployment Logs prüfen
2. Neon Database Logs prüfen
3. GitHub Repository Status prüfen

---

**Erstellt:** 2026-02-25
**Status:** ✅ Bereit für GitHub Push
