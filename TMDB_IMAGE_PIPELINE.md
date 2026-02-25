# TMDB Image Pipeline – Implementierungsdokumentation

## 📋 Übersicht

Die TMDB Image Pipeline wurde vollständig implementiert und ermöglicht es, Bilder von TMDB on-demand zu fetchen, zu transformieren und über eigene URLs bereitzustellen.

## ✅ Implementierte Features

### 1. Image Proxy Routes

Drei dedizierte Next.js API Routes wurden erstellt:

#### `/img/hero/[type]/[id]`
- **Format:** 1280×720px (16:9)
- **Verwendung:** Hero-Banner auf Artikel-Seiten
- **Quelle:** TMDB Backdrop (Fallback: Poster)

#### `/img/og/[type]/[id]`
- **Format:** 1200×630px (OpenGraph Standard)
- **Verwendung:** Social Media Previews (Facebook, Twitter, etc.)
- **Quelle:** TMDB Backdrop (Fallback: Poster)

#### `/img/card/[type]/[id]`
- **Format:** 500×750px (2:3 Hochformat)
- **Verwendung:** News-Karten, Serie-Karten auf der Homepage
- **Quelle:** TMDB Poster (Fallback: Backdrop)

### 2. Bildverarbeitung

- **Format:** WebP (85% Qualität)
- **Transformation:** Sharp Library
- **Resize-Strategie:** `cover` mit `center` Position

### 3. Caching

**Header-basiertes Edge-Caching:**
```
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
```

- **CDN/Edge Cache:** 24 Stunden (86400 Sekunden)
- **Stale-While-Revalidate:** 7 Tage (604800 Sekunden)
- **Kein persistenter Storage:** On-Demand Generierung

### 4. Placeholder-Bilder

Professionelle Gradient-Placeholders in `/public/placeholders/`:
- `hero.webp` (1536×1024, konvertiert zu 1280×720)
- `og.webp` (1024×1024, konvertiert zu 1200×630)
- `card.webp` (1024×1536, konvertiert zu 500×750)

### 5. Datenbankschema

**Neue Felder im `Article` Model:**
```prisma
tmdbId           Int?
tmdbType         String    @default("tv") // "tv" | "movie"
tmdbBackdropPath String?
tmdbPosterPath   String?
heroImageUrl     String?
ogImageUrl       String?
cardImageUrl     String?
imageAttribution String    @default("TMDB")
```

### 6. UI-Integration

**Komponenten aktualisiert:**
- ✅ `app/[slug]/page.tsx` – Artikel-Seite Hero-Image
- ✅ `app/[slug]/page.tsx` – `generateMetadata()` für OG-Tags
- ✅ `components/NewsCard.tsx` – Card-Images
- ✅ `components/HomeClient.tsx` – Props für TMDB-Daten

## 🧪 Testing

### Manuelle Tests durchgeführt:

1. **API Routes:**
   ```bash
   curl -I http://localhost:3000/img/hero/tv/1396
   curl -I http://localhost:3000/img/og/tv/1396
   curl -I http://localhost:3000/img/card/tv/1396
   ```
   ✅ Alle Routes liefern 200 OK, Content-Type: image/webp

2. **UI-Integration:**
   - ✅ Homepage zeigt Artikel mit TMDB Card-Images
   - ✅ Artikel-Seite zeigt Hero-Image von TMDB
   - ✅ "Bildquelle: TMDB" Attribution wird angezeigt

3. **Seed-Daten:**
   - ✅ 2 Test-Artikel mit vollständiger TMDB-Integration erstellt

## 📊 Beispiel-URLs

**Live-URLs (Stranger Things, TMDB ID: 66732):**
- Hero: `/img/hero/tv/66732`
- OG: `/img/og/tv/66732`
- Card: `/img/card/tv/66732`

**Breaking Bad (TMDB ID: 1396):**
- Hero: `/img/hero/tv/1396`
- OG: `/img/og/tv/1396`
- Card: `/img/card/tv/1396`

## 🔧 Konfiguration

**Erforderliche Environment Variable:**
```env
TMDB_API_KEY=c0e0553140b7bd5f982df64c86319c1b
```

## 🎯 Vorteile

1. **Rechtssicherheit:** Bilder werden über eigene Domain ausgeliefert
2. **Performance:** Edge-Caching reduziert TMDB API Calls
3. **SEO:** Optimierte Bildformate und Größen für Google
4. **Google News:** Stabile URLs für News-Artikel
5. **Flexibilität:** On-Demand Generierung ohne Speicher-Overhead

## 🚀 Nächste Schritte (Optional)

1. **Vercel Blob Integration:** Falls persistenter Storage gewünscht
2. **Crawler Integration:** Automatisches Befüllen von `tmdbId` bei neuen Artikeln
3. **Admin Panel:** UI zum Hinzufügen von TMDB-IDs zu Artikeln

## 📝 Verwendung

### Artikel mit TMDB-Bildern erstellen:

```typescript
await prisma.article.create({
  data: {
    // ... andere Felder
    tmdbId: 66732,
    tmdbType: 'tv',
    heroImageUrl: '/img/hero/tv/66732',
    ogImageUrl: '/img/og/tv/66732',
    cardImageUrl: '/img/card/tv/66732',
    imageAttribution: 'Bildquelle: TMDB'
  }
});
```

### Automatische Fallbacks:

Die Komponenten unterstützen auch automatische URL-Generierung:
```tsx
<NewsCard
  tmdbId={66732}
  tmdbType="tv"
  // Wenn cardImageUrl nicht gesetzt ist, wird automatisch
  // /img/card/tv/66732 verwendet
/>
```

---

**Status:** ✅ Vollständig implementiert und getestet
**Datum:** 25. Februar 2026
