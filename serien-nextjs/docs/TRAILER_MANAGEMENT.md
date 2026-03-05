# Trailer Management System

## Übersicht
Das System verwaltet Trailer für Artikel automatisch über zwei Wege:
1. **TMDB-Trailer**: Automatischer Download wenn vorhanden
2. **Manuelle YouTube-Links**: Für Serien ohne TMDB-Trailer

## Automatischer Workflow (Pipeline v2)

### Artikel-Erstellung
```bash
npx tsx scripts/pipeline-v2.ts [article-url]
```

**Was passiert:**
1. ✅ Pipeline prüft TMDB auf Trailer-Daten
2. ✅ Falls vorhanden: Download & Hosting auf Emergent Object Storage
3. ⚠️ Falls nicht vorhanden: Logging mit Suchvorschlag

**Console Output bei fehlenden Trailern:**
```
ℹ️  No trailer on TMDB for "School Spirits"
💡 Manual search: "School Spirits Trailer Deutsch"
💡 Add via: npx tsx scripts/add-trailer.ts [slug] [youtube-url]
```

## Manueller Workflow

### 1. Artikel ohne Trailer finden
```bash
npx tsx scripts/add-trailer.ts
```

**Output:**
```
Found 8 articles without trailers:

1. School Spirits: Staffel 3 Folge 6 Recap
   Series: School Spirits
   Slug: school-spirits-staffel-3-folge-6-recap...
   Search: "School Spirits Trailer Deutsch"
```

### 2. YouTube-Trailer suchen
- Öffne YouTube
- Suche: "[Serienname] Trailer Deutsch"
- Kopiere URL (z.B. `https://www.youtube.com/watch?v=j5saRpqoTW4`)

### 3. Trailer zum Artikel hinzufügen
```bash
npx tsx scripts/add-trailer.ts [article-slug] [youtube-url]
```

**Beispiel:**
```bash
npx tsx scripts/add-trailer.ts \
  school-spirits-staffel-3-folge-6-recap-wer-stahl-kyles-koerper \
  https://www.youtube.com/watch?v=j5saRpqoTW4
```

## Serie-Trailer von TMDB aktualisieren

Falls eine Serie später Trailer auf TMDB bekommt:

```bash
npx tsx scripts/update-series-trailers.ts [tmdb-id]
```

**Beispiel:**
```bash
npx tsx scripts/update-series-trailers.ts 208397
```

## Technische Details

### Datenbank-Felder
- `articles.heroVideoUrl`: YouTube-URL oder Cloud-gehosteter Trailer
- `articles.trailerLocalUrl`: Legacy-Feld (Cloud-URL)
- `series.trailers`: TMDB-Trailer-Metadaten (JSON)

### Dateien
- `scripts/pipeline-v2.ts`: Haupt-Pipeline mit Trailer-Logik
- `scripts/add-trailer.ts`: Manuelles Trailer-Management
- `scripts/update-series-trailers.ts`: TMDB-Trailer-Aktualisierung
- `lib/trailer-downloader.ts`: YouTube-Download & Cloud-Upload
- `lib/auto-trailer-search.ts`: Zukünftige Auto-Suche (TODO)

### Frontend-Integration
Die Artikel-Seite (`app/[slug]/page.tsx`) zeigt Trailer automatisch an:
```tsx
<InlineVideoPlayer
  heroImageUrl={heroImage}
  trailerUrl={article.heroVideoUrl || article.trailerLocalUrl}
  title={article.title}
/>
```

## Zukünftige Erweiterungen

### Automatische YouTube-Suche
Die Pipeline kann erweitert werden um automatisch zu suchen:

```typescript
// In pipeline-v2.ts
import { searchYouTubeTrailer } from '../lib/auto-trailer-search';

const searchResult = await searchYouTubeTrailer(seriesName);
if (searchResult.found) {
  await prisma.articles.update({
    where: { id: articleId },
    data: { heroVideoUrl: searchResult.url }
  });
}
```

### Bulk-Trailer-Import
Script für alle existierenden Artikel ohne Trailer:

```bash
# TODO: Implementieren
npx tsx scripts/bulk-add-trailers.ts
```

## FAQ

**Q: Warum werden manche Trailer nicht gefunden?**
A: Nicht alle Serien haben Trailer-Daten auf TMDB. In diesem Fall muss manuell gesucht werden.

**Q: Kann ich Trailer nachträglich ändern?**
A: Ja, einfach erneut `add-trailer.ts` mit neuer URL ausführen.

**Q: Wo werden Trailer gespeichert?**
A: Von TMDB heruntergeladene Trailer werden auf Emergent Object Storage gehostet. Manuelle YouTube-Links bleiben YouTube-Links.

**Q: Wie finde ich den besten Trailer?**
A: Suche nach:
1. Offiziellen Kanälen (z.B. Paramount+ DE, Netflix DE)
2. Deutscher Ton oder Untertitel
3. "Official Trailer" im Titel
