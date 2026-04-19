# serien.de - Next.js CMS

Eine schlanke Content-Management-Plattform für Serien-News.

## 🎯 Konzept

**Admin-gesteuerte Plattform:**
- Alle Inhalte (Artikel, Serien) werden über Admin-Bereich verwaltet
- Keine automatischen TMDB-Imports
- Volle Kontrolle über Content

## 🏗️ Struktur

```
/app/serien-nextjs/
├── app/
│   ├── [slug]/          # Universelle Artikel-Route
│   ├── page.tsx         # Homepage
│   ├── layout.tsx       # Root Layout
│   ├── sitemap.ts       # Dynamische Sitemap
│   └── robots.ts        # SEO Robots
├── lib/
│   └── prisma.ts        # Datenbank Client
└── prisma/
    └── schema.prisma    # Datenbank-Schema
```

## 📊 Datenbank

**7 Tabellen:**
- `users` - Admins & Autoren
- `articles` - Content (über Admin erstellt)
- `series` - Serien (über Admin erstellt)
- `comments` - Community
- `follows` - User-Interaktionen
- `notifications` - Benachrichtigungen
- `redirects` - SEO-Weiterleitungen

## 🚀 Deployment (Vercel)

### 1. GitHub Repository erstellen
```bash
git remote add origin https://github.com/USERNAME/serien.git
git push -u origin main
```

### 2. Vercel Projekt konfigurieren
- **Root Directory:** `serien-nextjs`
- **Build Command:** `npm run build`
- **Install Command:** `npm install --legacy-peer-deps`

### 3. Environment Variables
```env
DATABASE_URL=<your-neon-connection-string>
NEXT_PUBLIC_BASE_URL=https://serien.de
```

## 📝 Nächste Schritte

### Phase 2: Admin-Panel
- [ ] `/admin` Route erstellen
- [ ] NextAuth.js Integration
- [ ] Artikel-CRUD (Erstellen, Bearbeiten, Löschen)
- [ ] Serien-Management
- [ ] Bild-Upload (Vercel Blob Storage)

### Phase 3: Frontend Features
- [ ] Artikel-Listing auf Homepage
- [ ] Suche
- [ ] Kategorien/Tags
- [ ] Related Articles

### Phase 4: Community
- [ ] Kommentar-System
- [ ] User-Profile
- [ ] Benachrichtigungen

## 🛠️ Lokale Entwicklung

```bash
cd serien-nextjs

# Dependencies installieren
npm install

# Prisma generieren
npx prisma generate

# Dev Server starten
npm run dev
```

## 📖 API-Konzept

Alle Content-Verwaltung erfolgt über:
1. **Admin-UI** (Next.js Server Actions)
2. **Prisma ORM** (direkte DB-Zugriffe)
3. **Keine REST-API** im Frontend

## 🎨 Design

- Tailwind CSS
- Responsive
- Dark Mode (optional)
- Accessibility-optimiert

---

**Status:** ✅ Foundation komplett
**Bereit für:** Admin-Panel-Entwicklung
